'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api } from '@/lib/api';
import { Button, Card, Input } from '@/components/ui';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Logo } from '@/components/logo';
import { ThemeToggle } from '@/components/theme-toggle';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('admin@essentials.eg');
  const [password, setPassword] = useState('Password123!');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      // The server sets httpOnly auth cookies on success; nothing to store here.
      await api.post('/auth/staff/login', { email, password });
      router.push('/admin');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

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
          <h1 className="text-lg font-bold text-slate-900 dark:text-white">Sign in to your workspace</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Staff access · Sales operations</p>
          <form onSubmit={submit} className="mt-6 space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Email</label>
              <Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Password</label>
              <Input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                required
              />
            </div>
            {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
            <Button className="w-full" disabled={loading}>
              {loading ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>
        </Card>
        <p className="mt-4 text-center text-xs text-slate-400">© Essentials Egypt · Sales System</p>
      </div>
    </main>
  );
}
