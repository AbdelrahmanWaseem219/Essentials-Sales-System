'use client';

import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Button, Card, StatusBadge } from '@/components/ui';
import { useToast } from '@/components/toast';
import { formatDate, formatMoney } from '@/lib/utils';

const ACTION_LABEL: Record<string, string> = {
  approve: 'Order approved',
  reject: 'Order rejected',
  ship: 'Bosta shipment created',
  hold: 'Order put on hold',
  release: 'Order released',
  cancel: 'Order cancelled',
};

interface OrderDetail {
  id: string;
  orderNumber: string;
  status: string;
  currency: string;
  subtotal: string;
  shippingTotal: string;
  discountTotal: string;
  grandTotal: string;
  customerNote?: string;
  odooPickingId?: number;
  customer: { id: string; firstName?: string; lastName?: string; email?: string; phone?: string };
  shippingAddress?: { line1: string; city: string; governorate?: string };
  items: { id: string; sku: string; name: string; quantity: number; unitPrice: string; totalPrice: string }[];
  payments: { id: string; method: string; status: string; amount: string; amountPaid: string }[];
  shipments: { id: string; trackingNumber?: string; status: string; trackingUrl?: string }[];
  events: { id: string; type: string; message?: string; toStatus?: string; createdAt: string }[];
}

