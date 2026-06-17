'use client';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? '/api';
const TRACK_BASE = process.env.NEXT_PUBLIC_TRACK_BASE ?? '/track-api';

const ACCESS_KEY = 'es_access';
const REFRESH_KEY = 'es_refresh';

export const tokens = {
  get access() {
    return typeof window !== 'undefined' ? localStorage.getItem(ACCESS_KEY) : null;
  },
  get refresh() {
    return typeof window !== 'undefined' ? localStorage.getItem(REFRESH_KEY) : null;
  },
  set(access: string, refresh: string) {
    localStorage.setItem(ACCESS_KEY, access);
    localStorage.setItem(REFRESH_KEY, refresh);
  },
  clear() {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
  },
};

async function request<T>(path: string, options: RequestInit = {}, retry = true): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set('Content-Type', 'application/json');
  if (tokens.access) headers.set('Authorization', `Bearer ${tokens.access}`);

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  // Transparent refresh-token rotation on 401.
  if (res.status === 401 && retry && tokens.refresh) {
    const refreshed = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: tokens.refresh }),
    });
    if (refreshed.ok) {
      const data = await refreshed.json();
      tokens.set(data.accessToken, data.refreshToken);
      return request<T>(path, options, false);
    }
    // Refresh failed → session is dead. Clear tokens and notify the app so
    // authed screens can redirect to login instead of hanging on empty data.
    tokens.clear();
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
