import { OrderStatus, ShipmentStatus } from '@prisma/client';

export type TimelineStep =
  | 'ORDER_RECEIVED'
  | 'APPROVED'
  | 'PROCESSING'
  | 'SHIPPED'
  | 'IN_TRANSIT'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED';

export const TIMELINE_ORDER: TimelineStep[] = [
  'ORDER_RECEIVED',
  'APPROVED',
  'PROCESSING',
  'SHIPPED',
  'IN_TRANSIT',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
];

export const TIMELINE_LABELS: Record<TimelineStep, string> = {
  ORDER_RECEIVED: 'Order Received',
  APPROVED: 'Approved',
  PROCESSING: 'Processing',
  SHIPPED: 'Shipped',
  IN_TRANSIT: 'In Transit',
  OUT_FOR_DELIVERY: 'Out For Delivery',
  DELIVERED: 'Delivered',
};

/** Resolve the current public timeline step from internal statuses. */
export function currentStep(order: OrderStatus, shipment?: ShipmentStatus | null): TimelineStep {
  if (shipment === 'DELIVERED' || order === 'DELIVERED') return 'DELIVERED';
  if (shipment === 'OUT_FOR_DELIVERY') return 'OUT_FOR_DELIVERY';
  if (shipment === 'IN_TRANSIT' || shipment === 'PICKED_UP') return 'IN_TRANSIT';
  if (order === 'SHIPPED' || shipment === 'CREATED') return 'SHIPPED';
  if (order === 'PROCESSING' || order === 'SENT_TO_ODOO') return 'PROCESSING';
  if (order === 'APPROVED') return 'APPROVED';
  return 'ORDER_RECEIVED';
}

/** Build the full timeline with reached/active flags for the UI. */
export function buildTimeline(order: OrderStatus, shipment?: ShipmentStatus | null) {
  const cur = currentStep(order, shipment);
  const curIdx = TIMELINE_ORDER.indexOf(cur);
  return TIMELINE_ORDER.map((step, idx) => ({
    step,
    label: TIMELINE_LABELS[step],
    reached: idx <= curIdx,
    active: idx === curIdx,
  }));
}
