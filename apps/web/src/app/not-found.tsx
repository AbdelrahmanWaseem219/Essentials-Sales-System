import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-50 px-6 text-center dark:bg-brand-950">
      <div className="text-6xl font-bold text-slate-200 dark:text-white/15">404</div>
      <h1 className="text-xl font-bold text-slate-900 dark:text-white">Page not found</h1>
      <p className="text-slate-500 dark:text-slate-400">
        The page you’re looking for doesn’t exist or has moved.
      </p>
      <Link
        href="/"
        className="mt-3 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-800 dark:bg-white dark:text-brand-950 dark:hover:bg-slate-200"
      >
        Back to home
      </Link>
    </main>
  );
}
