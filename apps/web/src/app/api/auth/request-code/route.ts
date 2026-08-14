import { NextResponse } from 'next/server';
import { isViolaError } from '@viola/core';
import { db } from '@/lib/db';
import { requestCode } from '@/lib/auth';
import { attachGuestCookie, getViewer } from '@/lib/identity';

export const runtime = 'nodejs';

/**
 * Sends a sign-in code.
 *
 * The guest id travels with the request so that whatever this device did before
 * signing up can be claimed onto the account on the way in.
 */
export async function POST(request: Request) {
  const viewer = await getViewer();
  const body = (await request.json().catch(() => ({}))) as { email?: string };

  try {
    const { devCode } = await requestCode(await db(), {
      email: body.email ?? '',
      guestId: viewer.guestId,
    });

    // The code is only ever returned to the client while no email provider is
    // configured, so the flow is usable offline. Once RESEND_API_KEY (or
    // equivalent) is set this must go out by email and never over the wire.
    const emailConfigured = Boolean(process.env.RESEND_API_KEY || process.env.SMTP_URL);
    if (!emailConfigured) {
      console.info(`[viola] sign-in code for ${body.email}: ${devCode}`);
    }

    return attachGuestCookie(
      NextResponse.json({
        sent: true,
        ...(emailConfigured ? {} : { devCode, devMode: true }),
      }),
      viewer,
    );
  } catch (error) {
    if (isViolaError(error)) {
      return NextResponse.json(error.toJSON(), { status: error.status });
    }
    throw error;
  }
}
