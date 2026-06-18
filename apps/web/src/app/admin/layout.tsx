'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  BarChart3,
  ClipboardCheck,
  CreditCard,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  Truck,
  Users,
  X,
} from 'lucide-react';
import { api, tokens } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Logo } from '@/components/logo';
import { ThemeToggle } from '@/components/theme-toggle';
import { ToastProvider } from '@/components/toast';

const NAV = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/orders', label: 'Orders', icon: Package },
  { href: '/admin/approvals', label: 'Approval Queue', icon: ClipboardCheck },
  { href: '/admin/customers', label: 'Customers', icon: Users },
  { href: '/admin/payments', label: 'Payments', icon: CreditCard },
  { href: '/admin/shipments', label: 'Shipments', icon: Truck },
  { href: '/admin/analytics', label: 'Analytics', icon: BarChart3 },
];

interface Me {
  name: string;
  email: string;
  role: string;
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  // Mobile off-canvas sidebar state. On lg+ the sidebar is always visible and
  // this flag is ignored; below lg it slides the drawer in/out.
  const [navOpen, setNavOpen] = useState(false);

  useEffect(() => {
    if (!tokens.access) {
      router.replace('/login');
      return;
    }
    api.get<Me>('/users/me').then(setMe).catch(() => undefined);

    // If a session expires mid-use (refresh fails), redirect to login instead of
    // leaving the dashboard hanging on empty data.
    const onExpired = () => router.replace('/login');
    window.addEventListener('auth-expired', onExpired);
    return () => window.removeEventListener('auth-expired', onExpired);
  }, [router]);

  // Close the mobile drawer whenever the route changes (after tapping a link).
  useEffect(() => {
    setNavOpen(false);
  }, [pathname]);

  const current = NAV.slice().reverse().find((n) => pathname.startsWith(n.href));

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-brand-950">
      {/* Backdrop — only on mobile while the drawer is open */}
      {navOpen && (
        <div
          onClick={() => setNavOpen(false)}
          className="fixed inset-0 z-30 bg-black/40 backdrop-blur-sm lg:hidden"
          aria-hidden
        />
      )}

      {/* Sidebar: off-canvas drawer < lg, fixed rail at lg+ */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex w-60 flex-col border-r border-slate-200 bg-white transition-transform duration-300 dark:border-white/10 dark:bg-brand-900 lg:translate-x-0',
          navOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        )}
      >
        <div className="flex h-16 items-center justify-between border-b border-slate-100 px-5 dark:border-white/10">
          <Logo />
          {/* Close button — mobile only */}
          <button
            onClick={() => setNavOpen(false)}
            className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10 lg:hidden"
            aria-label="Close menu"
          >
            <X size={18} />
          </button>
        </div>
        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
          <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            Operations
          </p>
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = href === '/admin' ? pathname === '/admin' : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  active
                    ? 'bg-brand text-white shadow-sm dark:bg-white dark:text-brand-950'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white',
                )}
              >
                <Icon size={17} strokeWidth={2} />
                {label}
              </Link>
            );
          })}
        </nav>

        {/* User chip */}
        <div className="border-t border-slate-100 p-3 dark:border-white/10">
          <div className="flex items-center gap-3 rounded-lg px-2 py-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand/10 text-sm font-semibold text-brand dark:bg-white/10 dark:text-white">
              {(me?.name ?? 'U').slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium text-slate-800 dark:text-slate-200">{me?.name ?? '—'}</div>
              <div className="truncate text-xs text-slate-400 dark:text-slate-500">
                {me?.role?.replace(/_/g, ' ').toLowerCase() ?? ''}
              </div>
            </div>
            <button
              onClick={() => {
                tokens.clear();
                router.replace('/login');
              }}
              title="Sign out"
              className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-white/10 dark:hover:text-slate-200"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main — no left margin on mobile, rail-width margin at lg+ */}
      <div className="flex min-h-screen flex-1 flex-col lg:ml-60">
        <header className="sticky top-0 z-10 flex h-16 items-center justify-between gap-3 border-b border-slate-200 bg-white/80 px-4 backdrop-blur dark:border-white/10 dark:bg-brand-900/80 sm:px-8">
          <div className="flex items-center gap-3">
            {/* Hamburger — mobile only */}
            <button
              onClick={() => setNavOpen(true)}
              className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-white/10 lg:hidden"
              aria-label="Open menu"
            >
              <Menu size={20} />
            </button>
            <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400">
              {current?.label ?? 'Admin'}
            </h2>
          </div>
          <div className="flex items-center gap-4">
            <a
              href="https://www.essentials-egy.com"
              target="_blank"
              rel="noreferrer"
              className="hidden text-xs font-medium text-brand hover:underline dark:text-slate-300 sm:inline"
            >
              View store ↗
            </a>
            <ThemeToggle />
          </div>
        </header>
        <main className="flex-1 animate-fade-in px-4 py-6 sm:px-8 sm:py-7">
          <ToastProvider>{children}</ToastProvider>
        </main>
      </div>
    </div>
  );
}
