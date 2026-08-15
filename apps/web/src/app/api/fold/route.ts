import { NextResponse } from 'next/server';
import { attachGuestCookie, getViewer } from '@/lib/identity';
import { getFoldLattice } from '@/lib/fold';

export const runtime = 'nodejs';

/** The Fold lattice, for the native app and any client that cannot SSR it. */
export async function GET() {
  const viewer = await getViewer();
  const lattice = await getFoldLattice({ viewerUserId: viewer.userId });
  return attachGuestCookie(NextResponse.json({ lattice }), viewer);
}
