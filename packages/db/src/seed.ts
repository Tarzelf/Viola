import { computeScore, generateSlug, getArchetype, type ScoreBreakdown } from '@viola/core';
import type { Database } from './client';
import {
  blooms,
  lookItems,
  lookViews,
  looks,
  productOffers,
  products,
  profiles,
  sponsoredPlacements,
  users,
  vaultItems,
  vaults,
} from './schema/index';

/**
 * Demo data.
 *
 * Deliberately realistic rather than lorem ipsum: the seed is what the app is
 * demoed and designed against, so unconvincing content produces unconvincing
 * design decisions. Brands, prices and retailers below are plausible real-world
 * examples used purely as local fixtures.
 *
 * Deterministic — a seeded PRNG means screenshots and golden tests stay stable
 * across runs.
 */

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(0x71013);
const pick = <T>(arr: readonly T[]): T => arr[Math.floor(rand() * arr.length)]!;
const int = (lo: number, hi: number) => lo + Math.floor(rand() * (hi - lo + 1));

interface SeedProduct {
  brand: string;
  title: string;
  query: string;
  source: string;
  priceCents: number;
  url: string;
  rating: number;
  reviews: number;
  secondhand?: { retailer: string; priceCents: number; url: string };
}

const PRODUCTS: SeedProduct[] = [
  {
    brand: 'HOKA',
    title: 'Skyward X',
    query: 'hoka skyward x blue',
    source: 'HOKA',
    priceCents: 22500,
    url: 'https://www.hoka.com/en/us/mens-road/skyward-x/',
    rating: 4.6,
    reviews: 812,
    secondhand: { retailer: 'Poshmark', priceCents: 12000, url: 'https://poshmark.com/hoka' },
  },
  {
    brand: 'COROS',
    title: 'Pace Pro',
    query: 'coros pace pro gps watch',
    source: 'COROS',
    priceCents: 34900,
    url: 'https://coros.com/pace-pro',
    rating: 4.8,
    reviews: 1240,
  },
  {
    brand: 'Under Armour',
    title: 'UA Launch 5" Shorts',
    query: 'under armour ua launch 5 inch shorts black',
    source: 'Under Armour',
    priceCents: 3500,
    url: 'https://www.underarmour.com/en-us/p/shorts/ua-launch-5-shorts/',
    rating: 4.5,
    reviews: 3410,
  },
  {
    brand: 'Aritzia',
    title: 'Effortless Pant',
    query: 'aritzia effortless pant black',
    source: 'Aritzia',
    priceCents: 12800,
    url: 'https://www.aritzia.com/us/en/product/effortless-pant',
    rating: 4.7,
    reviews: 2210,
    secondhand: { retailer: 'Depop', priceCents: 5500, url: 'https://depop.com/aritzia' },
  },
  {
    brand: 'The Row',
    title: 'Margaux 15 Tote',
    query: 'the row margaux 15 tote black',
    source: 'Net-a-Porter',
    priceCents: 590000,
    url: 'https://www.net-a-porter.com/the-row-margaux',
    rating: 4.9,
    reviews: 87,
  },
  {
    brand: 'Sambas',
    title: 'adidas Samba OG',
    query: 'adidas samba og white black',
    source: 'adidas',
    priceCents: 10000,
    url: 'https://www.adidas.com/us/samba-og-shoes',
    rating: 4.8,
    reviews: 9820,
    secondhand: { retailer: 'eBay', priceCents: 6500, url: 'https://ebay.com/samba' },
  },
  {
    brand: 'Uniqlo',
    title: 'Heattech Turtleneck',
    query: 'uniqlo heattech turtleneck cream',
    source: 'Uniqlo',
    priceCents: 1990,
    url: 'https://www.uniqlo.com/us/en/products/heattech-turtleneck',
    rating: 4.4,
    reviews: 5120,
  },
  {
    brand: 'Levi’s',
    title: "501 '90s Jeans",
    query: 'levis 501 90s jeans mid wash',
    source: "Levi's",
    priceCents: 9800,
    url: 'https://www.levi.com/US/en_US/clothing/women/jeans/501-90s',
    rating: 4.6,
    reviews: 4400,
    secondhand: { retailer: 'ThredUp', priceCents: 2900, url: 'https://thredup.com/levis' },
  },
];

interface SeedLook {
  handle: string;
  caption: string;
  archetypeId: string;
  styleTags: string[];
  raw: ScoreBreakdown;
  items: Array<{
    category: string;
    subtype: string;
    productIndex: number;
    bbox: [number, number, number, number];
    description: string;
  }>;
}

