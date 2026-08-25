import type { ApiInterests, ApiLike, AuthResponse, LikedArticleRecord } from '../types';

const TOKEN_KEY = 'scrollopedia_token';
const USERNAME_KEY = 'scrollopedia_username';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function getUsername(): string | null {
  return localStorage.getItem(USERNAME_KEY);
}

export function setSession(auth: AuthResponse): void {
  localStorage.setItem(TOKEN_KEY, auth.token);
  localStorage.setItem(USERNAME_KEY, auth.username);
}

export function clearSession(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USERNAME_KEY);
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`/api${path}`, { ...options, headers });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export const authApi = {
  signup: (username: string, password: string) =>
    request<AuthResponse>('/signup', { method: 'POST', body: JSON.stringify({ username, password }) }),

  login: (username: string, password: string) =>
    request<AuthResponse>('/login', { method: 'POST', body: JSON.stringify({ username, password }) }),

  me: () => request<{ username: string }>('/me'),
};

export const likesApi = {
  list: () => request<{ likes: ApiLike[] }>('/likes'),

  add: (article: LikedArticleRecord) =>
    request<{ ok: true }>('/likes', { method: 'POST', body: JSON.stringify(article) }),

  remove: (articleId: number) => request<{ ok: true }>(`/likes/${articleId}`, { method: 'DELETE' }),
};

export const interestsApi = {
  get: () => request<ApiInterests>('/interests'),

  put: (payload: ApiInterests) => request<{ ok: true }>('/interests', { method: 'PUT', body: JSON.stringify(payload) }),
};
