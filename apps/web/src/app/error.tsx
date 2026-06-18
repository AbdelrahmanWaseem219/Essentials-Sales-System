'use client';

import Link from 'next/link';
import { useEffect } from 'react';

/**
 * Route-level error boundary. Any uncaught render/runtime error in a page shows
 * this friendly screen (with a retry) instead of a blank white page.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50 px-6 text-center dark:bg-brand-950">
      <div className="text-4xl">⚠️</div>
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Something went wrong</h1>
      <p className="max-w-md text-slate-500 dark:text-slate-400">
        An unexpected error occurred. You can try again, or head back to the home page.
      </p>
      <div className="mt-2 flex gap-3">
        <button
          onClick={() => reset()}
          className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-800 dark:bg-white dark:text-brand-950 dark:hover:bg-slate-200"
        >
          Try again
        </button>
        <Link
          href="/"
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-white/15 dark:text-slate-200 dark:hover:bg-white/10"
        >
          Back to home
        </Link>
      </div>
    </main>
  );
}