const LOOK_TEMPLATES: SeedLook[] = [
  {
    handle: 'maya',
    caption: 'morning 5.5 before the heat',
    archetypeId: 'athleisure-luxe',
    styleTags: ['athletic', 'technical', 'running', 'sporty'],
    raw: { fit: 78, colorStory: 71, texture: 63, statement: 60, cohesion: 82 },
    items: [
      {
        category: 'watch',
        subtype: 'GPS running watch',
        productIndex: 1,
        bbox: [0.55, 0.3, 0.66, 0.37],
        description: 'A titanium-bezel GPS watch built for long efforts.',
      },
      {
        category: 'bottom',
        subtype: '5" running shorts',
        productIndex: 2,
        bbox: [0.36, 0.5, 0.56, 0.63],
        description: 'Lightweight woven shorts with a built-in liner.',
      },
      {
        category: 'footwear',
        subtype: 'road running shoe',
        productIndex: 0,
        bbox: [0.36, 0.85, 0.55, 0.94],
        description: 'A tall, springy carbon-plated trainer in cobalt.',
      },
    ],
  },
  {
    handle: 'noor',
    caption: 'all black everything, as usual',
    archetypeId: 'downtown-girl',
    styleTags: ['black', 'oversized', 'urban', 'leather'],
    raw: { fit: 85, colorStory: 74, texture: 79, statement: 81, cohesion: 92 },
    items: [
      {
        category: 'bag',
        subtype: 'structured tote',
        productIndex: 4,
        bbox: [0.58, 0.42, 0.74, 0.58],
        description: 'A soft-structured leather tote that holds its shape.',
      },
      {
        category: 'bottom',
        subtype: 'wide-leg trouser',
        productIndex: 3,
        bbox: [0.33, 0.52, 0.55, 0.86],
        description: 'A fluid high-rise trouser with a clean break.',
      },
      {
        category: 'footwear',
        subtype: 'retro sneaker',
        productIndex: 5,
        bbox: [0.34, 0.88, 0.54, 0.96],
        description: 'The gum-sole terrace sneaker that refuses to die.',
      },
    ],
  },
  {
    handle: 'priya',
    caption: 'thrifted the jeans, sorry to everyone',
    archetypeId: 'clean-girl',
    styleTags: ['minimalist', 'neutral', 'clean', 'denim'],
    raw: { fit: 88, colorStory: 83, texture: 70, statement: 64, cohesion: 90 },
    items: [
      {
        category: 'top',
        subtype: 'ribbed turtleneck',
        productIndex: 6,
        bbox: [0.36, 0.26, 0.6, 0.5],
        description: 'A slim cream turtleneck that layers under everything.',
      },
      {
        category: 'bottom',
        subtype: 'straight-leg jeans',
        productIndex: 7,
        bbox: [0.34, 0.5, 0.58, 0.88],
        description: 'Mid-wash straight jeans with a vintage-correct rise.',
      },
      {
        category: 'footwear',
        subtype: 'retro sneaker',
        productIndex: 5,
        bbox: [0.36, 0.89, 0.56, 0.97],
        description: 'The gum-sole terrace sneaker that refuses to die.',
      },
    ],
  },
];

export interface SeedResult {
  users: number;
  looks: number;
  items: number;
  products: number;
}

