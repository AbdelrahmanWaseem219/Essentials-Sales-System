'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ClipboardCheck, PackageCheck, RotateCcw, ShoppingBag, TrendingUp } from 'lucide-react';
import { api } from '@/lib/api';
import { Card, PageHeader, StatusBadge } from '@/components/ui';
import { useIsDark, chartPalette } from '@/components/theme-toggle';
import { formatMoney } from '@/lib/utils';

interface Summary {
  revenue: number | string;
  orderCount: number;
  delivered: number;
  returned: number;
  returnRate: number;
  pendingReview: number;
}
interface OrderRow {
  id: string;
  orderNumber: string;
  status: string;
  grandTotal: string;
  currency: string;
  placedAt: string;
  customer: { firstName?: string; lastName?: string };
}

export default function DashboardPage() {
  const dark = useIsDark();
  const C = chartPalette(dark); // shared theme-aware chart colors
  const [summary, setSummary] = useState<Summary | null>(null);
  const [revenue, setRevenue] = useState<{ day: string; revenue: number }[]>([]);
  const [recent, setRecent] = useState<OrderRow[]>([]);
  const [products, setProducts] = useState<{ name: string; unitsSold: number }[]>([]);

  useEffect(() => {
    api.get<Summary>('/analytics/summary').then(setSummary).catch(() => undefined);
    api
      .get<any[]>('/analytics/revenue')
      .then((d) =>
        setRevenue(
          d.map((r) => ({
            day: new Date(r.day).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }),
            revenue: r.revenue,
          })),
        ),
      )
      .catch(() => undefined);
    api.get<{ data: OrderRow[] }>('/orders?pageSize=6').then((r) => setRecent(r.data)).catch(() => undefined);
    api.get<any[]>('/analytics/top-products').then((d) => setProducts(d.slice(0, 5))).catch(() => undefined);
  }, []);

  const stats = summary
    ? [
        { label: 'Revenue (30d)', value: formatMoney(summary.revenue), icon: TrendingUp, tint: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-500/15 dark:text-emerald-400' },
        { label: 'Orders (30d)', value: summary.orderCount, icon: ShoppingBag, tint: 'text-blue-600 bg-blue-50 dark:bg-blue-500/15 dark:text-blue-400' },
        { label: 'Pending Review', value: summary.pendingReview, icon: ClipboardCheck, tint: 'text-amber-600 bg-amber-50 dark:bg-amber-500/15 dark:text-amber-400', href: '/admin/approvals' },
        { label: 'Delivered', value: summary.delivered, icon: PackageCheck, tint: 'text-violet-600 bg-violet-50 dark:bg-violet-500/15 dark:text-violet-400' },
        { label: 'Return Rate', value: `${(summary.returnRate * 100).toFixed(1)}%`, icon: RotateCcw, tint: 'text-rose-600 bg-rose-50 dark:bg-rose-500/15 dark:text-rose-400' },
      ]
    : [];

  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard" subtitle="Performance overview — last 30 days" />

      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {stats.map((s) => {
          const Icon = s.icon;
          const inner = (
            <Card className="p-5 transition hover:shadow-md">
              <div className={`mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl ${s.tint}`}>
                <Icon size={20} />
              </div>
              <div className="text-2xl font-bold tracking-tight text-slate-900 tabular-nums dark:text-white">{s.value}</div>
              <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">{s.label}</div>
            </Card>
          );
          return s.href ? (
            <Link key={s.label} href={s.href}>
              {inner}
            </Link>
          ) : (
            <div key={s.label}>{inner}</div>
          );
        })}
        {!summary && <p className="text-sm text-slate-400">Loading metrics…</p>}
      </div>

      {/* Revenue chart */}
      <Card className="p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-semibold text-slate-800 dark:text-slate-200">Revenue</h3>
          <span className="text-xs text-slate-400 dark:text-slate-500">Last 30 days</span>
        </div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={revenue} margin={{ left: -10, right: 8 }}>
              <defs>
                <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={C.line} stopOpacity={0.25} />
                  <stop offset="100%" stopColor={C.line} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={C.grid} vertical={false} />
              <XAxis dataKey="day" fontSize={11} tickLine={false} axisLine={false} stroke={C.axis} />
              <YAxis fontSize={11} tickLine={false} axisLine={false} stroke={C.axis} width={56} />
              <Tooltip
                contentStyle={{ borderRadius: 12, border: `1px solid ${C.tooltipBorder}`, background: C.tooltipBg, fontSize: 12 }}
                formatter={(v: number) => [formatMoney(v), 'Revenue']}
              />
              <Area type="monotone" dataKey="revenue" stroke={C.line} strokeWidth={2.5} fill="url(#rev)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Recent orders + Top products */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-semibold text-slate-800 dark:text-slate-200">Recent orders</h3>
            <Link href="/admin/orders" className="text-xs font-medium text-brand hover:underline dark:text-slate-300">
              View all →
            </Link>
          </div>
          <div className="space-y-1">
            {recent.map((o) => (
              <Link
                key={o.id}
                href={`/admin/orders/${o.id}`}
                className="flex items-center justify-between rounded-lg px-2 py-2.5 hover:bg-slate-50 dark:hover:bg-white/5"
              >
                <div className="flex items-center gap-3">
                  <span className="font-medium text-brand dark:text-white">{o.orderNumber}</span>
                  <span className="text-sm text-slate-600 dark:text-slate-400">
                    {[o.customer?.firstName, o.customer?.lastName].filter(Boolean).join(' ') || '—'}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm tabular-nums text-slate-700 dark:text-slate-300">{formatMoney(o.grandTotal, o.currency)}</span>
                  <StatusBadge status={o.status} />
                </div>
              </Link>
            ))}
            {recent.length === 0 && <p className="px-2 py-8 text-center text-sm text-slate-400 dark:text-slate-500">No orders yet</p>}
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="mb-4 font-semibold text-slate-800 dark:text-slate-200">Top products</h3>
          <div className="flex h-56 items-center justify-center">
            {products.length === 0 ? (
              <p className="text-sm text-slate-400 dark:text-slate-500">No sales data yet</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={products} layout="vertical" margin={{ left: 8, right: 8 }}>
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="name" width={140} fontSize={11} tickLine={false} axisLine={false} stroke={C.axis} />
                  <Tooltip contentStyle={{ borderRadius: 12, border: `1px solid ${C.tooltipBorder}`, background: C.tooltipBg, fontSize: 12 }} cursor={{ fill: dark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)' }} />
                  <Bar dataKey="unitsSold" fill={C.line} radius={[0, 6, 6, 0]} barSize={18} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
