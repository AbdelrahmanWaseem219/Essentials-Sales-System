'use client';

import { OrdersTable } from '@/components/orders-table';

export default function ApprovalsPage() {
  return <OrdersTable defaultStatus="PENDING_REVIEW" title="Approval Queue" />;
}
