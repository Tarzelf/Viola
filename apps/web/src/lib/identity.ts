import 'server-only';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { cookies, headers } from 'next/headers';
import { resolveSession } from './auth';
import { db } from './db';

/**
 * Identity: signed-in users and guests.
 *
 * The guest half of this is the single most important growth mechanism in the
 * product. Research on viral loops is unambiguous that value must come before
 * the account — every step between arriving and acting costs 15-30% of
 * conversions, and an auth wall is the most expensive step there is. So a
 * recipient who opens a shared look can view it, bloom it, and browse, all
 * without signing up. When they eventually do, their guest activity is claimed
 * onto the new account rather than thrown away.
 *
 * Guest ids are HMAC-signed so they cannot be forged to stuff bloom counts:
 * one bloom per look per device is enforced by a unique index, and an
 * unforgeable id is what makes that index meaningful.
 */

const GUEST_COOKIE = 'viola_guest';
const SESSION_COOKIE = 'viola_session';
const MAX_AGE = 60 * 60 * 24 * 365;

function secret(): string {
  // A stable development fallback keeps the zero-config promise intact. It is
  // never used in production because the deploy sets the real value.
  return process.env.VIOLA_GUEST_SECRET ?? 'viola-development-secret-do-not-use-in-production';
}

export function sign(value: string): string {
  const mac = createHmac('sha256', secret()).update(value).digest('base64url');
  return `${value}.${mac}`;
}

export function verify(signed: string | undefined): string | null {
  if (!signed) return null;
  const index = signed.lastIndexOf('.');
  if (index <= 0) return null;

  const value = signed.slice(0, index);
  const provided = signed.slice(index + 1);
  const expected = createHmac('sha256', secret()).update(value).digest('base64url');

  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return null;
  return timingSafeEqual(a, b) ? value : null;
}

export function newGuestId(): string {
  return `g_${randomBytes(16).toString('base64url')}`;
}

export interface Viewer {
  userId: string | null;
  guestId: string;
  isAuthenticated: boolean;
}

/**
 * Resolves the current viewer, minting a guest id if there isn't one.
 *
 * The session cookie carries a signed opaque token, not a user id: sessions are
 * looked up in the database so that signing out actually revokes, and so
 * account deletion can terminate every device at once. A self-describing cookie
 * cannot do either.
 *
 * Read-only — Next forbids mutating cookies during render, so a freshly minted
 * guest id is persisted by `attachGuestCookie` in a route handler.
 */
export async function getViewer(): Promise<Viewer> {
  const jar = await cookies();
  const guestId = verify(jar.get(GUEST_COOKIE)?.value) ?? newGuestId();

  // The native app sends its session as a bearer token rather than a cookie.
  // Cookie handling in React Native's fetch differs across platforms and is
  // easy to get subtly wrong, so the header is the unambiguous path — and the
  // token lives in the iOS keychain rather than in AsyncStorage.
  const bearer = (await headers()).get('authorization');
  const token = bearer?.startsWith('Bearer ')
    ? bearer.slice(7)
    : verify(jar.get(SESSION_COOKIE)?.value);

  if (!token) return { userId: null, guestId, isAuthenticated: false };

  const session = await resolveSession(await db(), token);
  return {
    userId: session?.userId ?? null,
    guestId,
    isAuthenticated: session !== null,
  };
}

/** Throws rather than returning null, for routes that require an account. */
export async function requireUser(): Promise<Viewer & { userId: string }> {
  const viewer = await getViewer();
  if (!viewer.userId) {
    const { unauthorized } = await import('@viola/core');
    throw unauthorized();
  }
  return viewer as Viewer & { userId: string };
}

const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'lax',
  path: '/',
  secure: process.env.NODE_ENV === 'production',
  maxAge: MAX_AGE,
} as const;

export function guestCookie(guestId: string) {
  return { name: GUEST_COOKIE, value: sign(guestId), ...COOKIE_OPTIONS };
}

export function sessionCookie(token: string) {
  return { name: SESSION_COOKIE, value: sign(token), ...COOKIE_OPTIONS };
}

export function readSessionToken(signed: string | undefined): string | null {
  return verify(signed);
}

export const SESSION_COOKIE_NAME = SESSION_COOKIE;

export function clearSessionCookie() {
  return { name: SESSION_COOKIE, value: '', ...COOKIE_OPTIONS, maxAge: 0 };
}

/** Attaches the guest cookie to a response if the browser didn't send one. */
export function attachGuestCookie(response: Response, viewer: Viewer): Response {
  const cookie = guestCookie(viewer.guestId);
  response.headers.append(
    'set-cookie',
    `${cookie.name}=${cookie.value}; Path=/; Max-Age=${cookie.maxAge}; HttpOnly; SameSite=Lax${
      cookie.secure ? '; Secure' : ''
    }`,
  );
  return response;
}

/** Stable, non-reversible viewer key for view dedupe. Never stores a raw IP. */
export function viewerHash(viewer: Viewer): string {
  return createHmac('sha256', secret())
    .update(viewer.userId ?? viewer.guestId)
    .digest('base64url')
    .slice(0, 32);
}
