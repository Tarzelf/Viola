import { eq } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { schema, type DbHandle } from '@viola/db';
import { createTestDb, truncateAll } from '@viola/db/testing';
import { queryHash } from '@viola/pipeline';
import { manualContributionStats, normaliseShopUrl, setItemManually } from './manual-items';

let handle: DbHandle;

beforeEach(async () => {
  handle ??= await createTestDb();
  await truncateAll(handle);
});

afterAll(async () => {
  await handle?.close();
});

const db = () => handle.db;

async function makeLook() {
  const [user] = await db()
    .insert(schema.users)
    .values({ email: `m${Math.random()}@x.com` })
    .returning();
  await db()
    .insert(schema.profiles)
    .values({ userId: user!.id, handle: `h${Math.random().toString(36).slice(2, 10)}` });

  const [look] = await db()
    .insert(schema.looks)
    .values({
      userId: user!.id,
      slug: Math.random().toString(36).slice(2, 12).padEnd(10, 'a'),
      photoPath: 'p.jpg',
      status: 'ready',
    })
    .returning();

  const [item] = await db()
    .insert(schema.lookItems)
    .values({
      lookId: look!.id,
      rank: 0,
      category: 'bottom',
      subtype: 'wide-leg trouser',
      searchQuery: 'striped wide leg trousers',
      bbox: [0.3, 0.5, 0.6, 0.9],
    })
    .returning();

  return { userId: user!.id, look: look!, item: item! };
}

describe('shop link validation', () => {
  it('accepts a normal product URL', () => {
    expect(normaliseShopUrl('https://www.aritzia.com/us/en/product/effortless-pant/123.html')).toBe(
      'https://www.aritzia.com/us/en/product/effortless-pant/123.html',
    );
  });

  it('rejects javascript and data URLs', () => {
    // This value is stored and later redirected to, so it is untrusted input
    // on a path that sends other people's browsers somewhere.
    expect(() => normaliseShopUrl('javascript:alert(1)')).toThrow();
    expect(() => normaliseShopUrl('data:text/html,<script>alert(1)</script>')).toThrow();
    expect(() => normaliseShopUrl('file:///etc/passwd')).toThrow();
  });

  it('rejects unparseable input', () => {
    expect(() => normaliseShopUrl('not a url')).toThrow();
    expect(() => normaliseShopUrl('')).toThrow();
  });

  it("strips somebody else's affiliate and tracking tags", () => {
    // Otherwise a pasted link quietly pays a third party out of our redirect.
    const cleaned = normaliseShopUrl(
      'https://shop.example/p/1?utm_source=tiktok&gclid=abc&tag=someone-20&size=M#reviews',
    );
    expect(cleaned).toContain('size=M');
    expect(cleaned).not.toContain('utm_source');
    expect(cleaned).not.toContain('gclid');
    expect(cleaned).not.toContain('tag=');
    expect(cleaned).not.toContain('#reviews');
  });

  it('normalises so two people pasting the same product agree', () => {
    const a = normaliseShopUrl('https://shop.example/p/1?utm_campaign=x');
    const b = normaliseShopUrl('https://shop.example/p/1?fbclid=y');
    expect(a).toBe(b);
  });
});

describe('identifying your own item', () => {
  it('saves the brand, name and link', async () => {
    const { userId, look, item } = await makeLook();

    const result = await setItemManually(db(), {
      userId,
      lookSlug: look.slug,
      itemId: item.id,
      values: {
        brand: 'Aritzia',
        title: 'Effortless Pant',
        url: 'https://aritzia.com/p/effortless',
      },
    });

    expect(result.productId).not.toBeNull();

    const [updated] = await db()
      .select()
      .from(schema.lookItems)
      .where(eq(schema.lookItems.id, item.id));

    expect(updated!.brand).toBe('Aritzia');
    expect(updated!.title).toBe('Effortless Pant');
    expect(updated!.productId).toBe(result.productId);
  });

  it('marks the item so no later automated guess overwrites it', async () => {
    // The person was there. The model was not.
    const { userId, look, item } = await makeLook();
    await setItemManually(db(), {
      userId,
      lookSlug: look.slug,
      itemId: item.id,
      values: { brand: 'Aritzia', url: 'https://aritzia.com/p/1' },
    });

    const [updated] = await db()
      .select()
      .from(schema.lookItems)
      .where(eq(schema.lookItems.id, item.id));
    expect(updated!.isUserCorrected).toBe(true);
  });

  it('refuses to let someone edit a look they do not own', async () => {
    const { look, item } = await makeLook();
    const stranger = await makeLook();

    await expect(
      setItemManually(db(), {
        userId: stranger.userId,
        lookSlug: look.slug,
        itemId: item.id,
        values: { brand: 'Whatever' },
      }),
    ).rejects.toThrow();
  });

  it('requires at least something to save', async () => {
    const { userId, look, item } = await makeLook();
    await expect(
      setItemManually(db(), { userId, lookSlug: look.slug, itemId: item.id, values: {} }),
    ).rejects.toThrow();
  });

  it('rejects a malicious link before it is ever stored', async () => {
    const { userId, look, item } = await makeLook();
    await expect(
      setItemManually(db(), {
        userId,
        lookSlug: look.slug,
        itemId: item.id,
        values: { url: 'javascript:alert(1)' },
      }),
    ).rejects.toThrow();

    const products = await db().select().from(schema.products);
    expect(products).toHaveLength(0);
  });
});