export async function seed(db: Database): Promise<SeedResult> {
  // --- products (the global cache) -----------------------------------------
  const productIds: string[] = [];
  for (const p of PRODUCTS) {
    const [row] = await db
      .insert(products)
      .values({
        queryHash: `seed-${p.query.replace(/\s+/g, '-')}`,
        normalisedQuery: p.query,
        brand: p.brand,
        title: p.title,
        description: `${p.brand} ${p.title}`,
        source: p.source,
        merchantUrl: p.url,
        priceCents: p.priceCents,
        rating: p.rating,
        reviewCount: p.reviews,
        imagePath: `seed/products/${p.query.replace(/\s+/g, '-')}.png`,
        imageTrimmed: true,
      })
      .returning();
    productIds.push(row!.id);

    // Secondhand alternates are first-class: ~75% of the target audience rank
    // sustainability above brand name, and resale is a large share of spend.
    if (p.secondhand) {
      await db.insert(productOffers).values({
        productId: row!.id,
        retailer: p.secondhand.retailer,
        url: p.secondhand.url,
        priceCents: p.secondhand.priceCents,
        isSecondhand: true,
        rank: 1,
      });
    }
  }

  // --- users and profiles ---------------------------------------------------
  const people = [
    { handle: 'maya', name: 'Maya', bio: 'running, mostly badly' },
    { handle: 'noor', name: 'Noor', bio: 'black is a colour' },
    { handle: 'priya', name: 'Priya', bio: 'thrifted or bust' },
  ];

  const userIds = new Map<string, string>();
  for (const person of people) {
    const [user] = await db
      .insert(users)
      .values({ email: `${person.handle}@viola.app`, emailVerifiedAt: new Date() })
      .returning();
    userIds.set(person.handle, user!.id);
    await db.insert(profiles).values({
      userId: user!.id,
      handle: person.handle,
      displayName: person.name,
      bio: person.bio,
    });
    await db.insert(vaults).values({
      userId: user!.id,
      name: 'Saved',
      slug: `saved-${person.handle}`,
      isDefault: true,
    });
  }

  // --- looks ----------------------------------------------------------------
  let itemCount = 0;
  let lookCount = 0;
  const createdLookIds: string[] = [];

  // Four rounds of the templates gives twelve looks with varied counters.
  for (let round = 0; round < 4; round++) {
    for (const template of LOOK_TEMPLATES) {
      const userId = userIds.get(template.handle)!;
      const archetype = getArchetype(template.archetypeId);
      const score = computeScore({
        raw: template.raw,
        archetype,
        itemCount: template.items.length,
      });

      const [look] = await db
        .insert(looks)
        .values({
          userId,
          slug: generateSlug(rand),
          photoPath: `seed/looks/${template.handle}-${round}.jpg`,
          photoWidth: 1200,
          photoHeight: 1500,
          status: 'ready',
          caption: template.caption,
          visibility: 'public',
          score: score.overall,
          scoreBreakdown: score.breakdown,
          archetypeId: template.archetypeId,
          styleTags: template.styleTags,
          storyCardPath: `seed/cards/${template.handle}-${round}-story.png`,
          ogCardPath: `seed/cards/${template.handle}-${round}-og.png`,
          viewCount: int(120, 9400),
          bloomCount: 0,
          publishedAt: new Date(Date.now() - round * 86_400_000 - int(0, 60) * 60_000),
        })
        .returning();

      createdLookIds.push(look!.id);
      lookCount++;

      for (const [rank, item] of template.items.entries()) {
        await db.insert(lookItems).values({
          lookId: look!.id,
          rank,
          isPrimary: true,
          category: item.category,
          subtype: item.subtype,
          brand: PRODUCTS[item.productIndex]!.brand,
          title: PRODUCTS[item.productIndex]!.title,
          description: item.description,
          bbox: item.bbox,
          confidence: 0.7 + rand() * 0.29,
          searchQuery: PRODUCTS[item.productIndex]!.query,
          productId: productIds[item.productIndex]!,
        });
        itemCount++;
      }
    }
  }

  // --- blooms and views -----------------------------------------------------
  const allUserIds = [...userIds.values()];
  for (const lookId of createdLookIds) {
    let count = 0;

    for (const uid of allUserIds) {
      if (rand() > 0.45) {
        await db.insert(blooms).values({ lookId, userId: uid });
        count++;
      }
    }
    // Guests bloom too — that no-account path is the main viral lever, so the
    // demo data should reflect it rather than pretending everyone signs up.
    const guests = int(3, 60);
    for (let g = 0; g < guests; g++) {
      await db.insert(blooms).values({ lookId, guestId: `seed-guest-${lookId.slice(0, 8)}-${g}` });
      count++;
    }

    await db.update(looks).set({ bloomCount: count }).where(eqLook(lookId));

    for (let v = 0; v < 5; v++) {
      await db.insert(lookViews).values({
        lookId,
        viewerHash: `seed-viewer-${v}`,
        source: pick(['feed', 'share_link', 'profile']),
      });
    }
  }

  // --- a saved item in each default vault -----------------------------------
  const allVaults = await db.select().from(vaults);
  for (const [i, vault] of allVaults.entries()) {
    await db.insert(vaultItems).values({
      vaultId: vault.id,
      productId: productIds[i % productIds.length]!,
      position: 0,
    });
    await db.update(vaults).set({ itemCount: 1 }).where(eqVault(vault.id));
  }

  // --- one sponsored placement ---------------------------------------------
  await db.insert(sponsoredPlacements).values({
    brandName: 'Aritzia',
    headline: 'The Effortless Pant, restocked',
    body: 'The one that sells out. Back in four colours.',
    imagePath: 'seed/sponsored/aritzia.jpg',
    ctaLabel: 'Shop the drop',
    targetUrl: 'https://www.aritzia.com/us/en/product/effortless-pant',
    frequency: 7,
    isActive: true,
  });

  return { users: people.length, looks: lookCount, items: itemCount, products: PRODUCTS.length };
}

// Small local helpers to keep the drizzle imports in this file minimal.
import { eq } from 'drizzle-orm';
const eqLook = (id: string) => eq(looks.id, id);
const eqVault = (id: string) => eq(vaults.id, id);
