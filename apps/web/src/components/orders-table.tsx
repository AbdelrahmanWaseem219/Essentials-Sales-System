'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { api } from '@/lib/api';
import { Card, PageHeader, StatusBadge } from '@/components/ui';
import { SelectMenu } from '@/components/select-menu';
import { formatDate, formatMoney } from '@/lib/utils';

interface OrderRow {
  id: string;
  orderNumber: string;
  status: string;
  grandTotal: string;
  currency: string;
  placedAt: string;
  customer: { firstName?: string; lastName?: string; phone?: string };
}
interface Paginated {
  data: OrderRow[];
  total: number;
  page: number;
  pageSize: number;
}

const STATUSES = [
  '',
  'PENDING_REVIEW',
  'APPROVED',
  'PROCESSING',
  'SHIPPED',
  'DELIVERED',
  'ON_HOLD',
  'CANCELLED',
  'RETURNED',
];

const SUBTITLES: Record<string, string> = {
  PENDING_REVIEW: 'Orders awaiting your approval',
  SHIPPED: 'Orders on the way to customers',
  PAYMENT_PENDING: 'Orders awaiting payment',
};

export function OrdersTable({
  defaultStatus = '',
  title = 'Orders',
}: {
  defaultStatus?: string;
  title?: string;
}) {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState(defaultStatus);
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<Paginated | null>(null);
  const [loading, setLoading] = useState(true);
  const pageSize = 25;

  // Reset to page 1 whenever the search or status filter changes.
  useEffect(() => {
    setPage(1);
  }, [search, status]);

  useEffect(() => {
    let cancelled = false; // ignore responses from superseded requests (filter/page race)
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (status) params.set('status', status);
    params.set('page', String(page));
    params.set('pageSize', String(pageSize));
    setLoading(true);
    const t = setTimeout(() => {
      api
        .get<Paginated>(`/orders?${params}`)
        .then((r) => { if (!cancelled) setResult(r); })
        .catch(() => { if (!cancelled) setResult(null); })
        .finally(() => { if (!cancelled) setLoading(false); });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [search, status, page]);

  const totalPages = result ? Math.max(1, Math.ceil(result.total / pageSize)) : 1;

  return (
    <div>
      <PageHeader
        title={title}
        subtitle={SUBTITLES[defaultStatus] ?? 'All orders across every channel'}
        action={
          result ? (
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 dark:bg-white/10 dark:text-slate-300">
              {result.total} total
            </span>
          ) : undefined
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative max-w-xs flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input
            placeholder="Search order #, name or phone…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm shadow-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 dark:border-white/15 dark:bg-white/5 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-white/40 dark:focus:ring-white/15"
          />
        </div>
        {!defaultStatus && (
          <SelectMenu
            value={status}
            onChange={setStatus}
            options={STATUSES.map((s) => ({
              value: s,
              label: s ? s.replace(/_/g, ' ') : 'All statuses',
            }))}
            className="w-44"
          />
        )}
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/60 text-left text-xs uppercase tracking-wider text-slate-500 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-400">
              <th className="px-5 py-3 font-semibold">Order</th>
              <th className="px-5 py-3 font-semibold">Customer</th>
              <th className="px-5 py-3 font-semibold">Status</th>
              <th className="px-5 py-3 text-right font-semibold">Total</th>
              <th className="px-5 py-3 text-right font-semibold">Placed</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-white/10">
            {result?.data.map((o) => (
              <tr key={o.id} className="transition-colors hover:bg-slate-50 dark:hover:bg-white/[0.04]">
                <td className="px-5 py-3.5">
                  <Link
                    href={`/admin/orders/${o.id}`}
                    className="font-semibold text-brand hover:underline dark:text-white"
                  >
                    {o.orderNumber}
                  </Link>
                </td>
                <td className="px-5 py-3.5">
                  <div className="font-medium text-slate-800 dark:text-slate-200">
                    {[o.customer?.firstName, o.customer?.lastName].filter(Boolean).join(' ') || '—'}
                  </div>
                  <div className="text-xs text-slate-400 dark:text-slate-500">{o.customer?.phone}</div>
                </td>
                <td className="px-5 py-3.5">
                  <StatusBadge status={o.status} />
                </td>
                <td className="px-5 py-3.5 text-right font-medium tabular-nums">
                  {formatMoney(o.grandTotal, o.currency)}
                </td>
                <td className="px-5 py-3.5 text-right text-slate-500 dark:text-slate-400">{formatDate(o.placedAt)}</td>
              </tr>
            ))}
            {result && result.data.length === 0 && !loading && (
              <tr>
                <td colSpan={5} className="px-5 py-16 text-center text-slate-400">
                  No orders found
                </td>
              </tr>
            )}
            {loading && !result && (
              <tr>
                <td colSpan={5} className="px-5 py-16 text-center text-slate-300">
                  Loading…
                </td>
              </tr>
            )}
          </tbody>
        </table>
        </div>
      </Card>

      {/* Pagination */}
      {result && result.total > 0 && (
        <div className="mt-4 flex items-center justify-between text-sm">
          <span className="text-slate-500 dark:text-slate-400">
            Showing {(result.page - 1) * pageSize + 1}–
            {Math.min(result.page * pageSize, result.total)} of {result.total}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || loading}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/15 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10"
            >
              ← Prev
            </button>
            <span className="px-1 text-slate-500 dark:text-slate-400">
              Page {result.page} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || loading}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/15 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10"
            >
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
