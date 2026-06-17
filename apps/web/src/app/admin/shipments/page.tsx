'use client';

import { OrdersTable } from '@/components/orders-table';

export default function ShipmentsPage() {
  return <OrdersTable defaultStatus="SHIPPED" title="Shipments" />;
}
