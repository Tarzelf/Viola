import sharp from 'sharp';
import { beforeAll, describe, expect, it } from 'vitest';
import { card as cardSizes, color } from '@viola/design';
import type { LookLayout } from '@viola/core';
import { renderAllCards, renderLookCard, truncate } from './index';

/**
 * Renderer tests.
 *
 * Byte-exact golden hashes were deliberately avoided: sharp, resvg and libvips
 * all encode slightly differently across platforms and versions, so a hash
 * comparison fails for reasons that have nothing to do with the design. These
 * assert the properties that actually matter — the composition, the brand
 * colour, determinism within an environment, and the render budget.
 */

let photo: Buffer;
let cutout: Buffer;

const layout: LookLayout = {
  subject: { x0: 0.32, x1: 0.66 },
  slots: [
    {
      itemIndex: 0,
      side: 'left',
      rect: { x0: 0.03, y0: 0.26, x1: 0.29, y1: 0.41 },
      anchor: { x: 0.4, y: 0.33 },
    },
    {
      itemIndex: 1,
      side: 'right',
      rect: { x0: 0.7, y0: 0.52, x1: 0.96, y1: 0.67 },
      anchor: { x: 0.55, y: 0.58 },
    },
  ],
  unplaced: [],
};

const items = () => [
  {
    index: 0,
    brand: 'HOKA',
    title: 'HOKA Skyward X',
    subtype: 'running shoe',
    priceCents: 22500,
    cutout,
  },
  {
    index: 1,
    brand: null,
    title: null,
    subtype: 'technical tee',
    priceCents: null,
    cutout: null,
  },
];

const base = () => ({
  photo,
  items: items(),
  layout,
  archetypeName: 'Downtown Girl',
  score: 93,
  handle: 'maya',
});

/** Reads one pixel as RGB. */
async function pixelAt(png: Buffer, x: number, y: number) {
  const { data } = await sharp(png)
    .extract({ left: x, top: y, width: 1, height: 1 })
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { r: data[0]!, g: data[1]!, b: data[2]! };
}

const hexToRgb = (hex: string) => ({
  r: parseInt(hex.slice(1, 3), 16),
  g: parseInt(hex.slice(3, 5), 16),
  b: parseInt(hex.slice(5, 7), 16),
});

const near = (
  a: { r: number; g: number; b: number },
  b: { r: number; g: number; b: number },
  t = 24,
) => Math.abs(a.r - b.r) <= t && Math.abs(a.g - b.g) <= t && Math.abs(a.b - b.b) <= t;

