import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SCORE_FLOOR } from '@viola/core';
import type { DbHandle } from './client';
import { seed } from './seed';
import {
  blooms,
  lookItems,
  looks,
  productOffers,
  products,
  profiles,
  vaults,
} from './schema/index';
import { createTestDb } from './testing/index';

let handle: DbHandle;

beforeAll(async () => {
  handle = await createTestDb();
  await seed(handle.db);
});

afterAll(async () => {
  await handle?.close();
});

describe('seed data', () => {
  it('creates the expected volume', async () => {
    expect(await handle.db.select().from(profiles)).toHaveLength(3);
    expect(await handle.db.select().from(looks)).toHaveLength(12);
    expect(await handle.db.select().from(lookItems)).toHaveLength(36);
    expect(await handle.db.select().from(products)).toHaveLength(8);
  });

  it('gives every look a score inside the published band and a vibe', async () => {
    const rows = await handle.db.select().from(looks);
    for (const look of rows) {
      expect(look.score).not.toBeNull();
      expect(look.score!).toBeGreaterThanOrEqual(SCORE_FLOOR);
      expect(look.score!).toBeLessThanOrEqual(99);
      expect(look.archetypeId).toBeTruthy();
      expect(look.scoreBreakdown).toBeTruthy();
    }
  });

  it('links every item to a resolved product', async () => {
    const items = await handle.db.select().from(lookItems);
    for (const item of items) {
      expect(item.productId).toBeTruthy();
      expect(item.bbox).toHaveLength(4);
    }
  });

  it('includes secondhand offers, not just full-price retail', async () => {
    // 75% of the ICP rank sustainability over brand name, so resale has to be
    // represented in the data the product is designed against.
    const offers = await handle.db
      .select()
      .from(productOffers)
      .where(eq(productOffers.isSecondhand, true));
    expect(offers.length).toBeGreaterThan(0);
    for (const offer of offers) {
      expect(offer.priceCents!).toBeGreaterThan(0);
    }
  });

  it('includes guest blooms — the no-account path is the viral lever', async () => {
    const rows = await handle.db.select().from(blooms);
    const guestBlooms = rows.filter((b) => b.userId === null && b.guestId !== null);
    expect(guestBlooms.length).toBeGreaterThan(0);
  });

  it('keeps bloomCount consistent with the bloom rows', async () => {
    const allLooks = await handle.db.select().from(looks);
    const allBlooms = await handle.db.select().from(blooms);
    for (const look of allLooks) {
      const actual = allBlooms.filter((b) => b.lookId === look.id).length;
      expect(look.bloomCount).toBe(actual);
    }
  });

  it('gives every user exactly one default vault', async () => {
    const rows = await handle.db.select().from(vaults);
    expect(rows).toHaveLength(3);
    for (const v of rows) {
      expect(v.isDefault).toBe(true);
      expect(v.name).toBe('Saved');
    }
  });

  it('is deterministic — reseeding a fresh database produces identical scores', async () => {
    // Screenshots and golden tests depend on this.
    const other = await createTestDb();
    try {
      await seed(other.db);
      const a = (await handle.db.select().from(looks)).map((l) => l.score).sort();
      const b = (await other.db.select().from(looks)).map((l) => l.score).sort();
      expect(b).toEqual(a);
    } finally {
      await other.close();
    }
  });
});