/**
 * The reason this feature is worth more than the API spend it saves: the
 * product cache is global, so one person identifying an item removes it from
 * the paid path for everybody.
 */
describe('seeding the shared product cache', () => {
  it('creates a cache entry the first time somebody identifies a piece', async () => {
    const { userId, look, item } = await makeLook();

    const result = await setItemManually(db(), {
      userId,
      lookSlug: look.slug,
      itemId: item.id,
      values: { brand: 'Aritzia', title: 'Effortless Pant', url: 'https://aritzia.com/p/1' },
    });

    expect(result.seededCache).toBe(true);

    const [product] = await db().select().from(schema.products);
    expect(product!.queryHash).toBe(queryHash('Aritzia Effortless Pant'));
    expect(product!.merchantUrl).toBe('https://aritzia.com/p/1');
    expect(product!.source).toBe('aritzia.com');
  });

  it('reuses the entry when a second person identifies the same piece', async () => {
    // The whole point. The second person's look resolves for free.
    const first = await makeLook();
    await setItemManually(db(), {
      userId: first.userId,
      lookSlug: first.look.slug,
      itemId: first.item.id,
      values: { brand: 'Aritzia', title: 'Effortless Pant', url: 'https://aritzia.com/p/1' },
    });

    const second = await makeLook();
    const result = await setItemManually(db(), {
      userId: second.userId,
      lookSlug: second.look.slug,
      itemId: second.item.id,
      values: { brand: 'Aritzia', title: 'Effortless Pant', url: 'https://aritzia.com/p/1' },
    });

    expect(result.seededCache).toBe(false);
    expect(await db().select().from(schema.products)).toHaveLength(1);
  });

  it('matches regardless of casing and punctuation', async () => {
    const first = await makeLook();
    await setItemManually(db(), {
      userId: first.userId,
      lookSlug: first.look.slug,
      itemId: first.item.id,
      values: { brand: 'Aritzia', title: 'Effortless Pant', url: 'https://aritzia.com/p/1' },
    });

    const second = await makeLook();
    const result = await setItemManually(db(), {
      userId: second.userId,
      lookSlug: second.look.slug,
      itemId: second.item.id,
      values: { brand: 'ARITZIA', title: 'effortless-pant!', url: 'https://aritzia.com/p/1' },
    });

    expect(result.seededCache).toBe(false);
  });

  it('does not create a cache entry without a link', async () => {
    // A name with nowhere to buy it is not worth caching for anyone else.
    const { userId, look, item } = await makeLook();
    const result = await setItemManually(db(), {
      userId,
      lookSlug: look.slug,
      itemId: item.id,
      values: { brand: 'Some Label' },
    });

    expect(result.seededCache).toBe(false);
    expect(await db().select().from(schema.products)).toHaveLength(0);
  });
});

describe('contribution stats', () => {
  it('tracks how much has come off the paid path', async () => {
    const { userId, look, item } = await makeLook();
    await makeLook();

    await setItemManually(db(), {
      userId,
      lookSlug: look.slug,
      itemId: item.id,
      values: { brand: 'Aritzia', url: 'https://aritzia.com/p/1' },
    });

    const stats = await manualContributionStats(db());
    expect(stats.correctedItems).toBe(1);
    expect(stats.totalItems).toBe(2);
    expect(stats.correctedShare).toBeCloseTo(0.5);
    expect(stats.cachedProducts).toBe(1);
  });
});