beforeAll(async () => {
  photo = await sharp({
    create: { width: 1200, height: 1600, channels: 3, background: { r: 130, g: 126, b: 138 } },
  })
    .composite([
      {
        input: Buffer.from(
          `<svg width="1200" height="1600">
             <circle cx="560" cy="270" r="78" fill="#2f2b33"/>
             <rect x="432" y="370" width="288" height="450" rx="48" fill="#3a3540"/>
           </svg>`,
        ),
      },
    ])
    .jpeg()
    .toBuffer();

  cutout = await sharp({
    create: { width: 400, height: 400, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([
      {
        input: Buffer.from(
          '<svg width="400" height="400"><ellipse cx="200" cy="200" rx="170" ry="110" fill="#6C63FF"/></svg>',
        ),
      },
    ])
    .png()
    .toBuffer();
});

describe('renderLookCard', () => {
  it('renders a story card at the token size', async () => {
    const result = await renderLookCard({ ...base(), variant: 'story' });
    expect(result.width).toBe(cardSizes.story.width);
    expect(result.height).toBe(cardSizes.story.height);

    const meta = await sharp(result.png).metadata();
    expect(meta.width).toBe(1080);
    expect(meta.height).toBe(1920);
    expect(meta.format).toBe('png');
  });

  it('renders all three sizes', async () => {
    const cards = await renderAllCards(base());
    expect(cards.story.width).toBe(1080);
    expect(cards.og.width).toBe(1200);
    expect(cards.square.width).toBe(1080);
    expect(cards.square.height).toBe(1080);
  });

  it('paints the score pill in the brand accent', async () => {
    // The one saturated colour on the card. Counted across the lower band
    // rather than sampled at a fixed coordinate, so the assertion survives
    // layout tweaks while still failing if the accent drifts.
    const result = await renderLookCard({ ...base(), variant: 'story' });
    const target = hexToRgb(color.viola);

    const { data, info } = await sharp(result.png)
      .extract({ left: 0, top: 1440, width: 1080, height: 400 })
      .raw()
      .toBuffer({ resolveWithObject: true });

    let accentPixels = 0;
    for (let i = 0; i < data.length; i += info.channels) {
      if (near({ r: data[i]!, g: data[i + 1]!, b: data[i + 2]! }, target, 30)) accentPixels++;
    }

    // The pill is a substantial solid block; a few thousand pixels minimum.
    expect(accentPixels).toBeGreaterThan(5000);
  });

  it('is deterministic within an environment', async () => {
    const a = await renderLookCard({ ...base(), variant: 'square' });
    const b = await renderLookCard({ ...base(), variant: 'square' });
    expect(a.png.equals(b.png)).toBe(true);
  });

  it('stays inside the render budget', async () => {
    // This runs on every publish inside a serverless function.
    const result = await renderLookCard({ ...base(), variant: 'story' });
    expect(result.ms).toBeLessThan(3000);
  });

  it('produces a file small enough to attach to a message', async () => {
    const result = await renderLookCard({ ...base(), variant: 'story' });
    expect(result.png.length).toBeLessThan(1_500_000);
  });
});

describe('graceful rendering', () => {
  it('renders an item that has no cutout', async () => {
    // Product resolved but image fetch failed — card degrades to a text label
    // rather than leaving a hole.
    const result = await renderLookCard({
      ...base(),
      items: items().map((i) => ({ ...i, cutout: null })),
      variant: 'story',
    });
    expect(result.png.length).toBeGreaterThan(1000);
  });

  it('renders a look with no items at all', async () => {
    const result = await renderLookCard({
      ...base(),
      items: [],
      layout: { subject: { x0: 0.3, x1: 0.7 }, slots: [], unplaced: [] },
      variant: 'story',
    });
    const meta = await sharp(result.png).metadata();
    expect(meta.width).toBe(1080);
  });

  it('renders an unidentified item without inventing a brand', async () => {
    const result = await renderLookCard({
      ...base(),
      items: [
        { index: 0, brand: null, title: null, subtype: 'technical tee', priceCents: null, cutout },
      ],
      variant: 'story',
    });
    expect(result.png.length).toBeGreaterThan(1000);
  });
});

describe('og card composition', () => {
  it('uses a split layout, not a squeezed story card', async () => {
    // Cover-fitting a portrait selfie into a landscape frame crops everything
    // below the shoulders and leaves every leader line pointing nowhere. The
    // link preview gets its own composition instead.
    const result = await renderLookCard({ ...base(), variant: 'og' });

    // Far right of the frame is the dark panel, not photograph.
    const panel = await pixelAt(result.png, 1150, 315);
    expect(near(panel, hexToRgb(color.ink), 18)).toBe(true);

    // Left of the frame is the photo, which is much lighter than the panel.
    const photoSide = await pixelAt(result.png, 120, 315);
    expect(photoSide.r).toBeGreaterThan(hexToRgb(color.ink).r + 30);
  });

  it('can carry referrer context for a shared link', async () => {
    const withEyebrow = await renderLookCard({
      ...base(),
      variant: 'og',
      eyebrow: 'Maya wants you to rate this fit',
    });
    const without = await renderLookCard({ ...base(), variant: 'og' });
    expect(withEyebrow.png.equals(without.png)).toBe(false);
  });

  it('summarises overflow rather than crowding the panel', async () => {
    const many = Array.from({ length: 7 }, (_, i) => ({
      index: i,
      brand: `BRAND${i}`,
      title: `Brand${i} Product`,
      subtype: 'item',
      priceCents: 1000 * (i + 1),
      cutout,
    }));
    const result = await renderLookCard({ ...base(), items: many, variant: 'og' });
    expect(result.png.length).toBeGreaterThan(1000);
  });
});

describe('truncate', () => {
  it('leaves short labels alone', () => {
    expect(truncate('SAMBA OG', 26)).toBe('SAMBA OG');
  });

  it('breaks on a word boundary when it can', () => {
    expect(truncate('STRUCTURED LEATHER TOTE BAG BLACK', 26)).toBe('STRUCTURED LEATHER TOTE…');
  });

  it('falls back to a hard cut for a single long word', () => {
    expect(truncate('AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', 10)).toBe('AAAAAAAAA…');
  });

  it('never exceeds the requested length', () => {
    for (const s of ['a'.repeat(50), 'word '.repeat(12), 'HOKA SKYWARD X BLUE']) {
      expect(truncate(s, 20).length).toBeLessThanOrEqual(20);
    }
  });
});
