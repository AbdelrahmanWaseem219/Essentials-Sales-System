'use client';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? '/api';
const TRACK_BASE = process.env.NEXT_PUBLIC_TRACK_BASE ?? '/track-api';

// Auth is cookie-based: the backend sets httpOnly access/refresh cookies that JS
// cannot read (XSS-safe). The browser sends them automatically on same-origin
// requests, so there are no tokens to store or attach here.

// Single in-flight refresh shared by all callers, so concurrent 401s don't each
// rotate the refresh cookie and knock the others out.
let refreshPromise: Promise<boolean> | null = null;
function refreshSession(): Promise<boolean> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = fetch(`${API_BASE}/auth/refresh`, { method: 'POST', credentials: 'include' })
    .then((r) => r.ok)
    .catch(() => false)
    .finally(() => {
      refreshPromise = null;
    });
  return refreshPromise;
}

async function request<T>(path: string, options: RequestInit = {}, retry = true): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set('Content-Type', 'application/json');

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers, credentials: 'include' });

  // Transparent refresh on 401 (coalesced across concurrent calls).
  if (res.status === 401 && retry) {
    const ok = await refreshSession();
    if (ok) return request<T>(path, options, false);
    // Session is dead → notify authed screens so they can redirect to login.
    if (typeof window !== 'undefined') window.dispatchEvent(new Event('auth-expired'));
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message ?? `Request failed (${res.status})`);
  }
  return res.status === 204 ? (undefined as T) : res.json();
}

export const api = {
  get: <T>(p: string) => request<T>(p),
  post: <T>(p: string, body?: unknown) =>
    request<T>(p, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  patch: <T>(p: string, body?: unknown) =>
    request<T>(p, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined }),
  del: <T>(p: string) => request<T>(p, { method: 'DELETE' }),
};

/** Session helpers (cookie-based; the server clears the httpOnly cookies). */
export const auth = {
  logout: () =>
    fetch(`${API_BASE}/auth/logout`, { method: 'POST', credentials: 'include' }).catch(
      () => undefined,
    ),
};

// Public tracking (no auth)
export const trackApi = {
  lookup: async (q: { token?: string; trackingNumber?: string; orderNumber?: string }) => {
    const params = new URLSearchParams(
      Object.entries(q).filter(([, v]) => !!v) as [string, string][],
    );
    const res = await fetch(`${TRACK_BASE}/lookup?${params}`);
    if (!res.ok) throw new Error('Not found');
    return res.json();
  },
  streamUrl: (token: string) => `${TRACK_BASE}/${token}/stream`,
};