export default function OrderDetailView() {
  const { id } = useParams<{ id: string }>();
  const toast = useToast();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  // Manual reload used after an action (approve/ship/…); user-initiated, no race.
  const load = useCallback(() => {
    api.get<OrderDetail>(`/orders/${id}`).then(setOrder).catch((e) => setError(e.message));
  }, [id]);

  // Initial / id-change load, guarded so a slow response for a previous id (or an
  // unmounted view) can't overwrite newer state.
  useEffect(() => {
    let cancelled = false;
    api
      .get<OrderDetail>(`/orders/${id}`)
      .then((d) => !cancelled && setOrder(d))
      .catch((e) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function act(action: string, body?: unknown) {
    setBusy(action);
    setError('');
    try {
      if (action === 'ship') {
        await api.post(`/shipments/order/${id}`);
      } else {
        await api.post(`/orders/${id}/${action}`, body);
      }
      load();
      toast(ACTION_LABEL[action] ?? 'Done');
    } catch (e: any) {
      setError(e.message);
      toast(e.message ?? 'Action failed', 'error');
    } finally {
      setBusy('');
    }
  }

  if (!order) return <p className="text-slate-400 dark:text-slate-500">{error || 'Loading…'}</p>;

  const canApprove = order.status === 'PENDING_REVIEW';
  const canShip = order.status === 'PROCESSING' && order.shipments.length === 0;
  const canHold = ['PENDING_REVIEW', 'APPROVED', 'PROCESSING'].includes(order.status);
  const canCancel = !['DELIVERED', 'CANCELLED', 'REJECTED', 'RETURNED'].includes(order.status);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-3 text-2xl font-bold text-slate-900 dark:text-white">
            {order.orderNumber} <StatusBadge status={order.status} />
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {[order.customer.firstName, order.customer.lastName].filter(Boolean).join(' ')} ·{' '}
            {order.customer.phone}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canApprove && (
            <>
              <Button disabled={!!busy} onClick={() => act('approve')}>
                Approve
              </Button>
              <Button variant="danger" disabled={!!busy} onClick={() => act('reject', { reason: 'Rejected' })}>
                Reject
              </Button>
            </>
          )}
          {canShip && (
            <Button disabled={!!busy} onClick={() => act('ship')}>
              Create Bosta Shipment
            </Button>
          )}
          {canHold && (
            <Button variant="outline" disabled={!!busy} onClick={() => act('hold', { reason: 'On hold' })}>
              Hold
            </Button>
          )}
          {order.status === 'ON_HOLD' && (
            <Button variant="outline" disabled={!!busy} onClick={() => act('release')}>
              Release
            </Button>
          )}
          {canCancel && (
            <Button variant="ghost" disabled={!!busy} onClick={() => act('cancel', { reason: 'Cancelled' })}>
              Cancel
            </Button>
          )}
        </div>
      </div>

      {error && <p className="text-red-600">{error}</p>}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <h2 className="font-semibold text-slate-900 dark:text-white">Items</h2>
          <div className="overflow-x-auto">
          <table className="mt-3 w-full min-w-[480px] text-sm">
            <thead className="text-left text-slate-500 dark:text-slate-400">
              <tr>
                <th className="py-2">SKU</th>
                <th>Product</th>
                <th>Qty</th>
                <th>Unit</th>
                <th className="text-right">Total</th>
              </tr>
            </thead>
            <tbody className="text-slate-700 dark:text-slate-300">
              {order.items.map((i) => (
                <tr key={i.id} className="border-t border-slate-100 dark:border-white/10">
                  <td className="py-2 font-mono text-xs">{i.sku}</td>
                  <td>{i.name}</td>
                  <td>{i.quantity}</td>
                  <td>{formatMoney(i.unitPrice, order.currency)}</td>
                  <td className="text-right">{formatMoney(i.totalPrice, order.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
          <div className="mt-4 ml-auto w-56 space-y-1 text-sm">
            <Row label="Subtotal" value={formatMoney(order.subtotal, order.currency)} />
            <Row label="Shipping" value={formatMoney(order.shippingTotal, order.currency)} />
            <Row label="Discount" value={`- ${formatMoney(order.discountTotal, order.currency)}`} />
            <div className="border-t pt-1 dark:border-white/10">
              <Row label="Total" value={formatMoney(order.grandTotal, order.currency)} bold />
            </div>
          </div>
        </Card>

        <div className="space-y-6">
          <Card className="p-5">
            <h2 className="font-semibold text-slate-900 dark:text-white">Fulfillment</h2>
            <dl className="mt-3 space-y-2 text-sm">
              <Info label="Odoo Picking" value={order.odooPickingId ? `#${order.odooPickingId}` : 'Not pushed'} />
              {order.shipments.map((s) => (
                <Info
                  key={s.id}
                  label="Bosta"
                  value={`${s.trackingNumber ?? '—'} (${s.status})`}
                />
              ))}
              {order.shippingAddress && (
                <Info
                  label="Ship to"
                  value={`${order.shippingAddress.line1}, ${order.shippingAddress.city}`}
                />
              )}
            </dl>
          </Card>

          <Card className="p-5">
            <h2 className="font-semibold text-slate-900 dark:text-white">Payment</h2>
            {order.payments.map((p) => (
              <div key={p.id} className="mt-2 text-sm">
                <StatusBadge status={p.status} /> · {p.method} ·{' '}
                {formatMoney(p.amountPaid, order.currency)} / {formatMoney(p.amount, order.currency)}
              </div>
            ))}
          </Card>
        </div>
      </div>

      <Card className="p-5">
        <h2 className="font-semibold text-slate-900 dark:text-white">History</h2>
        <ol className="mt-3 space-y-2 text-sm">
          {order.events.map((e) => (
            <li key={e.id} className="flex gap-3">
              <span className="text-slate-400 dark:text-slate-500">{formatDate(e.createdAt)}</span>
              <span className="font-medium text-slate-800 dark:text-slate-200">{e.toStatus ?? e.type}</span>
              <span className="text-slate-500 dark:text-slate-400">{e.message}</span>
            </li>
          ))}
        </ol>
      </Card>
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between ${bold ? 'font-bold text-slate-900 dark:text-white' : 'text-slate-700 dark:text-slate-300'}`}>
      <span className="text-slate-500 dark:text-slate-400">{label}</span>
      <span>{value}</span>
    </div>
  );
}
function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-slate-500 dark:text-slate-400">{label}</dt>
      <dd className="text-right font-medium text-slate-800 dark:text-slate-200">{value}</dd>
    </div>
  );
}
