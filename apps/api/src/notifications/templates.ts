/** Notification templates keyed by event. Kept simple/string-based; swap for a
 *  templating engine (handlebars/mjml) when richer email is needed. */

export type NotificationTemplate =
  | 'ORDER_APPROVED'
  | 'SHIPMENT_CREATED'
  | 'SHIPMENT_IN_WAREHOUSE'
  | 'SHIPMENT_IN_TRANSIT'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED';

interface TemplateContext {
  customerName?: string;
  orderNumber?: string;
  trackingNumber?: string;
  trackingUrl?: string;
}

const T: Record<NotificationTemplate, (c: TemplateContext) => { subject: string; body: string }> = {
  ORDER_APPROVED: (c) => ({
    subject: `Your order ${c.orderNumber} is confirmed`,
    body: `Hi ${c.customerName ?? 'there'}, your order ${c.orderNumber} has been approved and is being prepared.`,
  }),
  SHIPMENT_CREATED: (c) => ({
    subject: `Your order ${c.orderNumber} has shipped`,
    body: `Good news! Order ${c.orderNumber} is on its way. Track it here: ${c.trackingUrl} (tracking ${c.trackingNumber}).`,
  }),
  // Sent once, when the courier marks the shipment as received at the warehouse
  // (Bosta "received at warehouse" → ShipmentStatus.PICKED_UP). Reassures the
  // customer that the parcel is in hand and moving to the next delivery stage.
  SHIPMENT_IN_WAREHOUSE: (c) => ({
    subject: `Your order ${c.orderNumber} has arrived at our warehouse`,
    body:
      `Good news! Your order ${c.orderNumber} has been shipped and has arrived at our warehouse. ` +
      `It is now being prepared for the next delivery stage. We will keep you updated with any further progress.` +
      (c.trackingUrl ? ` Track it here: ${c.trackingUrl}` : ''),
  }),
  SHIPMENT_IN_TRANSIT: (c) => ({
    subject: `Order ${c.orderNumber} is in transit`,
    body: `Your order ${c.orderNumber} is in transit. Follow it live: ${c.trackingUrl}`,
  }),
  OUT_FOR_DELIVERY: (c) => ({
    subject: `Order ${c.orderNumber} is out for delivery`,
    body: `Your order ${c.orderNumber} is out for delivery today. Track: ${c.trackingUrl}`,
  }),
  DELIVERED: (c) => ({
    subject: `Order ${c.orderNumber} delivered`,
    body: `Your order ${c.orderNumber} has been delivered. Thank you for shopping with Essentials!`,
  }),
};

export function renderTemplate(template: NotificationTemplate, ctx: TemplateContext) {
  return T[template](ctx);
}
