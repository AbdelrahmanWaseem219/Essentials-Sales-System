'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api, tokens } from '@/lib/api';
import { Button, Card, Input, StatusBadge } from '@/components/ui';
import { Logo } from '@/components/logo';
import { ThemeToggle } from '@/components/theme-toggle';
import { formatDate, formatMoney } from '@/lib/utils';

interface PortalOrder {
  id: string;
  orderNumber: string;
  status: string;
  currency: string;
  grandTotal: string;
  placedAt: string;
  shipments: { trackingNumber?: string; publicToken?: string }[];
}

export default function PortalPage() {
  const [authed, setAuthed] = useState(false);
  const [orders, setOrders] = useState<PortalOrder[]>([]);
  const [email, setEmail] = useState('customer@example.com');
  const [password, setPassword] = useState('Password123!');
  const [error, setError] = useState('');

  function loadOrders() {
    api
      .get<PortalOrder[]>('/portal/orders')
      .then((d) => {
        setOrders(d);
        setAuthed(true);
      })
      .catch(() => setAuthed(false));
  }

  useEffect(() => {
    if (tokens.access) loadOrders();
  }, []);

  async function login(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    try {
      const res = await api.post<{ accessToken: string; refreshToken: string }>(
        '/auth/customer/login',
        { email, password },
      );
      tokens.set(res.accessToken, res.refreshToken);
      loadOrders();
    } catch (err: any) {
      setError(err.message);
    }
  }

  if (!authed) {
    return (
      <main className="relative flex min-h-screen items-center justify-center bg-gradient-to-b from-white via-brand-50 to-brand-100 px-6 dark:from-brand-950 dark:via-brand-950 dark:to-brand-900">
        <Link
          href="/"
          className="absolute left-5 top-5 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
        >
          <ArrowLeft size={16} /> Back to home
        </Link>
        <ThemeToggle className="absolute right-5 top-5" />
        <div className="w-full max-w-sm">
          <div className="mb-6 flex justify-center">
            <Link href="/" aria-label="Essentials Egypt — home">
              <Logo />
            </Link>
          </div>
          <Card className="p-8">
          <h1 className="text-lg font-bold text-slate-900 dark:text-white">My Account</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">View your orders, invoices & shipments</p>
          <form onSubmit={login} className="mt-6 space-y-4">
            <Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="Email" />
            <Input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              placeholder="Password"
            />
            {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
            <Button className="w-full">Sign in</Button>
          </form>
          </Card>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">My Orders</h1>
        <div className="flex items-center gap-3">
          <button
            className="text-sm text-slate-500 hover:underline dark:text-slate-400"
            onClick={() => {
              tokens.clear();
              setAuthed(false);
            }}
          >
            Sign out
          </button>
          <ThemeToggle />
        </div>
      </div>

      <div className="mt-6 space-y-4">
        {orders.map((o) => (
          <Card key={o.id} className="flex items-center justify-between p-5">
            <div>
              <div className="flex items-center gap-2 font-semibold text-slate-900 dark:text-white">
                {o.orderNumber} <StatusBadge status={o.status} />
              </div>
              <div className="text-sm text-slate-500 dark:text-slate-400">{formatDate(o.placedAt)}</div>
            </div>
            <div className="flex items-center gap-4">
              <span className="font-medium text-slate-800 dark:text-slate-200">{formatMoney(o.grandTotal, o.currency)}</span>
              {o.shipments[0]?.publicToken && (
                <Link
                  href={`/track?token=${o.shipments[0].publicToken}`}
                  className="text-sm text-brand hover:underline dark:text-white"
                >
                  Track
                </Link>
              )}
            </div>
          </Card>
        ))}
        {orders.length === 0 && <p className="text-slate-400 dark:text-slate-500">You have no orders yet.</p>}
      </div>
    </main>
  );
}
