import 'server-only';
import { eq } from 'drizzle-orm';
import sharp from 'sharp';
import { schema, type Database } from '@viola/db';
import { computeLayout, makeCutout, type StorageProvider } from '@viola/pipeline';

/**
 * Generates artwork and layouts for the seeded looks.
 *
 * The database seed creates rows that reference image paths, but nothing puts
 * bytes behind them. Without this step a fresh clone shows a feed of grey
 * placeholders, which makes the product impossible to evaluate and — more
 * practically — impossible to design against.
 *
 * The imagery is synthetic on purpose: shipping real photographs of people in a
 * public repository is a licensing and privacy problem nobody needs. These are
 * abstract figures with the right tonal structure, which is enough to judge
 * composition, contrast and the placement engine.
 *
 * It also runs the real layout engine over the seeded bounding boxes, so the
 * annotated cards in the seeded feed are produced by exactly the same code that
 * will run on a genuine upload.
 */

const FIGURE_PALETTES = [
  { bg: ['#c9c6d0', '#6f6b78'], body: '#3a3540', legs: '#2b2730' },
  { bg: ['#d8cfc6', '#7a6f66'], body: '#2f2b33', legs: '#26222b' },
  { bg: ['#c2ccd6', '#68727c'], body: '#41404a', legs: '#2e2d36' },
] as const;

const CUTOUT_FILLS = ['#6C63FF', '#1B1B22', '#C9A227', '#8FB7D6', '#D8CFC6', '#4A4458'];

async function mirrorSelfie(index: number): Promise<Buffer> {
  const palette = FIGURE_PALETTES[index % FIGURE_PALETTES.length]!;
  const lean = (index % 3) - 1;
  const centre = 600 + lean * 40;

  return sharp({
    create: { width: 1200, height: 1500, channels: 3, background: { r: 130, g: 126, b: 138 } },
  })
    .composite([
      {
        input: Buffer.from(`<svg width="1200" height="1500">
          <defs>
            <linearGradient id="wall" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="${palette.bg[0]}"/>
              <stop offset="100%" stop-color="${palette.bg[1]}"/>
            </linearGradient>
          </defs>
          <rect width="1200" height="1500" fill="url(#wall)"/>
          <rect x="40" y="90" width="140" height="1320" fill="#55515e" opacity="0.28"/>
          <rect x="1010" y="40" width="160" height="1400" fill="#55515e" opacity="0.22"/>
          <rect x="0" y="1330" width="1200" height="170" fill="#4a4652" opacity="0.35"/>
          <circle cx="${centre}" cy="255" r="76" fill="${palette.body}"/>
          <rect x="${centre - 145}" y="350" width="290" height="430" rx="52" fill="${palette.body}"/>
          <rect x="${centre - 118}" y="760" width="236" height="520" rx="44" fill="${palette.legs}"/>
          <rect x="${centre - 128}" y="1265" width="256" height="96" rx="34" fill="#211e27"/>
        </svg>`),
      },
    ])
    .jpeg({ quality: 88 })
    .toBuffer();
}

async function catalogueCutout(index: number): Promise<Buffer> {
  const fill = CUTOUT_FILLS[index % CUTOUT_FILLS.length]!;
  // Drawn on white, exactly like real catalogue photography, then run through
  // the production cutout path so the seeded assets exercise the same code.
  const onWhite = await sharp({
    create: { width: 700, height: 700, channels: 3, background: { r: 255, g: 255, b: 255 } },
  })
    .composite([
      {
        input: Buffer.from(
          `<svg width="700" height="700"><rect x="140" y="210" width="420" height="280" rx="${
            60 + (index % 3) * 40
          }" fill="${fill}"/></svg>`,
        ),
      },
    ])
    .png()
    .toBuffer();

  return makeCutout(onWhite, { width: 420 });
}

export async function generateSeedMedia(db: Database, storage: StorageProvider): Promise<number> {
  const looks = await db.select().from(schema.looks);
  let written = 0;

  // --- product cutouts -----------------------------------------------------
  const products = await db.select().from(schema.products);
  for (const [index, product] of products.entries()) {
    if (!product.imagePath) continue;
    if (await storage.exists(product.imagePath)) continue;
    await storage.put(product.imagePath, await catalogueCutout(index), 'image/png');
    written++;
  }

  // --- photos and layouts --------------------------------------------------
  for (const [index, look] of looks.entries()) {
    if (!(await storage.exists(look.photoPath))) {
      await storage.put(look.photoPath, await mirrorSelfie(index), 'image/jpeg');
      written++;
    }

    if (!look.layout) {
      const items = await db
        .select({ bbox: schema.lookItems.bbox })
        .from(schema.lookItems)
        .where(eq(schema.lookItems.lookId, look.id))
        .orderBy(schema.lookItems.rank);

      // The genuine engine, over the seeded boxes.
      const layout = computeLayout({ boxes: items.map((i) => i.bbox) });
      await db
        .update(schema.looks)
        .set({ layout, photoWidth: 1200, photoHeight: 1500 })
        .where(eq(schema.looks.id, look.id));
    }
  }

  return written;
}
