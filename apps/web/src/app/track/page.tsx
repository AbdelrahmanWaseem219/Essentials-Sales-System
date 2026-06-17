'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  Home,
  type LucideIcon,
  MapPin,
  Package,
  PackageCheck,
  Search,
  ShoppingBag,
  Truck,
} from 'lucide-react';
import { trackApi } from '@/lib/api';
import { Button, Card, Input } from '@/components/ui';
import { Logo } from '@/components/logo';
import { SelectMenu } from '@/components/select-menu';
import { ThemeToggle } from '@/components/theme-toggle';
import { cn, formatDate } from '@/lib/utils';

interface TimelineStep {
  step: string;
  label: string;
  reached: boolean;
  active: boolean;
}
interface TrackResult {
  orderNumber: string;
  courier: string | null;
  trackingNumber: string | null;
  trackingUrl?: string;
  status: string;
  currentLocation: string | null;
  estimatedDeliveryAt: string | null;
  publicToken?: string;
  timeline: TimelineStep[];
  history: { status: string; description?: string; location?: string; at: string }[];
}

// Stage → icon, so each step reads at a glance (like big-retailer trackers).
const STEP_ICON: Record<string, LucideIcon> = {
  ORDER_RECEIVED: ShoppingBag,
  APPROVED: CheckCircle2,
  PROCESSING: Package,
  SHIPPED: PackageCheck,
  IN_TRANSIT: Truck,
  OUT_FOR_DELIVERY: MapPin,
  DELIVERED: Home,
};

// Customer-friendly headline per status (fallback to the formatted status).
const HEADLINE: Record<string, string> = {
  PENDING_REVIEW: 'Order received',
  APPROVED: 'Order confirmed',
  PROCESSING: 'Preparing your order',
  SENT_TO_ODOO: 'Preparing your order',
  SHIPPED: 'Your order has shipped',
  PICKED_UP: 'Arrived at our warehouse',
  IN_TRANSIT: 'On its way to you',
  OUT_FOR_DELIVERY: 'Out for delivery',
  DELIVERED: 'Delivered',
  RETURNED: 'Order returned',
  ON_HOLD: 'On hold',
  CANCELLED: 'Order cancelled',
};

// A fabricated order used only for the "View a sample" demo button — lets a
// visitor see the full tracking experience without a real order/tracking number.
// Pure client-side data, so it also works on a static (no-backend) deploy.
const DEMO_RESULT: TrackResult = {
  orderNumber: 'ES-10342',
  courier: 'BOSTA',
  trackingNumber: 'EG-48213706',
  status: 'OUT_FOR_DELIVERY',
  currentLocation: 'Nasr City, Cairo',
  estimatedDeliveryAt: null,
  publicToken: undefined, // no token → no live SSE connection for the demo
  timeline: [
    { step: 'ORDER_RECEIVED', label: 'Order Received', reached: true, active: false },
    { step: 'APPROVED', label: 'Approved', reached: true, active: false },
    { step: 'PROCESSING', label: 'Processing', reached: true, active: false },
    { step: 'SHIPPED', label: 'Shipped', reached: true, active: false },
    { step: 'IN_TRANSIT', label: 'In Transit', reached: true, active: false },
    { step: 'OUT_FOR_DELIVERY', label: 'Out For Delivery', reached: true, active: true },
    { step: 'DELIVERED', label: 'Delivered', reached: false, active: false },
  ],
  history: [
    { status: 'CREATED', description: 'Shipment created', at: '2026-06-13T09:12:00Z' },
    { status: 'PICKED_UP', description: 'Received at warehouse', location: 'Cairo Sorting Hub', at: '2026-06-13T15:40:00Z' },
    { status: 'IN_TRANSIT', description: 'In transit', location: 'Giza Hub', at: '2026-06-14T08:05:00Z' },
    { status: 'OUT_FOR_DELIVERY', description: 'Out for delivery', location: 'Nasr City, Cairo', at: '2026-06-14T10:30:00Z' },
  ],
};

export default function TrackPage() {
  return (
    <Suspense
      fallback={<main className="mx-auto max-w-2xl px-6 py-12 text-slate-400">Loading…</main>}
    >
      <TrackInner />
    </Suspense>
  );
}

