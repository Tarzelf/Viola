import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { schema } from '@viola/db';
import { db } from '@/lib/db';
import { getViewer } from '@/lib/identity';
import { resolveReport } from '@/lib/safety';

export const runtime = 'nodejs';

/** Acts on a report. Restricted to configured moderator addresses. */
export async function POST(request: Request) {
  const viewer = await getViewer();
  if (!viewer.userId) return NextResponse.json({ error: { code: 'not_found' } }, { status: 404 });

  const database = await db();
  const [user] = await database
    .select({ email: schema.users.email })
    .from(schema.users)
    .where(eq(schema.users.id, viewer.userId))
    .limit(1);

  const moderators = (process.env.VIOLA_MODERATOR_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  // Fails closed: with no moderators configured, nobody can action anything.
  if (moderators.length === 0 || !user || !moderators.includes(user.email.toLowerCase())) {
    return NextResponse.json({ error: { code: 'not_found' } }, { status: 404 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    reportId?: string;
    action?: 'remove' | 'dismiss';
    note?: string;
  };

  if (!body.reportId || !['remove', 'dismiss'].includes(body.action ?? '')) {
    return NextResponse.json({ error: { code: 'validation_failed' } }, { status: 422 });
  }

  await resolveReport(database, body.reportId, body.action!, body.note);
  return NextResponse.json({ ok: true });
}
