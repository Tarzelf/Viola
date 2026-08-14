import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { DbHandle } from '../client.js';
import { loadMigrations, rowsOf } from '../migrate.js';
import { createTestDb, truncateAll } from '../testing/index.js';
import { blooms, looks, lookItems, products, profiles, users, vaults } from './index.js';

let handle: DbHandle;

beforeAll(async () => {
  handle = await createTestDb();
});

afterAll(async () => {
  await handle?.close();
});

const freshUser = async (email = `u${Math.random().toString(36).slice(2)}@viola.app`) => {
  const [user] = await handle.db.insert(users).values({ email }).returning();
  return user!;
};

describe('migrations', () => {
  it('apply cleanly to a real Postgres with no extensions', async () => {
    // The whole local/CI story depends on this: PGlite has gen_random_uuid()
    // built in but no pgcrypto, so a migration requiring it would force Docker
    // back into the dev loop.
    const migrations = loadMigrations();
    expect(migrations.length).toBeGreaterThan(0);
    for (const m of migrations) {
      for (const statement of m.statements) {
        expect(statement.toLowerCase()).not.toContain('create extension');
      }
    }
  });

  it('creates every expected table', async () => {
    const rows = rowsOf<{ tablename: string }>(
      await handle.db.execute(
        sql.raw(`select tablename from pg_tables where schemaname = 'public'`),
      ),
    );
    const names = new Set(rows.map((r) => r.tablename));

    for (const expected of [
      'users',
      'profiles',
      'looks',
      'look_items',
      'blooms',
      'look_views',
      'products',
      'product_offers',
      'vaults',
      'vault_items',
      'follows',
      'blocks',
      'reports',
      'subscriptions',
      'usage_quota',
      'spend_ledger',
      'jobs',
      'affiliate_clicks',
      'affiliate_transactions',
      'sponsored_placements',
    ]) {
      expect(names.has(expected), `missing table: ${expected}`).toBe(true);
    }
  });

  it('is idempotent — re-running applies nothing', async () => {
    const { migrate } = await import('../migrate.js');
    const result = await migrate(handle.db);
    expect(result.applied).toHaveLength(0);
    expect(result.skipped.length).toBeGreaterThan(0);
  });
});

describe('identity constraints', () => {
  it('enforces unique emails', async () => {
    await truncateAll(handle);
    await handle.db.insert(users).values({ email: 'dupe@viola.app' });
    await expect(handle.db.insert(users).values({ email: 'dupe@viola.app' })).rejects.toThrow();
  });

  it('enforces unique handles', async () => {
    await truncateAll(handle);
    const a = await freshUser();
    const b = await freshUser();
    await handle.db.insert(profiles).values({ userId: a.id, handle: 'maya' });
    await expect(
      handle.db.insert(profiles).values({ userId: b.id, handle: 'maya' }),
    ).rejects.toThrow();
  });

  it('cascades profile deletion from the user', async () => {
    await truncateAll(handle);
    const user = await freshUser();
    await handle.db.insert(profiles).values({ userId: user.id, handle: 'cascade_me' });
    await handle.db.delete(users).where(sql`${users.id} = ${user.id}`);
    const remaining = await handle.db.select().from(profiles);
    expect(remaining).toHaveLength(0);
  });
});

describe('looks', () => {
  it('round-trips a look with jsonb score, layout and bbox', async () => {
    await truncateAll(handle);
    const user = await freshUser();

    const [look] = await handle.db
      .insert(looks)
      .values({
        userId: user.id,
        slug: 'abcdefghjk',
        photoPath: 'uploads/a.jpg',
        status: 'ready',
        score: 94,
        scoreBreakdown: { fit: 92, colorStory: 95, texture: 88, statement: 90, cohesion: 96 },
        archetypeId: 'clean-girl',
        styleTags: ['minimalist', 'neutral'],
        layout: {
          subject: { x0: 0.29, x1: 0.53 },
          slots: [
            {
              itemIndex: 0,
              side: 'left',
              rect: { x0: 0.02, y0: 0.25, x1: 0.28, y1: 0.4 },
              anchor: { x: 0.4, y: 0.32 },
            },
          ],
          unplaced: [],
        },
      })
      .returning();

    expect(look!.score).toBe(94);
    expect(look!.scoreBreakdown!.colorStory).toBe(95);
    expect(look!.layout!.subject.x0).toBeCloseTo(0.29);
    expect(look!.layout!.slots[0]!.side).toBe('left');
    expect(look!.styleTags).toEqual(['minimalist', 'neutral']);

    const [item] = await handle.db
      .insert(lookItems)
      .values({
        lookId: look!.id,
        rank: 0,
        category: 'footwear',
        subtype: 'running shoe',
        brand: 'HOKA',
        bbox: [0.34, 0.84, 0.46, 0.92],
        confidence: 0.81,
      })
      .returning();

    expect(item!.bbox).toEqual([0.34, 0.84, 0.46, 0.92]);
    expect(item!.brand).toBe('HOKA');
  });

  it('allows a null brand — an absence beats a hallucinated guess', async () => {
    await truncateAll(handle);
    const user = await freshUser();
    const [look] = await handle.db
      .insert(looks)
      .values({ userId: user.id, slug: 'nobrand123', photoPath: 'p.jpg' })
      .returning();

    const [item] = await handle.db
      .insert(lookItems)
      .values({
        lookId: look!.id,
        rank: 0,
        category: 'top',
        subtype: 'tee',
        brand: null,
        bbox: [0.3, 0.3, 0.5, 0.5],
      })
      .returning();

    expect(item!.brand).toBeNull();
  });

  it('enforces unique slugs', async () => {
    await truncateAll(handle);
    const user = await freshUser();
    await handle.db.insert(looks).values({ userId: user.id, slug: 'samesame2', photoPath: 'a' });
    await expect(
      handle.db.insert(looks).values({ userId: user.id, slug: 'samesame2', photoPath: 'b' }),
    ).rejects.toThrow();
  });

  it('cascades items when a look is deleted', async () => {
    await truncateAll(handle);
    const user = await freshUser();
    const [look] = await handle.db
      .insert(looks)
      .values({ userId: user.id, slug: 'cascade234', photoPath: 'a' })
      .returning();
    await handle.db.insert(lookItems).values({
      lookId: look!.id,
      rank: 0,
      category: 'top',
      subtype: 'tee',
      bbox: [0.1, 0.1, 0.2, 0.2],
    });
    await handle.db.delete(looks).where(sql`${looks.id} = ${look!.id}`);
    expect(await handle.db.select().from(lookItems)).toHaveLength(0);
  });
});

