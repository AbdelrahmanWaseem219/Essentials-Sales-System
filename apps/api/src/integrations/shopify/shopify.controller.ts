import { Controller, Headers, HttpCode, Post, Req } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { Request } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ShopifyService } from './shopify.service';

/**
 * Shopify webhook receiver. Mounted OUTSIDE the /api prefix at /webhooks/shopify.
 * The raw body (Buffer) is required for HMAC verification — see main.ts.
 *
 * Flow: verify HMAC → persist raw WebhookEvent (dedup) → process → mark processed.
 * In production the "process" step is enqueued to BullMQ; here it runs inline with
 * the same idempotent semantics.
 */
@ApiExcludeController()
@Public()
@Controller('webhooks/shopify')
export class ShopifyController {
  constructor(
    private readonly shopify: ShopifyService,
    private readonly prisma: PrismaService,
  ) {}

  @Post()
  @HttpCode(200)
  async handle(
    @Req() req: Request,
    @Headers('x-shopify-topic') topic: string,
    @Headers('x-shopify-hmac-sha256') hmac: string,
    @Headers('x-shopify-webhook-id') webhookId: string,
  ) {
    const raw = req.body as Buffer; // raw() middleware
    // Always require a valid HMAC signature. If no secret is configured,
    // verifyHmac returns false and the delivery is recorded but NOT processed —
    // this endpoint is public, so unsigned/forged payloads must never mutate orders.
    const valid = this.shopify.verifyHmac(raw, hmac);
    const payload = valid ? JSON.parse(raw.toString('utf8')) : {};

    // Persist + dedup on (provider, topic, externalId). Return 200 always so
    // Shopify doesn't hammer retries for already-seen events.
    const externalId = webhookId ?? (payload?.id ? String(payload.id) : null);
    const event = await this.prisma.webhookEvent
      .create({
        data: { provider: 'SHOPIFY', topic, externalId, payload, hmacValid: valid },
      })
      .catch(() => null); // unique violation = duplicate delivery

    if (!valid || !event) return { ok: true };

    try {
      await this.process(topic, payload);
      await this.prisma.webhookEvent.update({
        where: { id: event.id },
        data: { processedAt: new Date(), attempts: { increment: 1 } },
      });
    } catch (e: any) {
      await this.prisma.webhookEvent.update({
        where: { id: event.id },
        data: { error: e.message, attempts: { increment: 1 } },
      });
    }
    return { ok: true };
  }

  private async process(topic: string, payload: any) {
    switch (topic) {
      case 'orders/create':
      case 'orders/updated':
        return this.shopify.handleOrderUpsert(payload);
      case 'orders/cancelled':
        return this.shopify.handleOrderCancelled(payload);
      case 'customers/create':
      case 'customers/update':
        return this.shopify.handleCustomerUpsert(payload);
      default:
        return undefined;
    }
  }
}
