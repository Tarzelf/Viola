import { NextResponse } from 'next/server';
import { VIRAL_FUNNEL, type EventName } from '@viola/core';
import { attachGuestCookie, getViewer } from '@/lib/identity';
import { track } from '@/lib/analytics';

export const runtime = 'nodejs';

/**
 * Client-originated events.
 *
 * Two funnel steps only exist in the browser — reaching the share trigger and
 * opening the share sheet — so they are posted here rather than inferred. The
 * allowlist keeps this from becoming an open pipe into our analytics.
 */
const ALLOWED = new Set<string>([
  'share_trigger_reached',
  'share_opened',
  'look_reveal_played',
  'paywall_shown',
  'vault_save_attempted',
  'fold_opened',
  'fold_moment_selected',
  'fold_return_traced',
]);

export async function POST(request: Request) {
  const viewer = await getViewer();
  const body = (await request.json().catch(() => ({}))) as {
    event?: string;
    props?: Record<string, unknown>;
  };

  if (!body.event || !ALLOWED.has(body.event)) {
    return NextResponse.json({ error: { code: 'validation_failed' } }, { status: 422 });
  }

  track(
    body.event as EventName,
    {
      surface: 'web',
      ...(body.props ?? {}),
      ...(viewer.userId ? { userId: viewer.userId } : { guestId: viewer.guestId }),
    } as never,
  );

  return attachGuestCookie(NextResponse.json({ ok: true }), viewer);
}

export { VIRAL_FUNNEL };
