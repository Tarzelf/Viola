import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { getArchetype } from '@viola/core';
import { schema } from '@viola/db';
import { db } from '@/lib/db';

export const runtime = 'nodejs';

/**
 * Pipeline progress for the reveal.
 *
 * Polled by the client while a look is processing. Returns items as they land
 * so the UI can animate pieces in one at a time — the staggered reveal is the
 * moment the product sells itself, and a single spinner followed by a finished
 * card throws that away.
 */
export async function GET(_request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  const database = await db();

  const [look] = await database
    .select({
      id: schema.looks.id,
      status: schema.looks.status,
      failureReason: schema.looks.failureReason,
      score: schema.looks.score,
      archetypeId: schema.looks.archetypeId,
      photoPath: schema.looks.photoPath,
    })
    .from(schema.looks)
    .where(eq(schema.looks.slug, slug))
    .limit(1);

  if (!look) return NextResponse.json({ error: { code: 'not_found' } }, { status: 404 });

  const items = await database
    .select({
      id: schema.lookItems.id,
      rank: schema.lookItems.rank,
      brand: schema.lookItems.brand,
      title: schema.lookItems.title,
      subtype: schema.lookItems.subtype,
    })
    .from(schema.lookItems)
    .where(eq(schema.lookItems.lookId, look.id))
    .orderBy(schema.lookItems.rank);

  return NextResponse.json({
    status: look.status,
    // While processing, failureReason carries the current stage name. Only
    // surfaced as a progress label, never shown raw to the user.
    stage: look.status === 'processing' ? (look.failureReason ?? null) : null,
    score: look.score,
    archetype: look.archetypeId ? (getArchetype(look.archetypeId)?.name ?? null) : null,
    itemCount: items.length,
    items,
    ready: look.status === 'ready',
    quarantined: look.status === 'quarantined',
    failed: look.status === 'failed',
  });
}
