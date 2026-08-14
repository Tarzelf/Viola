import { NextResponse } from 'next/server';
import { attachGuestCookie, getViewer } from '@/lib/identity';

export const runtime = 'nodejs';

/**
 * Records that a share was sent.
 *
 * `share_sent` is the step in the viral funnel where most loops quietly die —
 * plenty of people open a share sheet and never complete it — so it is
 * instrumented separately from `share_opened` rather than inferred.
 *
 * Currently writes to the log; wired to PostHog in the analytics phase. Never
 * blocks the share itself.
 */
export async function POST(request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  const viewer = await getViewer();
  const body = (await request.json().catch(() => ({}))) as { channel?: string };

  console.info(
    `[viola] share_sent slug=${slug} channel=${body.channel ?? 'unknown'} guest=${!viewer.isAuthenticated}`,
  );

  return attachGuestCookie(NextResponse.json({ ok: true }), viewer);
}
