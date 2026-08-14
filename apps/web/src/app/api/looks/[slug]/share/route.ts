import { NextResponse } from 'next/server';
import { SHARE_CHANNELS, type ShareChannel } from '@viola/core';
import { attachGuestCookie, getViewer } from '@/lib/identity';
import { track } from '@/lib/analytics';

export const runtime = 'nodejs';

/**
 * Records that a share left the device.
 *
 * `share_sent` is instrumented separately from `share_opened` rather than
 * inferred from it, because the gap between the two is where most viral loops
 * quietly die — plenty of people open a share sheet and never complete it. If
 * you only measure one of them you cannot tell a bad CTA from a bad sheet.
 */
export async function POST(request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  const viewer = await getViewer();
  const body = (await request.json().catch(() => ({}))) as { channel?: string };

  const channel = (SHARE_CHANNELS as readonly string[]).includes(body.channel ?? '')
    ? (body.channel as ShareChannel)
    : 'system_sheet';

  track('share_sent', {
    surface: 'web',
    lookId: slug,
    channel,
    ...(viewer.userId ? { userId: viewer.userId } : { guestId: viewer.guestId }),
  });

  return attachGuestCookie(NextResponse.json({ ok: true }), viewer);
}
