/** Types & enums shared between the NestJS API and the Next.js web app.
 *  Kept in sync with apps/api/prisma/schema.prisma. */

export type Role = 'ADMIN' | 'SALES_MANAGER' | 'SALES_AGENT' | 'CUSTOMER';

export type OrderStatus =
  | 'PENDING_REVIEW'
  | 'APPROVED'
  | 'SENT_TO_ODOO'
  | 'PROCESSING'
  | 'SHIPPED'
  | 'DELIVERED'
  | 'ON_HOLD'
  | 'CANCELLED'
  | 'RETURNED'
  | 'PAYMENT_PENDING'
  | 'REJECTED';

export type PaymentMethod = 'COD' | 'CARD' | 'WALLET' | 'BANK_TRANSFER' | 'OTHER';

export type PaymentStatus =
  | 'PENDING'
  | 'PARTIALLY_PAID'
  | 'PAID'
  | 'REFUNDED'
  | 'PARTIALLY_REFUNDED'
  | 'FAILED';

export type ShipmentStatus =
  | 'CREATED'
  | 'PICKED_UP'
  | 'IN_TRANSIT'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'RETURNED'
  | 'CANCELLED'
  | 'EXCEPTION';

export type NotificationChannel = 'EMAIL' | 'SMS' | 'WHATSAPP';

export const TIMELINE_STEPS = [
  'ORDER_RECEIVED',
  'APPROVED',
  'PROCESSING',
  'SHIPPED',
  'IN_TRANSIT',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
] as const;
export type TimelineStep = (typeof TIMELINE_STEPS)[number];