describe('blooms', () => {
  const setupLook = async () => {
    const user = await freshUser();
    const [look] = await handle.db
      .insert(looks)
      .values({
        userId: user.id,
        slug: `s${Math.random().toString(36).slice(2, 11)}`,
        photoPath: 'a',
      })
      .returning();
    return { user, look: look! };
  };

  it('accepts a bloom from a guest with no account', async () => {
    // This is the single biggest lever on the viral coefficient: a share
    // recipient must be able to react without hitting an auth wall.
    await truncateAll(handle);
    const { look } = await setupLook();
    const [bloom] = await handle.db
      .insert(blooms)
      .values({ lookId: look.id, userId: null, guestId: 'guest-abc' })
      .returning();
    expect(bloom!.userId).toBeNull();
    expect(bloom!.guestId).toBe('guest-abc');
  });

  it('allows only one bloom per account per look', async () => {
    await truncateAll(handle);
    const { look } = await setupLook();
    const fan = await freshUser();
    await handle.db.insert(blooms).values({ lookId: look.id, userId: fan.id });
    await expect(
      handle.db.insert(blooms).values({ lookId: look.id, userId: fan.id }),
    ).rejects.toThrow();
  });

  it('allows only one bloom per guest device per look', async () => {
    await truncateAll(handle);
    const { look } = await setupLook();
    await handle.db.insert(blooms).values({ lookId: look.id, guestId: 'device-1' });
    await expect(
      handle.db.insert(blooms).values({ lookId: look.id, guestId: 'device-1' }),
    ).rejects.toThrow();
  });

  it('lets different guests bloom the same look', async () => {
    await truncateAll(handle);
    const { look } = await setupLook();
    await handle.db.insert(blooms).values({ lookId: look.id, guestId: 'device-1' });
    await handle.db.insert(blooms).values({ lookId: look.id, guestId: 'device-2' });
    expect(await handle.db.select().from(blooms)).toHaveLength(2);
  });
});

describe('vaults', () => {
  it('permits at most one default vault per user', async () => {
    await truncateAll(handle);
    const user = await freshUser();
    await handle.db
      .insert(vaults)
      .values({ userId: user.id, name: 'Saved', slug: 'v-saved-1', isDefault: true });
    await expect(
      handle.db
        .insert(vaults)
        .values({ userId: user.id, name: 'Other', slug: 'v-other-1', isDefault: true }),
    ).rejects.toThrow();
  });

  it('allows many non-default vaults', async () => {
    await truncateAll(handle);
    const user = await freshUser();
    await handle.db.insert(vaults).values({ userId: user.id, name: 'A', slug: 'v-a-1' });
    await handle.db.insert(vaults).values({ userId: user.id, name: 'B', slug: 'v-b-1' });
    expect(await handle.db.select().from(vaults)).toHaveLength(2);
  });
});

describe('product cache', () => {
  it('is keyed globally by query hash, not per user', async () => {
    // The main cost control: a viral sneaker resolves once for everyone.
    await truncateAll(handle);
    await handle.db.insert(products).values({
      queryHash: 'hash-hoka-skyward-x-blue',
      normalisedQuery: 'hoka skyward x blue',
      title: 'HOKA Skyward X',
      merchantUrl: 'https://example.com/p/1',
    });
    await expect(
      handle.db.insert(products).values({
        queryHash: 'hash-hoka-skyward-x-blue',
        normalisedQuery: 'hoka skyward x blue',
        title: 'HOKA Skyward X (dupe row)',
        merchantUrl: 'https://example.com/p/2',
      }),
    ).rejects.toThrow();
  });
});
