import { NextResponse } from 'next/server';
import { isViolaError } from '@viola/core';
import { db } from '@/lib/db';
import { verifyCode } from '@/lib/auth';
import { getViewer, sessionCookie } from '@/lib/identity';
import { analytics, track } from '@/lib/analytics';

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

    // Stitch the guest's pre-signup journey onto the account before anything
    // else, so their earlier events are not orphaned.
    analytics().alias(viewer.guestId, result.userId);
    analytics().identify(result.userId, { handle: result.handle });

    if (result.isNewAccount) {
      // Step six. Attributed to the guest device, which is how we know the
      // signup came from a shared link rather than a cold visit.
      track('referred_signup_completed', {
        surface: 'web',
        userId: result.userId,
        guestId: viewer.guestId,
      });
    }

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
