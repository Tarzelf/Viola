import { NextResponse } from 'next/server';
import { isViolaError } from '@viola/core';
import { db } from '@/lib/db';
import { verifyCode } from '@/lib/auth';
import { getViewer, sessionCookie } from '@/lib/identity';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const viewer = await getViewer();
  const body = (await request.json().catch(() => ({}))) as { email?: string; code?: string };

  try {
    const result = await verifyCode(await db(), {
      email: body.email ?? '',
      code: body.code ?? '',
      guestId: viewer.guestId,
      userAgent: request.headers.get('user-agent'),
    });

    const response = NextResponse.json({
      handle: result.handle,
      isNewAccount: result.isNewAccount,
      // Surfaced so the UI can say "we kept your 3 blooms" — converting should
      // never feel like starting over.
      claimedBlooms: result.claimed.blooms,
    });

    const cookie = sessionCookie(result.token);
    response.cookies.set(cookie.name, cookie.value, {
      httpOnly: cookie.httpOnly,
      sameSite: cookie.sameSite,
      path: cookie.path,
      secure: cookie.secure,
      maxAge: cookie.maxAge,
    });

    return response;
  } catch (error) {
    if (isViolaError(error)) {
      return NextResponse.json(error.toJSON(), { status: error.status });
    }
    throw error;
  }
}
