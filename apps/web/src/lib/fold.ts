import 'server-only';
import { and, desc, eq, inArray, notInArray, sql } from 'drizzle-orm';
import { foldLattice, type FoldLattice, type FoldMomentInput } from '@viola/core';
import { schema } from '@viola/db';
import { db } from './db';
import { hiddenUserIds } from './safety';

/**
 * The Fold's read model.
 *
 * Same visibility rules as the feed: ready, not private, not quarantined, and
 * never a blocked author. The lattice itself is pure (`foldLattice` in core);
 * this file is only the fetch.
 */

const VISIBLE = sql`${schema.looks.status} = 'ready' and ${schema.looks.visibility} <> 'private'`;

export async function getFoldLattice(options: {
  viewerUserId?: string | null;
  limit?: number;
}): Promise<FoldLattice> {
  const database = await db();
  const limit = options.limit ?? 48;
  const hidden = await hiddenUserIds(database, options.viewerUserId ?? null);

  const clauses = [VISIBLE];
  if (hidden.length > 0) clauses.push(notInArray(schema.looks.userId, hidden));

  const rows = await database
    .select({
      id: schema.looks.id,
      slug: schema.looks.slug,
      photoPath: schema.looks.photoPath,
      score: schema.looks.score,
      bloomCount: schema.looks.bloomCount,
      archetypeId: schema.looks.archetypeId,
      caption: schema.looks.caption,
      publishedAt: schema.looks.publishedAt,
      createdAt: schema.looks.createdAt,
      handle: schema.profiles.handle,
    })
    .from(schema.looks)
    .innerJoin(schema.profiles, eq(schema.profiles.userId, schema.looks.userId))
    .where(and(...clauses))
    .orderBy(desc(schema.looks.publishedAt))
    .limit(limit);

  if (rows.length === 0) return foldLattice([]);

  const items = await database
    .select({
      id: schema.lookItems.id,
      lookId: schema.lookItems.lookId,
      category: schema.lookItems.category,
      brand: schema.lookItems.brand,
      title: schema.lookItems.title,
      productId: schema.lookItems.productId,
    })
    .from(schema.lookItems)
    .where(
      inArray(
        schema.lookItems.lookId,
        rows.map((row) => row.id),
      ),
    );

  const itemsByLook = new Map<string, FoldMomentInput['items']>();
  for (const item of items) {
    const list = itemsByLook.get(item.lookId) ?? [];
    list.push({
      id: item.id,
      category: item.category,
      brand: item.brand,
      title: item.title,
      productId: item.productId,
    });
    itemsByLook.set(item.lookId, list);
  }

  const inputs: FoldMomentInput[] = rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    handle: row.handle,
    publishedAt: (row.publishedAt ?? row.createdAt).getTime(),
    score: row.score,
    bloomCount: row.bloomCount,
    archetypeId: row.archetypeId,
    photoPath: row.photoPath,
    caption: row.caption,
    items: itemsByLook.get(row.id) ?? [],
  }));

  return foldLattice(inputs);
}
