import Link from 'next/link';
import { ArrowRight, LayoutDashboard, MapPin, ShoppingBag } from 'lucide-react';
import { DoveMark, Logo } from '@/components/logo';

const TILES = [
  {
    href: '/login',
    title: 'Staff Workspace',
    desc: 'Orders, approvals & analytics',
    icon: LayoutDashboard,
  },
  {
    href: '/portal',
    title: 'Customer Portal',
    desc: 'Orders, invoices & payments',
    icon: ShoppingBag,
  },
  { href: '/track', title: 'Track Order', desc: 'Public shipment tracking', icon: MapPin },
];

export default function Home() {
  return (
    <main className="relative flex min-h-screen flex-col overflow-hidden bg-brand-950 text-white">
      {/* Ambient brand glow — an ethereal cool-white halo echoing the logo's dove,
          plus a faint dot grid for depth. Decorative only (pointer-events-none). */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-[-10%] h-[55vh] w-[55vh] -translate-x-1/2 rounded-full bg-white/10 blur-[120px] animate-glow-pulse" />
        <div className="absolute bottom-[-15%] right-[-5%] h-[40vh] w-[40vh] rounded-full bg-sky-200/5 blur-[120px]" />
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              'radial-gradient(circle at 1px 1px, white 1px, transparent 0)',
            backgroundSize: '32px 32px',
          }}
        />
      </div>

      {/* Top bar */}
      <header className="relative z-10 flex items-center justify-between px-5 py-5 sm:px-8">
        <Logo variant="light" />
        <Link
          href="/login"
          className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-sm font-medium text-white/80 backdrop-blur transition hover:border-white/30 hover:text-white"
        >
          Staff sign in <ArrowRight size={14} />
        </Link>
      </header>

      {/* Hero */}
      <section className="relative z-10 mx-auto flex w-full max-w-5xl flex-1 flex-col items-center justify-center px-6 py-12 text-center">
        {/* Animated dove with glow */}
        <div className="relative mb-8 animate-fade-up">
          <div
            aria-hidden
            className="absolute left-1/2 top-1/2 h-44 w-44 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/20 blur-3xl animate-glow-pulse"
          />
          <DoveMark className="relative h-24 w-32 animate-float text-white drop-shadow-[0_8px_40px_rgba(255,255,255,0.25)] sm:h-28 sm:w-40" />
        </div>

        <h1 className="animate-fade-up text-4xl font-bold uppercase tracking-[0.18em] sm:text-6xl">
          Essentials
        </h1>
        <p className="mt-2 animate-fade-up text-sm font-semibold uppercase tracking-[0.5em] text-white/50 sm:text-base">
          Egypt
        </p>

        <p className="mt-7 max-w-xl animate-fade-up text-base leading-relaxed text-white/60 sm:text-lg">
          The command center for sales operations — orders, customers, payments and shipments,
          seamlessly connected to <span className="text-white/90">Shopify</span>,{' '}
          <span className="text-white/90">Odoo Inventory</span> and{' '}
          <span className="text-white/90">Bosta</span>.
        </p>

        {/* Entry tiles */}
        <div className="mt-14 grid w-full animate-fade-up gap-4 sm:grid-cols-3">
          {TILES.map(({ href, title, desc, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] p-6 text-left backdrop-blur-sm transition duration-300 hover:-translate-y-1 hover:border-white/25 hover:bg-white/[0.07]"
            >
              <div className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white/80 transition group-hover:bg-white group-hover:text-brand-950">
                <Icon size={22} />
              </div>
              <div className="flex items-center justify-between">
                <div className="text-base font-semibold text-white">{title}</div>
                <ArrowRight
                  size={16}
                  className="text-white/30 transition-transform duration-300 group-hover:translate-x-1 group-hover:text-white"
                />
              </div>
              <div className="mt-1 text-sm text-white/50">{desc}</div>
            </Link>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/5 py-6 text-center text-xs tracking-wide text-white/30">
        © Essentials Egypt · Sales Management System
      </footer>
    </main>
  );
}
