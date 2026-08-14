import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';

/**
 * The API client.
 *
 * The iOS app talks to exactly the same endpoints as the web app — there is no
 * separate mobile backend, and no second set of validation rules to keep in
 * sync. Request and response shapes are the zod schemas in `@viola/core`.
 *
 * Sessions ride in an Authorization header rather than a cookie. Cookie
 * handling in React Native's fetch differs across platforms and is easy to get
 * subtly wrong; an explicit header is unambiguous, and the token lives in the
 * iOS keychain rather than in AsyncStorage.
 */

const SESSION_KEY = 'viola.session';

function baseUrl(): string {
  const configured =
    (Constants.expoConfig?.extra as { apiUrl?: string } | undefined)?.apiUrl ??
    process.env.EXPO_PUBLIC_API_URL;

  if (configured) return configured.replace(/\/$/, '');

  // Simulator default. A device needs the machine's LAN address, so this is
  // surfaced rather than silently failing to connect.
  return 'http://localhost:3000';
}

let cachedToken: string | null | undefined;

export async function getSessionToken(): Promise<string | null> {
  if (cachedToken !== undefined) return cachedToken;
  cachedToken = await SecureStore.getItemAsync(SESSION_KEY).catch(() => null);
  return cachedToken;
}

export async function setSessionToken(token: string | null): Promise<void> {
  cachedToken = token;
  if (token) await SecureStore.setItemAsync(SESSION_KEY, token);
  else await SecureStore.deleteItemAsync(SESSION_KEY).catch(() => {});
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /** The paywall trigger, when the server refused for billing reasons. */
  get paywallTrigger(): string | null {
    if (this.status !== 402) return null;
    return (this.details as { trigger?: string } | undefined)?.trigger ?? 'unknown';
  }
}

async function request<T>(path: string, init: RequestInit & { raw?: unknown } = {}): Promise<T> {
  const token = await getSessionToken();

  const headers: Record<string, string> = {
    accept: 'application/json',
    ...((init.headers as Record<string, string>) ?? {}),
  };
  if (token) headers.authorization = `Bearer ${token}`;
  if (init.body && !init.raw) headers['content-type'] = 'application/json';

  const response = await fetch(`${baseUrl()}${path}`, { ...init, headers });

  if (response.status === 204) return undefined as T;

  const payload = (await response.json().catch(() => null)) as {
    error?: { code?: string; message?: string; details?: unknown };
  } | null;

  if (!response.ok) {
    throw new ApiError(
      response.status,
      payload?.error?.code ?? 'unknown',
      payload?.error?.message ?? 'Something went wrong',
      payload?.error?.details,
    );
  }

  return payload as T;
}

// ---------------------------------------------------------------------------
// Types mirrored from the web read models
// ---------------------------------------------------------------------------

export interface FeedItem {
  id: string;
  slug: string;
  photoPath: string;
  score: number | null;
  archetypeName: string | null;
  caption: string | null;
  handle: string;
  bloomCount: number;
  viewCount: number;
  itemCount: number;
  bloomedByViewer: boolean;
}

export interface LookItem {
  id: string;
  brand: string | null;
  title: string | null;
  subtype: string;
  priceCents: number | null;
  currency: string;
  source: string | null;
  merchantUrl: string | null;
  imagePath: string | null;
  bbox: [number, number, number, number];
}

export interface LookDetail extends FeedItem {
  layout: {
    subject: { x0: number; x1: number };
    slots: Array<{
      itemIndex: number;
      side: 'left' | 'right';
      rect: { x0: number; y0: number; x1: number; y1: number };
      anchor: { x: number; y: number };
    }>;
    unplaced: number[];
  } | null;
  items: LookItem[];
}

// ---------------------------------------------------------------------------
// Endpoints
// ---------------------------------------------------------------------------

export const api = {
  mediaUrl(path: string | null | undefined): string {
    if (!path) return '';
    if (path.startsWith('http') || path.startsWith('data:')) return path;
    return `${baseUrl()}/api/media/${path.replace(/^\/+/, '')}`;
  },

  shareUrl(slug: string): string {
    return `${baseUrl()}/l/${slug}`;
  },

  feed(tab: 'for-you' | 'fresh' | 'top' = 'for-you') {
    return request<{ looks: FeedItem[] }>(`/api/feed?tab=${tab}`);
  },

  look(slug: string) {
    return request<{ look: LookDetail }>(`/api/looks/${slug}`);
  },

  lookStatus(slug: string) {
    return request<{
      status: string;
      stage: string | null;
      score: number | null;
      archetype: string | null;
      items: Array<{ id: string; brand: string | null; title: string | null; subtype: string }>;
      ready: boolean;
      failed: boolean;
      quarantined: boolean;
    }>(`/api/looks/${slug}/status`);
  },

  bloom(slug: string) {
    return request<{ bloomCount: number; bloomed: boolean }>(`/api/looks/${slug}/bloom`, {
      method: 'POST',
    });
  },

  view(slug: string, source: string) {
    return request<{ counted: boolean }>(`/api/looks/${slug}/view`, {
      method: 'POST',
      body: JSON.stringify({ source }),
    });
  },

  recordShare(slug: string, channel: string) {
    return request<{ ok: true }>(`/api/looks/${slug}/share`, {
      method: 'POST',
      body: JSON.stringify({ channel }),
    });
  },

  event(event: string, props: Record<string, unknown>) {
    return request<{ ok: true }>('/api/events', {
      method: 'POST',
      body: JSON.stringify({ event, props }),
    });
  },

  async upload(uri: string): Promise<{ slug: string }> {
    const form = new FormData();
    // React Native's FormData takes this shape rather than a File.
    form.append('photo', {
      uri,
      name: 'look.jpg',
      type: 'image/jpeg',
    } as unknown as Blob);

    return request<{ slug: string }>('/api/looks', {
      method: 'POST',
      body: form,
      raw: form,
    });
  },

  vaults() {
    return request<{
      vaults: Array<{
        id: string;
        name: string;
        slug: string;
        isDefault: boolean;
        itemCount: number;
      }>;
      tier: 'free' | 'plus';
      limits: { maxVaults: number | null; maxSavedItems: number | null };
      usage: { vaultCount: number; savedItemCount: number };
    }>('/api/vaults');
  },

  createVault(name: string) {
    return request<{ vault: { id: string; name: string; slug: string } }>('/api/vaults', {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
  },

  save(input: { lookId?: string; lookItemId?: string }) {
    return request<{ saved: boolean; alreadyThere: boolean }>('/api/saves', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  requestCode(email: string) {
    return request<{ sent: boolean; devCode?: string; devMode?: boolean }>(
      '/api/auth/request-code',
      { method: 'POST', body: JSON.stringify({ email }) },
    );
  },

  verifyCode(email: string, code: string) {
    return request<{ handle: string; isNewAccount: boolean; token?: string }>('/api/auth/verify', {
      method: 'POST',
      body: JSON.stringify({ email, code, wantsToken: true }),
    });
  },

  report(lookId: string, reason: string) {
    return request<{ received: boolean }>('/api/reports', {
      method: 'POST',
      body: JSON.stringify({ targetType: 'look', targetId: lookId, reason }),
    });
  },

  block(handle: string) {
    return request<{ blocked: boolean }>('/api/blocks', {
      method: 'POST',
      body: JSON.stringify({ handle }),
    });
  },
};

export { baseUrl };