function TrackInner() {
  const params = useSearchParams();
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<'trackingNumber' | 'orderNumber'>('trackingNumber');
  const [result, setResult] = useState<TrackResult | null>(null);
  const [error, setError] = useState('');
  const [live, setLive] = useState(false);
  const [isDemo, setIsDemo] = useState(false);

  async function lookup(by: Record<string, string>) {
    setError('');
    setIsDemo(false);
    try {
      setResult(await trackApi.lookup(by));
    } catch {
      setError('No order found. Check your tracking or order number.');
      setResult(null);
    }
  }

  // Deep-link: /track?token=... opens directly.
  useEffect(() => {
    const token = params.get('token');
    if (token) lookup({ token });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Live updates via SSE once we have a public token.
  useEffect(() => {
    if (!result?.publicToken) return;
    const es = new EventSource(trackApi.streamUrl(result.publicToken));
    es.onopen = () => setLive(true);
    es.onmessage = () => lookup({ token: result.publicToken! });
    es.onerror = () => setLive(false);
    return () => {
      es.close();
      setLive(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result?.publicToken]);

  // Progress %: how far through the steps the order has reached.
  const reachedIdx = result ? result.timeline.reduce((a, s, i) => (s.reached ? i : a), -1) : -1;
  const percent =
    result && result.timeline.length > 1
      ? Math.max(0, (reachedIdx / (result.timeline.length - 1)) * 100)
      : 0;

  // Collapse consecutive identical updates (the courier can repeat a status), newest first.
  const updates = result
    ? result.history
        .filter(
          (h, i, a) => i === 0 || !(a[i - 1].status === h.status && a[i - 1].location === h.location),
        )
        .slice()
        .reverse()
    : [];

  const headline = result
    ? result.estimatedDeliveryAt
      ? `Arriving ${formatDate(result.estimatedDeliveryAt)}`
      : (HEADLINE[result.status] ?? result.status.replace(/_/g, ' '))
    : '';

  return (
    <main className="relative mx-auto max-w-2xl px-5 py-10 sm:px-6">
      <Link
        href="/"
        className="absolute left-5 top-5 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
      >
        <ArrowLeft size={16} /> Back to home
      </Link>
      <ThemeToggle className="absolute right-5 top-5" />
      <div className="mb-8 flex justify-center">
        <Link href="/" aria-label="Essentials Egypt — home">
          <Logo />
        </Link>
      </div>
      <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
        Track your order
      </h1>
      <p className="mt-1 text-slate-500 dark:text-slate-400">
        Enter your tracking number or order number below.
      </p>

      <form
        className="mt-6 flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          lookup({ [mode]: query });
        }}
      >
        <SelectMenu
          value={mode}
          onChange={(v) => setMode(v as 'trackingNumber' | 'orderNumber')}
          options={[
            { value: 'trackingNumber', label: 'Tracking #' },
            { value: 'orderNumber', label: 'Order #' },
          ]}
          className="w-32 shrink-0"
        />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="e.g. 1234567 or ES-10001"
          className="flex-1"
        />
        <Button>
          <Search size={15} /> Track
        </Button>
      </form>

      <button
        type="button"
        onClick={() => {
          setError('');
          setIsDemo(true);
          setResult(DEMO_RESULT);
        }}
        className="mt-3 text-sm font-medium text-slate-500 underline-offset-4 transition hover:text-slate-900 hover:underline dark:text-slate-400 dark:hover:text-white"
      >
        Or view a sample order (demo) →
      </button>

      {error && (
        <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600 dark:bg-red-500/10 dark:text-red-400">
          {error}
        </p>
      )}

      {result && (
        <div className="mt-8 space-y-5">
          {/* Status hero */}
          <Card className="overflow-hidden p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  Order {result.orderNumber}
                  {isDemo && (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-500/15 dark:text-amber-400">
                      Sample
                    </span>
                  )}
                </div>
                <div className="mt-1 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                  {headline}
                </div>
                {result.currentLocation && (
                  <div className="mt-2 flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400">
                    <MapPin size={15} className="shrink-0" />
                    {result.currentLocation}
                  </div>
                )}
              </div>
              <div className="shrink-0 text-right">
                {result.courier && (
                  <div className="text-xs font-medium uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    {result.courier}
                  </div>
                )}
                {result.trackingNumber && (
                  <div className="mt-0.5 font-mono text-sm text-slate-700 dark:text-slate-200">
                    {result.trackingNumber}
                  </div>
                )}
                {live && (
                  <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
                      <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    </span>
                    Live
                  </div>
                )}
              </div>
            </div>

            {/* Progress bar */}
            <div className="mt-5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-white/10">
              <div
                className="h-full rounded-full bg-brand transition-all duration-500 dark:bg-white"
                style={{ width: `${percent}%` }}
              />
            </div>
          </Card>

          {/* Timeline — horizontal stepper. Full-width equal columns so it always
              fits and stays centered (no scrollbar). Labels show on sm+; on phones
              the icon stepper stays clean and the current stage is named below. */}
          <Card className="px-4 py-6 sm:px-6">
            <div className="flex">
              {result.timeline.map((s, i) => {
                const Icon = STEP_ICON[s.step] ?? Package;
                const last = i === result.timeline.length - 1;
                const nextReached = !last && result.timeline[i + 1].reached;
                return (
                  <div key={s.step} className="relative flex flex-1 flex-col items-center">
                    {/* horizontal connector from this node to the next */}
                    {!last && (
                      <span
                        className={cn(
                          'absolute left-1/2 top-4 z-0 h-0.5 w-full -translate-y-1/2',
                          nextReached ? 'bg-brand dark:bg-white' : 'bg-slate-200 dark:bg-white/10',
                        )}
                      />
                    )}
                    {/* node */}
                    <div className="relative z-10">
                      {s.active && (
                        <span className="absolute inset-0 animate-ping rounded-full bg-brand/25 dark:bg-white/25" />
                      )}
                      <span
                        className={cn(
                          'relative flex h-8 w-8 items-center justify-center rounded-full border transition-colors',
                          s.reached
                            ? 'border-transparent bg-brand text-white dark:bg-white dark:text-brand-950'
                            : 'border-slate-200 bg-white text-slate-300 dark:border-white/15 dark:bg-brand-900 dark:text-slate-600',
                          s.active && 'ring-4 ring-brand/15 dark:ring-white/15',
                        )}
                      >
                        {s.reached && !s.active ? <Check size={15} /> : <Icon size={15} />}
                      </span>
                    </div>
                    {/* label (hidden on phones to keep it clean & centered) */}
                    <div
                      className={cn(
                        'mt-2 hidden px-0.5 text-center text-[11px] leading-tight sm:block',
                        s.active
                          ? 'font-semibold text-slate-900 dark:text-white'
                          : s.reached
                            ? 'font-medium text-slate-600 dark:text-slate-300'
                            : 'text-slate-400 dark:text-slate-500',
                      )}
                    >
                      {s.label}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* phones: name the current stage once, centered, under the stepper */}
            <div className="mt-4 text-center text-sm font-semibold text-slate-900 dark:text-white sm:hidden">
              {result.timeline.find((x) => x.active)?.label ?? result.status.replace(/_/g, ' ')}
            </div>
          </Card>

          {/* Updates feed */}
          {updates.length > 0 && (
            <Card className="p-6">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                Tracking history
              </h2>
              <ul className="mt-4 space-y-4">
                {updates.map((h, i) => (
                  <li key={`${h.at}-${h.status}-${h.location ?? ''}`} className="flex gap-3">
                    <span
                      className={cn(
                        'mt-1.5 h-2 w-2 shrink-0 rounded-full',
                        i === 0 ? 'bg-brand dark:bg-white' : 'bg-slate-300 dark:bg-white/20',
                      )}
                    />
                    <div className="flex flex-1 flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5">
                      <div className="text-sm font-medium text-slate-800 dark:text-slate-200">
                        {h.status.replace(/_/g, ' ')}
                        {h.location && (
                          <span className="font-normal text-slate-500 dark:text-slate-400">
                            {' '}
                            — {h.location}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-400 dark:text-slate-500">
                        {formatDate(h.at)}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      )}
    </main>
  );
}
