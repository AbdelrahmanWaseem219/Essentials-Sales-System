import { Controller, Headers, HttpCode, Post, Req } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { timingSafeEqual } from 'crypto';
import { Public } from '../../common/decorators/public.decorator';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ShipmentsService } from '../../shipments/shipments.service';

/**
 * Bosta webhook receiver at /webhooks/bosta. Bosta posts delivery state changes;
 * we persist the raw envelope, then apply the update to the matching shipment.
 */
@ApiExcludeController()
@Public()
@Controller('webhooks/bosta')
export class BostaController {
  constructor(
    private readonly shipments: ShipmentsService,
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  @Post()
  @HttpCode(200)
  async handle(@Req() req: Request, @Headers('x-webhook-secret') secret: string) {
    const expected = this.config.get<string>('bosta.webhookSecret');
    // Verify the shared secret with a constant-time compare. If no secret is
    // configured we FAIL CLOSED in production (an unauthenticated POST must not be
    // able to mutate shipment/order state) but allow it in dev for convenience.
    // Either way the Bosta poller keeps tracking current, so rejecting unsigned
    // webhooks loses no functionality.
    const valid = expected
      ? !!secret && safeEqual(secret, expected)
      : this.config.get<string>('env') !== 'production';

    // /webhooks routes receive a RAW Buffer body (main.ts mounts express.raw so
    // Shopify HMAC works). Bosta posts JSON, so parse the buffer ourselves —
    // reading fields straight off the Buffer would always yield undefined.
    const rawBody = req.body as Buffer;
    let body: any = {};
    try {
      body = rawBody?.length ? JSON.parse(rawBody.toString('utf8')) : (req.body ?? {});
    } catch {
      body = {};
    }

    const trackingNumber = body?.trackingNumber ?? body?.data?.trackingNumber;
    await this.prisma.webhookEvent
      .create({
        data: {
          provider: 'BOSTA',
          topic: 'delivery/update',
          externalId: trackingNumber ?? null,
          payload: body,
          hmacValid: valid,
        },
      })
      .catch(() => null);

    if (!valid) return { ok: true };

    await this.shipments.applyTrackingUpdate({
      trackingNumber,
      bostaDeliveryId: body?._id ?? body?.data?._id,
      state: body?.state ?? body?.data?.state,
      location:
        body?.currentLocation ?? body?.data?.currentLocation ?? body?.state?.value ?? undefined,
      occurredAt: body?.timestamp ? new Date(body.timestamp) : new Date(),
      raw: body,
    });
    return { ok: true };
  }
}

/** Length-safe constant-time string comparison. */
function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}
