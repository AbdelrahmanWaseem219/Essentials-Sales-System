'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, RefreshCw, Database, Server, ShoppingBag, Users, Truck, Inbox } from 'lucide-react';
import { Logo } from '@/components/logo';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? '/api';
const REFRESH_MS = 10_000;

type Health = {
  status: 'ok' | 'degraded';
  db: 'ok' | 'down';
  redis: 'ok' | 'down';
  uptimeSeconds: number;
  counts: {
    orders: number | null;
    customers: number | null;
    shipments: number | null;
    unprocessedWebhooks: number | null;
  };
  ts: string;
};

/** Human-friendly uptime, e.g. "3d 4h 12m" or "8m 5s". */
function formatUptime(s: number): string {
  if (!Number.isFinite(s) || s < 0) return '—';
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  if (d) return `${d}d ${h}h ${m}m`;
  if (h) return `${h}h ${m}m`;
  if (m) return `${m}m ${sec}s`;
  return `${sec}s`;
}

export default function StatusPage() {
  const [data, setData] = useState<Health | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [lastChecked, setLastChecked] = useState<string>('');

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/health/stats`, { cache: 'no-store' });
      if (!res.ok) throw new Error();
      setData(await res.json());
      setError(false);
    } catch {
      setError(true);
      setData(null);
    } finally {
      setLoading(false);
      setLastChecked(new Date().toLocaleTimeString());
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, REFRESH_MS);
    return () => clearInterval(id);
  }, [load]);

  // The server is unreachable entirely (API down) — distinct from "degraded".
  const apiDown = error || (!loading && !data);
  const overallOk = data?.status === 'ok' && !apiDown;

  return (
    <main className="relative flex min-h-screen flex-col overflow-hidden bg-brand-950 text-white">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-[-10%] h-[45vh] w-[45vh] -translate-x-1/2 rounded-full bg-white/10 blur-[120px]" />
      </div>

      {/* Top bar */}
      <header className="relative z-10 flex items-center justify-between px-5 py-5 sm:px-8">
        <Logo variant="light" />
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-sm font-medium text-white/80 backdrop-blur transition hover:border-white/30 hover:text-white"
        >
          <ArrowLeft size={14} /> Back to home
        </Link>
      </header>

      <section className="relative z-10 mx-auto w-full max-w-4xl flex-1 px-6 py-8">
        <div className="mb-8 flex flex-col gap-1">
          <h1 className="text-2xl font-bold sm:text-3xl">System Status</h1>
          <p className="text-sm text-white/50">
            Live health of the Essentials Sales System. Refreshes automatically every 10 seconds.
          </p>
        </div>

        {/* Overall banner */}
        <div
          className={`mb-8 flex items-center justify-between rounded-2xl border p-5 ${
            apiDown
              ? 'border-rose-500/30 bg-rose-500/10'
              : overallOk
                ? 'border-emerald-500/30 bg-emerald-500/10'
                : 'border-amber-500/30 bg-amber-500/10'
          }`}
        >
          <div className="flex items-center gap-3">
            <span className="relative flex h-3 w-3">
              <span
                className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${
                  apiDown ? 'bg-rose-400' : overallOk ? 'bg-emerald-400' : 'bg-amber-400'
                }`}
              />
              <span
                className={`relative inline-flex h-3 w-3 rounded-full ${
                  apiDown ? 'bg-rose-500' : overallOk ? 'bg-emerald-500' : 'bg-amber-500'
                }`}
              />
            </span>
            <span className="text-lg font-semibold">
              {loading
                ? 'Checking…'
                : apiDown
                  ? 'System unreachable'
                  : overallOk
                    ? 'All systems operational'
                    : 'Degraded — running with limits'}
            </span>
          </div>
          <button
            onClick={load}
            className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-sm text-white/70 transition hover:text-white"
          >
            <RefreshCw size={14} /> Refresh
          </button>
        </div>

        {/* Dependencies */}
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-white/40">
          Core services
        </h2>
        <div className="mb-8 grid gap-4 sm:grid-cols-2">
          <DependencyCard
            icon={Database}
            label="Database (PostgreSQL)"
            hint="Where all orders & customers are stored"
            state={apiDown ? 'down' : (data?.db ?? 'down')}
          />
          <DependencyCard
            icon={Server}
            label="Cache & queue (Redis)"
            hint="Fast scratchpad for background jobs"
            state={apiDown ? 'down' : (data?.redis ?? 'down')}
          />
        </div>

        {/* Live counts */}
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-white/40">
          Live data
        </h2>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard icon={ShoppingBag} label="Orders" value={data?.counts.orders} />
          <StatCard icon={Users} label="Customers" value={data?.counts.customers} />
          <StatCard icon={Truck} label="Shipments" value={data?.counts.shipments} />
          <StatCard
            icon={Inbox}
            label="Unprocessed webhooks"
            value={data?.counts.unprocessedWebhooks}
            warnIfPositive
          />
        </div>

        {/* Footer meta */}
        <div className="mt-8 flex flex-wrap items-center justify-between gap-2 text-xs text-white/40">
          <span>Uptime: {data ? formatUptime(data.uptimeSeconds) : '—'}</span>
          <span>{lastChecked ? `Last checked ${lastChecked}` : ''}</span>
        </div>
      </section>
    </main>
  );
}

function DependencyCard({
  icon: Icon,
  label,
  hint,
  state,
}: {
  icon: typeof Database;
  label: string;
  hint: string;
  state: 'ok' | 'down';
}) {
  const ok = state === 'ok';
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.04] p-5">
      <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white/80">
        <Icon size={20} />
      </div>
      <div className="flex-1">
        <div className="font-medium">{label}</div>
        <div className="text-xs text-white/40">{hint}</div>
      </div>
      <span
        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
          ok ? 'bg-emerald-500/15 text-emerald-300' : 'bg-rose-500/15 text-rose-300'
        }`}
      >
        <span className={`h-1.5 w-1.5 rounded-full ${ok ? 'bg-emerald-400' : 'bg-rose-400'}`} />
        {ok ? 'Online' : 'Down'}
      </span>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  warnIfPositive,
}: {
  icon: typeof Database;
  label: string;
  value: number | null | undefined;
  warnIfPositive?: boolean;
}) {
  const unknown = value === null || value === undefined;
  const warn = warnIfPositive && typeof value === 'number' && value > 0;
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
      <Icon size={18} className="mb-3 text-white/40" />
      <div className={`text-2xl font-bold ${warn ? 'text-amber-300' : 'text-white'}`}>
        {unknown ? '—' : value.toLocaleString()}
      </div>
      <div className="mt-0.5 text-xs text-white/40">{label}</div>
    </div>
  );
}
