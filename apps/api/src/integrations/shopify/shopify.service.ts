import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import { createHmac, timingSafeEqual } from 'crypto';
import { OrderIngestionService } from '../../orders/order-ingestion.service';
import { mapShopifyOrder } from './shopify.mapper';

@Injectable()
export class ShopifyService {
  private readonly logger = new Logger(ShopifyService.name);
  private readonly http: AxiosInstance;
  private readonly webhookSecret: string;

  constructor(
    private readonly config: ConfigService,
    private readonly ingestion: OrderIngestionService,
  ) {
    this.webhookSecret = config.get<string>('shopify.webhookSecret')!;
    this.http = axios.create({
      baseURL: `https://${config.get('shopify.shop')}/admin/api/${config.get('shopify.apiVersion')}`,
      headers: {
        'X-Shopify-Access-Token': config.get<string>('shopify.adminToken')!,
        'Content-Type': 'application/json',
      },
    });
  }

  /** Whether HMAC verification is enforced (i.e. a webhook secret is configured). */
  isHmacConfigured(): boolean {
    return !!this.webhookSecret;
  }

  /** Verify the X-Shopify-Hmac-Sha256 header against the raw request body. */
  verifyHmac(rawBody: Buffer, hmacHeader?: string): boolean {
    if (!hmacHeader || !this.webhookSecret) return false;
    const digest = createHmac('sha256', this.webhookSecret).update(rawBody).digest('base64');
    const a = Buffer.from(digest);
    const b = Buffer.from(hmacHeader);
    return a.length === b.length && timingSafeEqual(a, b);
  }

  /**
   * One-time historical backfill: paginate ALL Shopify orders via the Admin API
   * and ingest them. Requires SHOPIFY_ADMIN_TOKEN. Cursor pagination via the
   * REST `Link` header. Idempotent (orders dedupe on shopifyOrderId), so it's
   * safe to re-run. Skips per-line Odoo lookups for speed.
   */
  async backfillAllOrders(): Promise<{ imported: number; pages: number }> {
    if (!this.config.get('shopify.adminToken')) {
      throw new Error('SHOPIFY_ADMIN_TOKEN is not set — cannot backfill');
    }
    let imported = 0;
    let pages = 0;
    let path: string | null = `/orders.json?status=any&limit=250`;

    while (path) {
      const res = await this.http.get(path);
      const orders = res.data.orders ?? [];
      for (const o of orders) {
        try {
          await this.ingestion.ingest(mapShopifyOrder(o), false);
          imported++;
        } catch (e: any) {
          this.logger.warn(`Backfill skip order ${o.id}: ${e.message}`);
        }
      }
      pages++;
      this.logger.log(`Backfill page ${pages}: ${orders.length} orders (total ${imported})`);
      path = this.nextLink(res.headers['link']);
    }
    this.logger.log(`Backfill complete: ${imported} orders across ${pages} pages`);
    return { imported, pages };
  }

  /** Extract the rel="next" URL from a Shopify REST Link header, if present. */
  private nextLink(linkHeader?: string): string | null {
    if (!linkHeader) return null;
    for (const part of linkHeader.split(',')) {
      const m = part.match(/<([^>]+)>;\s*rel="next"/);
      if (m) return m[1]; // absolute URL; axios uses it as-is (auth header still applied)
    }
    return null;
  }

  // ── webhook handlers (called by worker after persistence) ──

  async handleOrderUpsert(payload: any) {
    return this.ingestion.ingest(mapShopifyOrder(payload));
  }

  async handleOrderCancelled(payload: any) {
    return this.ingestion.markCancelled(String(payload.id));
  }

  async handleCustomerUpsert(payload: any) {
    const customer = await this.ingestion.upsertShopifyCustomer(payload);
    if (customer) this.logger.debug(`Customer upserted from Shopify: ${customer.id}`);
  }

  // ── push fulfillment + tracking back to Shopify ──

  /**
   * After a Bosta shipment is created, write the tracking number back to the
   * Shopify order as a fulfillment so the storefront/customer sees it.
   */
  async syncFulfillment(shopifyOrderId: string, trackingNumber: string, trackingUrl?: string) {
    try {
      // Fetch fulfillment orders (2024-07 fulfillment API)
      const { data } = await this.http.get(`/orders/${shopifyOrderId}/fulfillment_orders.json`);
      const fulfillmentOrderId = data.fulfillment_orders?.[0]?.id;
      if (!fulfillmentOrderId) return;

      await this.http.post(`/fulfillments.json`, {
        fulfillment: {
          line_items_by_fulfillment_order: [{ fulfillment_order_id: fulfillmentOrderId }],
          tracking_info: { number: trackingNumber, url: trackingUrl, company: 'Bosta' },
          notify_customer: false,
        },
      });
      this.logger.log(`Synced fulfillment to Shopify order ${shopifyOrderId}`);
    } catch (e: any) {
      this.logger.warn(`Shopify fulfillment sync failed: ${e.message}`);
    }
  }
}
