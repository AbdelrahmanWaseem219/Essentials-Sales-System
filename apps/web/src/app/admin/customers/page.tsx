'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Card, Input, PageHeader } from '@/components/ui';
import { formatDate } from '@/lib/utils';

interface CustomerRow {
  id: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  createdAt: string;
  _count: { orders: number };
}

export default function CustomersPage() {
  const [search, setSearch] = useState('');
  const [rows, setRows] = useState<CustomerRow[]>([]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    const t = setTimeout(() => {
      api
        .get<{ data: CustomerRow[] }>(`/customers?${params}`)
        .then((r) => setRows(r.data))
        .catch(() => setRows([]));
    }, 250);
    return () => clearTimeout(t);
  }, [search]);

  return (
    <div>
      <PageHeader title="Customers" subtitle="Profiles, contact details & order history" />
      <Input
        placeholder="Search name, email or phone…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="mb-4 max-w-xs"
      />
      <Card className="mt-4 overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-slate-50 text-left text-slate-500 dark:bg-white/[0.03] dark:text-slate-400">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Phone</th>
              <th className="px-4 py-3">Orders</th>
              <th className="px-4 py-3">Joined</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id} className="border-t border-slate-100 hover:bg-slate-50 dark:border-white/10 dark:hover:bg-white/[0.04]">
                <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-200">
                  {[c.firstName, c.lastName].filter(Boolean).join(' ') || '—'}
                </td>
                <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{c.email ?? '—'}</td>
                <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{c.phone ?? '—'}</td>
                <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{c._count.orders}</td>
                <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{formatDate(c.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </Card>
    </div>
  );
}
