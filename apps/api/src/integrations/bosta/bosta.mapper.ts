import { ShipmentStatus } from '@prisma/client';

/**
 * Map Bosta delivery state codes/labels to our ShipmentStatus.
 * Bosta state codes (v2) roughly:
 *  10 created/picked-up requested, 21 received at warehouse, 24 in transit,
 *  41 out for delivery, 45 delivered, 46/48 returned, 47 exception/cancelled.
 */
export function mapBostaState(state?: { value?: string; code?: number }): ShipmentStatus {
  const code = state?.code;
  const label = (state?.value ?? '').toLowerCase();

  if (code === 45 || label.includes('delivered')) return ShipmentStatus.DELIVERED;
  if (code === 41 || label.includes('out for delivery')) return ShipmentStatus.OUT_FOR_DELIVERY;
  if (code === 24 || label.includes('transit')) return ShipmentStatus.IN_TRANSIT;
  if (code === 21 || label.includes('picked') || label.includes('received'))
    return ShipmentStatus.PICKED_UP;
  if (label.includes('returned') || code === 46 || code === 48) return ShipmentStatus.RETURNED;
  if (label.includes('cancel')) return ShipmentStatus.CANCELLED;
  if (label.includes('exception') || label.includes('problem')) return ShipmentStatus.EXCEPTION;
  return ShipmentStatus.CREATED;
}
