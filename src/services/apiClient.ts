// Thin client for TaleTrade's own API (server/). Every request carries the signed-in
// user's Firebase ID token, which the server verifies; nothing else identifies the caller.
import { TALETRADE_API_URL } from '@env';
import { getAuth, getIdToken } from '@react-native-firebase/auth';

const TIMEOUT_MS = 12000;

export class ApiError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

type QueryValue = string | number | boolean | null | undefined;

/** "?a=1&b=x" for the defined values (empty string when there are none). */
export const buildQuery = (params?: Record<string, QueryValue>): string => {
  if (!params) return '';
  const parts = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
  return parts.length > 0 ? `?${parts.join('&')}` : '';
};

/** Joins the configured base URL and a path, tolerating a trailing slash on the base. */
export const buildUrl = (base: string, path: string, query?: Record<string, QueryValue>): string =>
  `${base.replace(/\/+$/, '')}${path}${buildQuery(query)}`;

interface RequestOptions {
  query?: Record<string, QueryValue>;
  body?: unknown;
}

export const apiRequest = async <T>(
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  path: string,
  { query, body }: RequestOptions = {},
): Promise<T> => {
  if (!TALETRADE_API_URL) {
    throw new ApiError(0, 'not_configured', 'The TaleTrade API address is not set. Add TALETRADE_API_URL to .env.');
  }
  const user = getAuth().currentUser;
  if (!user) throw new ApiError(401, 'unauthorized', 'Please sign in again.');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const token = await getIdToken(user);
    const response = await fetch(buildUrl(TALETRADE_API_URL, path, query), {
      method,
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    if (response.status === 204) return undefined as T;

    let payload: any = null;
    try {
      payload = await response.json();
    } catch {
      // Non-JSON error pages (e.g. a proxy 502) fall through to the generic message below.
    }

    if (!response.ok) {
      const err = payload?.error;
      throw new ApiError(
        response.status,
        err?.code || 'http_error',
        err?.message || `Request failed (${response.status}).`,
      );
    }
    return payload as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    const aborted = (error as { name?: string })?.name === 'AbortError';
    throw new ApiError(
      0,
      aborted ? 'timeout' : 'network',
      aborted ? 'The server took too long to respond.' : 'Could not reach TaleTrade. Check your connection.',
    );
  } finally {
    clearTimeout(timer);
  }
};
