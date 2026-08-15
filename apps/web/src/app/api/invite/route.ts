import { NextResponse } from 'next/server';
import { eq, sql } from 'drizzle-orm';
import { schema } from '@viola/db';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * Redeem an invite code → sets viola_invite cookie for 90 days.
 * Used when VIOLA_INVITE_ONLY=1 gates the product.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { code?: string } | null;
  const code = body?.code?.trim().toUpperCase() ?? '';

  if (code.length < 4) {
    return NextResponse.json(
      { error: { code: 'validation_failed', message: 'Enter your invite code.' } },
      { status: 400 },
    );
  }

  const database = await db();
  const [row] = await database
    .select()
    .from(schema.inviteCodes)
    .where(eq(schema.inviteCodes.code, code))
    .limit(1);

  if (!row || row.uses >= row.maxUses) {
    return NextResponse.json(
      { error: { code: 'forbidden', message: 'That invite is not valid.' } },
      { status: 403 },
    );
  }

  await database
    .update(schema.inviteCodes)
    .set({ uses: sql`${schema.inviteCodes.uses} + 1` })
    .where(eq(schema.inviteCodes.code, code));

  const response = NextResponse.json({ ok: true });
  response.cookies.set('viola_invite', code, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 90,
  });
  return response;
}
