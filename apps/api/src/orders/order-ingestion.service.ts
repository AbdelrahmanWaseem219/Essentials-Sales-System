import { Injectable, Logger } from '@nestjs/common';
import { OrderSource, OrderStatus, PaymentMethod, PaymentStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { OdooService } from '../integrations/odoo/odoo.service';
import { OrderNumberService } from './order-number.service';

/**
 * Normalised order payload coming from an external source (Shopify).
 * Source-specific mapping happens in the integration; this service owns
 * persistence so ingestion is uniform and idempotent.
 */
export interface NormalizedOrder {
  source: OrderSource;
  externalOrderId: string;
  externalOrderName?: string;
  currency: string;
  customer: {
    externalId?: string;
    email?: string;
    phone?: string;
    firstName?: string;
    lastName?: string;
  };
  shippingAddress?: {
    firstName?: string;
    lastName?: string;
    phone?: string;
    line1: string;
    line2?: string;
    city: string;
    governorate?: string;
    country?: string;
    zip?: string;
  };
  items: { sku: string; name: string; quantity: number; unitPrice: number; externalLineId?: string }[];
  totals: { subtotal: number; shipping: number; discount: number; tax: number; grand: number };
  payment: { method: PaymentMethod; status: PaymentStatus; amount: number; paid: number };
  placedAt?: Date;
}

@Injectable()
export class OrderIngestionService {
  private readonly logger = new Logger(OrderIngestionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly odoo: OdooService,
    private readonly orderNumber: OrderNumberService,
  ) {}

  /** Idempotent upsert of an external order into our system.
   *  resolveOdoo=false skips per-line Odoo SKU lookups (used for bulk backfill;
   *  the odooProductId is resolved later when the order is approved/pushed). */
  async ingest(o: NormalizedOrder, resolveOdoo = true) {
    // 1. Upsert customer
    const customer = await this.upsertCustomer(o.customer);

    // 2. Upsert address (best-effort)
    let shippingAddressId: string | undefined;
    if (o.shippingAddress) {
      const addr = await this.prisma.address.create({
        data: {
          customerId: customer.id,
          type: 'SHIPPING',
          firstName: o.shippingAddress.firstName,
          lastName: o.shippingAddress.lastName,
          phone: o.shippingAddress.phone,
          line1: o.shippingAddress.line1,
          line2: o.shippingAddress.line2,
          city: o.shippingAddress.city,
          governorate: o.shippingAddress.governorate,
          country: o.shippingAddress.country ?? 'EG',
          zip: o.shippingAddress.zip,
        },
      });
      shippingAddressId = addr.id;
    }

    // 3. Resolve SKUs against Odoo (snapshot product ids)
    const items: Prisma.OrderItemCreateWithoutOrderInput[] = [];
    for (const i of o.items) {
      const product = resolveOdoo ? await this.odoo.resolveProduct(i.sku, i.name).catch(() => null) : null;
      items.push({
        sku: i.sku,
        name: i.name,
        quantity: i.quantity,
        unitPrice: new Prisma.Decimal(i.unitPrice),
        totalPrice: new Prisma.Decimal(i.unitPrice * i.quantity),
        odooProductId: product?.id ?? null,
        shopifyLineItemId: i.externalLineId,
      });
    }

    const status =
      o.payment.status === PaymentStatus.PENDING && o.payment.method !== PaymentMethod.COD
        ? OrderStatus.PAYMENT_PENDING
        : OrderStatus.PENDING_REVIEW;

    // 4. Upsert order (dedup on shopifyOrderId)
    const order = await this.prisma.order.upsert({
      where: { shopifyOrderId: o.externalOrderId },
      update: {
        // On orders/updated we refresh totals + payment, never downgrade workflow status.
        subtotal: new Prisma.Decimal(o.totals.subtotal),
        shippingTotal: new Prisma.Decimal(o.totals.shipping),
        discountTotal: new Prisma.Decimal(o.totals.discount),
        taxTotal: new Prisma.Decimal(o.totals.tax),
        grandTotal: new Prisma.Decimal(o.totals.grand),
      },
      create: {
        orderNumber: await this.orderNumber.next(),
        source: o.source,
        status,
        customerId: customer.id,
        shippingAddressId,
        currency: o.currency,
        subtotal: new Prisma.Decimal(o.totals.subtotal),
        shippingTotal: new Prisma.Decimal(o.totals.shipping),
        discountTotal: new Prisma.Decimal(o.totals.discount),
        taxTotal: new Prisma.Decimal(o.totals.tax),
        grandTotal: new Prisma.Decimal(o.totals.grand),
        shopifyOrderId: o.externalOrderId,
        shopifyOrderName: o.externalOrderName,
        placedAt: o.placedAt ?? new Date(),
        items: { create: items },
        payments: {
          create: {
            method: o.payment.method,
            status: o.payment.status,
            amount: new Prisma.Decimal(o.payment.amount),
            amountPaid: new Prisma.Decimal(o.payment.paid),
            currency: o.currency,
            paidAt: o.payment.status === PaymentStatus.PAID ? new Date() : null,
          },
        },
        events: { create: { type: 'CREATED', message: `Imported from ${o.source}` } },
      },
      include: { items: true, payments: true },
    });

    // Keep the payment record in sync on orders/updated — otherwise an order paid
    // AFTER creation keeps amountPaid=0 and Bosta would later be told to collect
    // the full amount as COD on an already-paid order (double charge).
    if (order.payments?.length) {
      const payment = order.payments[0];
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          method: o.payment.method,
          status: o.payment.status,
          amount: new Prisma.Decimal(o.payment.amount),
          amountPaid: new Prisma.Decimal(o.payment.paid),
          paidAt:
            o.payment.status === PaymentStatus.PAID ? (payment.paidAt ?? new Date()) : payment.paidAt,
        },
      });
    }

    this.logger.log(`Ingested ${o.source} order ${o.externalOrderName ?? o.externalOrderId} → ${order.orderNumber}`);
    return order;
  }

  /** Upsert a customer from a Shopify customers/create|update webhook payload. */
  async upsertShopifyCustomer(p: any) {
    const externalId = p?.id ? String(p.id) : undefined;
    const email = p?.email ?? undefined;
    if (!externalId && !email) return null; // nothing to key on
    return this.upsertCustomer({
      externalId,
      email,
      phone: p?.phone ?? p?.default_address?.phone ?? undefined,
      firstName: p?.first_name ?? undefined,
      lastName: p?.last_name ?? undefined,
    });
  }

  async markCancelled(externalOrderId: string) {
    const order = await this.prisma.order.findUnique({ where: { shopifyOrderId: externalOrderId } });
    if (!order || ['CANCELLED', 'RETURNED', 'DELIVERED'].includes(order.status)) return;
    await this.prisma.order.update({
      where: { id: order.id },
      data: {
        status: OrderStatus.CANCELLED,
        cancelReason: 'Cancelled in Shopify',
        events: { create: { type: 'STATUS_CHANGE', toStatus: 'CANCELLED', message: 'Cancelled in Shopify' } },
      },
    });
  }

  private async upsertCustomer(c: NormalizedOrder['customer']) {
    if (c.externalId) {
      return this.prisma.customer.upsert({
        where: { shopifyCustomerId: c.externalId },
        update: { email: c.email, phone: c.phone, firstName: c.firstName, lastName: c.lastName },
        create: {
          shopifyCustomerId: c.externalId,
          email: c.email,
          phone: c.phone,
          firstName: c.firstName,
          lastName: c.lastName,
        },
      });
    }
    if (c.email) {
      return this.prisma.customer.upsert({
        where: { email: c.email },
        update: { phone: c.phone, firstName: c.firstName, lastName: c.lastName },
        create: { email: c.email, phone: c.phone, firstName: c.firstName, lastName: c.lastName },
      });
    }
    return this.prisma.customer.create({
      data: { phone: c.phone, firstName: c.firstName, lastName: c.lastName },
    });
  }

}
