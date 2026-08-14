import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { revokeSession } from '@/lib/auth';
import { SESSION_COOKIE_NAME, clearSessionCookie, readSessionToken } from '@/lib/identity';

export const runtime = 'nodejs';

/** Signs out and actually revokes the session server-side. */
export async function POST() {
  const jar = await cookies();
  const token = readSessionToken(jar.get(SESSION_COOKIE_NAME)?.value);

  if (token) await revokeSession(await db(), token);

  const response = NextResponse.json({ ok: true });
  const cookie = clearSessionCookie();
  response.cookies.set(cookie.name, '', {
    httpOnly: cookie.httpOnly,
    sameSite: cookie.sameSite,
    path: cookie.path,
    secure: cookie.secure,
    maxAge: 0,
  });
  return response;
}
