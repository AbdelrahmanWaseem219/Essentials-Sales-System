'use client';

import { OrdersTable } from '@/components/orders-table';

/** Payments are managed per-order; this view focuses on orders awaiting payment. */
export default function PaymentsPage() {
  return <OrdersTable defaultStatus="PAYMENT_PENDING" title="Payments" />;
}
