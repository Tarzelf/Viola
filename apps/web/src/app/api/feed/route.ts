import { NextResponse } from 'next/server';
import { attachGuestCookie, getViewer } from '@/lib/identity';
import { getFeed, type FeedTab } from '@/lib/queries';

export const runtime = 'nodejs';

/** The feed, for the native app. Same read model the web pages use. */
export async function GET(request: Request) {
  const viewer = await getViewer();
  const tab = (new URL(request.url).searchParams.get('tab') ?? 'for-you') as FeedTab;

  const looks = await getFeed({
    tab: ['for-you', 'fresh', 'top'].includes(tab) ? tab : 'for-you',
    viewerUserId: viewer.userId,
    viewerGuestId: viewer.guestId,
  });

  return attachGuestCookie(NextResponse.json({ looks }), viewer);
}
