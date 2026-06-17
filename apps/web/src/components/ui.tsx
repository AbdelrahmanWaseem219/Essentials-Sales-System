'use client';

import { cn } from '@/lib/utils';
import { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react';

/** Minimal shadcn-style primitives (kept dependency-free for portability). */

export function Button({
  className,
  variant = 'primary',
  size = 'md',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'outline' | 'danger' | 'ghost';
  size?: 'sm' | 'md';
}) {
  const variants = {
    primary:
      'bg-brand text-white hover:bg-brand-800 shadow-sm dark:bg-white dark:text-brand-950 dark:hover:bg-slate-200',
    outline:
      'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-white/15 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10',
    danger: 'bg-red-600 text-white hover:bg-red-700 shadow-sm',
    ghost: 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10',
  };
  const sizes = { sm: 'px-2.5 py-1.5 text-xs', md: 'px-3.5 py-2 text-sm' };
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-brand/30 disabled:cursor-not-allowed disabled:opacity-50',
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  );
}

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        'w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-800 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-brand focus:ring-2 focus:ring-brand/20 dark:border-white/15 dark:bg-white/5 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-white/40 dark:focus:ring-white/15',
        className,
      )}
      {...props}
    />
  );
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-slate-200/80 bg-white shadow-card dark:border-white/10 dark:bg-brand-900 dark:shadow-none',
        className,
      )}
    >
      {children}
    </div>
  );
}

const STATUS_STYLES: Record<string, string> = {
  PENDING_REVIEW: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  PAYMENT_PENDING: 'bg-orange-50 text-orange-700 ring-orange-600/20',
  APPROVED: 'bg-blue-50 text-blue-700 ring-blue-600/20',
  SENT_TO_ODOO: 'bg-indigo-50 text-indigo-700 ring-indigo-600/20',
  PROCESSING: 'bg-cyan-50 text-cyan-700 ring-cyan-600/20',
  SHIPPED: 'bg-violet-50 text-violet-700 ring-violet-600/20',
  DELIVERED: 'bg-green-50 text-green-700 ring-green-600/20',
  ON_HOLD: 'bg-yellow-50 text-yellow-800 ring-yellow-600/20',
  CANCELLED: 'bg-slate-100 text-slate-600 ring-slate-500/20',
  REJECTED: 'bg-red-50 text-red-700 ring-red-600/20',
  RETURNED: 'bg-pink-50 text-pink-700 ring-pink-600/20',
  PAID: 'bg-green-50 text-green-700 ring-green-600/20',
  PENDING: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  REFUNDED: 'bg-slate-100 text-slate-600 ring-slate-500/20',
  PARTIALLY_PAID: 'bg-orange-50 text-orange-700 ring-orange-600/20',
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset',
        STATUS_STYLES[status] ?? 'bg-slate-100 text-slate-600 ring-slate-500/20',
      )}
    >
      {status.replace(/_/g, ' ')}
    </span>
  );
}

/** Page header used across admin screens for consistent spacing/typography. */
export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 flex items-start justify-between gap-4">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
