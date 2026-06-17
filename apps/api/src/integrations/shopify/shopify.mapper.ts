import { PaymentMethod, PaymentStatus, OrderSource } from '@prisma/client';
import { NormalizedOrder } from '../../orders/order-ingestion.service';

/** Map a Shopify order webhook payload to our normalized order shape. */
export function mapShopifyOrder(p: any): NormalizedOrder {
  const gateway = (p.payment_gateway_names?.[0] ?? '').toLowerCase();
  const isCod = gateway.includes('cash') || gateway.includes('cod');

  const financial = p.financial_status as string; // paid | pending | partially_paid | refunded ...
  const paymentStatus: PaymentStatus =
    financial === 'paid'
      ? PaymentStatus.PAID
      : financial === 'partially_paid'
        ? PaymentStatus.PARTIALLY_PAID
        : financial === 'refunded'
          ? PaymentStatus.REFUNDED
          : financial === 'partially_refunded'
            ? PaymentStatus.PARTIALLY_REFUNDED
            : PaymentStatus.PENDING;

  const grand = parseFloat(p.total_price ?? '0');
  const paid =
    paymentStatus === PaymentStatus.PAID
      ? grand
      : parseFloat(p.total_received ?? p.current_total_price ?? '0') || 0;

  const ship = p.shipping_address;

  return {
    source: OrderSource.SHOPIFY,
    externalOrderId: String(p.id),
    externalOrderName: p.name,
    currency: p.currency ?? 'EGP',
    customer: {
      externalId: p.customer ? String(p.customer.id) : undefined,
      email: p.email ?? p.customer?.email ?? undefined,
      phone: p.phone ?? p.customer?.phone ?? ship?.phone ?? undefined,
      firstName: p.customer?.first_name ?? ship?.first_name,
      lastName: p.customer?.last_name ?? ship?.last_name,
    },
    shippingAddress: ship
      ? {
          firstName: ship.first_name,
          lastName: ship.last_name,
          phone: ship.phone,
          line1: ship.address1,
          line2: ship.address2,
          city: ship.city,
          governorate: ship.province,
          country: ship.country_code ?? 'EG',
          zip: ship.zip,
        }
      : undefined,
    items: (p.line_items ?? []).map((li: any) => ({
      sku: li.sku ?? String(li.variant_id ?? li.product_id),
      name: li.title ?? li.name,
      quantity: li.quantity,
      unitPrice: parseFloat(li.price ?? '0'),
      externalLineId: String(li.id),
    })),
    totals: {
      subtotal: parseFloat(p.subtotal_price ?? '0'),
      shipping: parseFloat(p.total_shipping_price_set?.shop_money?.amount ?? p.total_shipping ?? '0') || 0,
      discount: parseFloat(p.total_discounts ?? '0'),
      tax: parseFloat(p.total_tax ?? '0'),
      grand,
    },
    payment: {
      method: isCod ? PaymentMethod.COD : PaymentMethod.CARD,
      status: paymentStatus,
      amount: grand,
      paid,
    },
    placedAt: p.created_at ? new Date(p.created_at) : undefined,
  };
}
