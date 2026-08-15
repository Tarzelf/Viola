import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { schema } from '@viola/db';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * Soft-launch waitlist capture.
 *
 * Idempotent on email — joining twice is a success, not an error.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { email?: string; source?: string } | null;
  const email = body?.email?.trim().toLowerCase() ?? '';

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json(
      { error: { code: 'validation_failed', message: 'Enter a real email.' } },
      { status: 400 },
    );
  }

  const database = await db();
  const existing = await database
    .select({ id: schema.waitlist.id })
    .from(schema.waitlist)
    .where(eq(schema.waitlist.email, email))
    .limit(1);

  if (existing.length === 0) {
    await database.insert(schema.waitlist).values({
      email,
      source: (body?.source ?? 'early').slice(0, 32),
    });
  }

  return NextResponse.json({ ok: true });
}
