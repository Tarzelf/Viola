import { NextResponse } from 'next/server';
import { isViolaError } from '@viola/core';
import { db } from '@/lib/db';
import { getViewer } from '@/lib/identity';
import { setItemManually } from '@/lib/manual-items';

export const runtime = 'nodejs';

/**
 * Identify a piece yourself.
 *
 * Costs nothing, is more accurate than any model — the person wore it — and
 * seeds the shared product cache so nobody pays to resolve that item again.
 */
export async function PATCH(
  request: Request,
  context: { params: Promise<{ slug: string; itemId: string }> },
) {
  const { slug, itemId } = await context.params;
  const viewer = await getViewer();

  if (!viewer.userId) {
    return NextResponse.json(
      { error: { code: 'unauthorized', message: 'Sign in to edit this look.' } },
      { status: 401 },
    );
  }

  const body = (await request.json().catch(() => ({}))) as {
    brand?: string;
    title?: string;
    url?: string;
    priceCents?: number;
  };

  try {
    const result = await setItemManually(await db(), {
      userId: viewer.userId,
      lookSlug: slug,
      itemId,
      values: body,
    });
    return NextResponse.json(result);
  } catch (error) {
    if (isViolaError(error)) return NextResponse.json(error.toJSON(), { status: error.status });
    throw error;
  }
}
