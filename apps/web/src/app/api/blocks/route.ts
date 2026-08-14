import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { isViolaError } from '@viola/core';
import { schema } from '@viola/db';
import { db } from '@/lib/db';
import { getViewer } from '@/lib/identity';
import { blockUser, unblockUser } from '@/lib/safety';

export const runtime = 'nodejs';

/** Block a user. App Store guideline 1.2 requires this. */
export async function POST(request: Request) {
  const viewer = await getViewer();
  if (!viewer.userId) {
    return NextResponse.json(
      { error: { code: 'unauthorized', message: 'Sign in to block someone.' } },
      { status: 401 },
    );
  }

  const body = (await request.json().catch(() => ({}))) as { handle?: string; unblock?: boolean };
  if (!body.handle) {
    return NextResponse.json({ error: { code: 'validation_failed' } }, { status: 422 });
  }

  const database = await db();
  const [target] = await database
    .select({ userId: schema.profiles.userId })
    .from(schema.profiles)
    .where(eq(schema.profiles.handle, body.handle))
    .limit(1);

  if (!target) return NextResponse.json({ error: { code: 'not_found' } }, { status: 404 });

  try {
    if (body.unblock) {
      await unblockUser(database, viewer.userId, target.userId);
      return NextResponse.json({ blocked: false });
    }
    await blockUser(database, viewer.userId, target.userId);
    return NextResponse.json({ blocked: true });
  } catch (error) {
    if (isViolaError(error)) return NextResponse.json(error.toJSON(), { status: error.status });
    throw error;
  }
}
