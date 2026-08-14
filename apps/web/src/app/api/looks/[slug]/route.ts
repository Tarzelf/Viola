import { NextResponse } from 'next/server';
import { attachGuestCookie, getViewer } from '@/lib/identity';
import { getLookBySlug } from '@/lib/queries';

export const runtime = 'nodejs';

/** A single look, for the native app. */
export async function GET(_request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  const viewer = await getViewer();

  const look = await getLookBySlug(slug, {
    viewerUserId: viewer.userId,
    viewerGuestId: viewer.guestId,
  });

  if (!look) return NextResponse.json({ error: { code: 'not_found' } }, { status: 404 });

  return attachGuestCookie(NextResponse.json({ look }), viewer);
}
