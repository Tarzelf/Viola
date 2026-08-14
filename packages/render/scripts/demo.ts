/**
 * Renders the three share cards from a full pipeline run, offline.
 *
 *   pnpm --filter @viola/render demo
 *
 * Writes PNGs to packages/render/.demo so the output can actually be looked at
 * rather than merely asserted about.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { getArchetype } from '@viola/core';
import {
  MemoryProductCache,
  MemoryStorageProvider,
  MockProductSearchProvider,
  mockProviders,
  runPipeline,
} from '@viola/pipeline';
import { renderAllCards } from '../src/index.js';

const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', '.demo');
await mkdir(outDir, { recursive: true });

/** Stands in for a retailer CDN: a product on a white field. */
const palette = ['#6C63FF', '#1B1B22', '#C9A227', '#8FB7D6'];
let served = 0;
const fetchImpl = (async () => {
  const fill = palette[served++ % palette.length]!;
  const png = await sharp({
    create: { width: 700, height: 700, channels: 3, background: { r: 255, g: 255, b: 255 } },
  })
    .composite([
      {
        input: Buffer.from(
          `<svg width="700" height="700"><rect x="150" y="220" width="400" height="260" rx="80" fill="${fill}"/></svg>`,
        ),
      },
    ])
    .png()
    .toBuffer();
  return new Response(new Uint8Array(png), { status: 200 });
}) as typeof fetch;

/** A stand-in mirror selfie: a lit wall with a darker figure left of centre. */
const photo = await sharp({
  create: { width: 1200, height: 1600, channels: 3, background: { r: 132, g: 128, b: 140 } },
})
  .composite([
    {
      input: Buffer.from(`<svg width="1200" height="1600">
        <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#c9c6d0"/><stop offset="100%" stop-color="#6f6b78"/>
        </linearGradient></defs>
        <rect width="1200" height="1600" fill="url(#g)"/>
        <rect x="70" y="120" width="150" height="1300" fill="#5d5966" opacity="0.5"/>
        <rect x="980" y="60" width="180" height="1400" fill="#5d5966" opacity="0.4"/>
        <!-- Figure drawn to match the mock vision fixture's bounding boxes
             (x roughly 0.34-0.60), so the demo layout is honest about where
             the engine thinks the subject is. -->
        <circle cx="560" cy="270" r="78" fill="#2f2b33"/>
        <rect x="432" y="370" width="288" height="450" rx="48" fill="#3a3540"/>
        <rect x="456" y="800" width="240" height="560" rx="42" fill="#2b2730"/>
        <rect x="440" y="1380" width="260" height="110" rx="34" fill="#242029"/>
      </svg>`),
    },
  ])
  .jpeg({ quality: 92 })
  .toBuffer();

const storage = new MemoryStorageProvider();
const products = new MockProductSearchProvider();
const providers = mockProviders({ storage, products });

const look = await runPipeline({
  lookId: 'render-demo',
  image: photo,
  providers,
  cache: new MemoryProductCache(),
  fetchImpl,
});

const archetype = getArchetype(look.archetypeId);

const items = await Promise.all(
  look.items.map(async (item) => ({
    index: item.index,
    brand: item.brand,
    title: item.title,
    subtype: item.subtype,
    priceCents: item.product?.priceCents ?? null,
    cutout: item.product?.imagePath ? await storage.get(item.product.imagePath) : null,
  })),
);

const cards = await renderAllCards({
  photo,
  items,
  layout: look.layout,
  archetypeName: archetype?.name ?? 'Clean Girl',
  score: look.score.overall,
  handle: 'maya',
});

for (const [variant, card] of Object.entries(cards)) {
  const file = join(outDir, `${variant}.png`);
  await writeFile(file, card.png);
  console.log(
    `${variant.padEnd(7)} ${String(card.width).padStart(4)}x${String(card.height).padEnd(4)} ` +
      `${String(card.ms).padStart(4)}ms  ${(card.png.length / 1024).toFixed(0)}KB  ${file}`,
  );
}

const left = look.layout.slots.filter((s) => s.side === 'left').length;
const right = look.layout.slots.filter((s) => s.side === 'right').length;
console.log(
  `\n${archetype?.name} · ${look.score.overall} — ${look.items.length} items, ${left} left / ${right} right\n`,
);
