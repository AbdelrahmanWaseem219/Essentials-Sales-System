'use client';

import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Reactive "is the app in dark mode" hook. Initialises from the `dark` class
 * the no-flash script set on <html>, then stays in sync if the class changes
 * (toggle) — so charts and other JS-driven colors re-render with the theme.
 */
export function useIsDark() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const el = document.documentElement;
    const sync = () => setDark(el.classList.contains('dark'));
    sync();
    const obs = new MutationObserver(sync);
    obs.observe(el, { attributes: true, attributeFilter: ['class'] });
    return () => obs.disconnect();
  }, []);
  return dark;
}

/**
 * Single source of truth for recharts colors in both themes. Pass the value
 * from useIsDark(). Keeps the dashboard and analytics charts in lockstep.
 */
export function chartPalette(dark: boolean) {
  return {
    line: dark ? '#e5e7eb' : '#101418',
    grid: dark ? '#1f242a' : '#f1f5f9',
    axis: dark ? '#6b7682' : '#94a3b8',
    tooltipBg: dark ? '#16191c' : '#ffffff',
    tooltipBorder: dark ? '#2a2f35' : '#e2e8f0',
  };
}

/** Sun/Moon button that flips the theme and persists the choice. */
export function ThemeToggle({ className }: { className?: string }) {
  const dark = useIsDark();

  function toggle() {
    const el = document.documentElement;
    const next = !el.classList.contains('dark');
    el.classList.toggle('dark', next);
    try {
      localStorage.setItem('theme', next ? 'dark' : 'light');
    } catch {
      /* ignore (private mode etc.) */
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={dark ? 'Light mode' : 'Dark mode'}
      className={cn(
        'inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10',
        className,
      )}
    >
      {dark ? <Sun size={17} /> : <Moon size={17} />}
    </button>
  );
}
