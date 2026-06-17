'use client';

import { useEffect, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { api } from '@/lib/api';
import { Card, PageHeader } from '@/components/ui';
import { useIsDark, chartPalette } from '@/components/theme-toggle';
import { formatMoney } from '@/lib/utils';

export default function AnalyticsPage() {
  const dark = useIsDark();
  const C = chartPalette(dark); // shared theme-aware chart colors
  const [revenue, setRevenue] = useState<{ day: string; revenue: number; orders: number }[]>([]);
  const [topCustomers, setTopCustomers] = useState<any[]>([]);
  const [topProducts, setTopProducts] = useState<any[]>([]);

  useEffect(() => {
    api.get<any[]>('/analytics/revenue').then((d) =>
      setRevenue(d.map((r) => ({ ...r, day: new Date(r.day).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) }))),
    );
    api.get<any[]>('/analytics/top-customers').then(setTopCustomers);
    api.get<any[]>('/analytics/top-products').then(setTopProducts);
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader title="Analytics" subtitle="Revenue, top customers & products" />

      <Card className="p-5">
        <h2 className="font-semibold text-slate-800 dark:text-slate-200">Revenue (last 30 days)</h2>
        <div className="mt-4 h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={revenue}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.grid} />
              <XAxis dataKey="day" fontSize={12} stroke={C.axis} />
              <YAxis fontSize={12} stroke={C.axis} />
              <Tooltip contentStyle={{ background: C.tooltipBg, border: `1px solid ${C.tooltipBorder}`, borderRadius: 12, fontSize: 12 }} />
              <Line type="monotone" dataKey="revenue" stroke={C.line} strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="font-semibold text-slate-800 dark:text-slate-200">Top Customers</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {topCustomers.map((t, i) => (
              <li key={i} className="flex justify-between text-slate-600 dark:text-slate-400">
                <span>
                  {[t.customer?.firstName, t.customer?.lastName].filter(Boolean).join(' ') ||
                    t.customer?.email ||
                    'Unknown'}
                </span>
                <span className="font-medium text-slate-800 dark:text-slate-200">{formatMoney(t.totalSpent)}</span>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="p-5">
          <h2 className="font-semibold text-slate-800 dark:text-slate-200">Top Products</h2>
          <div className="mt-4 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topProducts} layout="vertical">
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="name" width={120} fontSize={11} stroke={C.axis} />
                <Tooltip contentStyle={{ background: C.tooltipBg, border: `1px solid ${C.tooltipBorder}`, borderRadius: 12, fontSize: 12 }} cursor={{ fill: dark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)' }} />
                <Bar dataKey="unitsSold" fill={C.line} radius={4} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
    </div>
  );
}
