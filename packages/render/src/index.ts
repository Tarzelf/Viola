import { Resvg } from '@resvg/resvg-js';
import satori from 'satori';
import sharp from 'sharp';
import { card as cardSizes } from '@viola/design';
import { buildCard, type CardInput, type CardItem } from './card';
import { buildOgCard } from './og-card';
import { loadFonts } from './fonts';

export * from './card';
export * from './og-card';
export * from './fonts';

/**
 * Server-side share-card rendering.
 *
 * satori turns an element tree into SVG, resvg rasterises it. No Chrome, no
 * Puppeteer, no Docker — which matters because this has to run inside a normal
 * serverless function on every publish. Measured at roughly 300ms for a full
 * 1080x1920 card.
 *
 * Note: @resvg/resvg-js is a native binding, so any route rendering a card must
 * use the Node runtime rather than Edge.
 */

export type CardVariant = 'story' | 'og' | 'square';

export interface RenderLookCardInput {
  variant: CardVariant;
  photo: Buffer;
  photoMimeType?: string;
  items: Array<Omit<CardItem, 'cutoutDataUri'> & { cutout?: Buffer | null }>;
  layout: CardInput['layout'];
  archetypeName: string;
  score: number;
  handle: string;
  /** Referrer context for the link preview, e.g. "Maya wants you to rate this". */
  eyebrow?: string;
}

export interface RenderedCard {
  png: Buffer;
  width: number;
  height: number;
  ms: number;
}

function sizeFor(variant: CardVariant): { width: number; height: number } {
  return cardSizes[variant];
}

const dataUri = (buf: Buffer, mime: string) => `data:${mime};base64,${buf.toString('base64')}`;

/**
 * Pre-scales the photo to the card size.
 *
 * satori will happily accept a 4000px source and cover-fit it, but resvg then
 * rasterises the full-resolution bitmap, which is both slow and memory hungry.
 * Resizing first cuts render time substantially for no visible difference.
 */
async function preparePhoto(photo: Buffer, width: number, height: number): Promise<string> {
  const resized = await sharp(photo)
    .resize(width, height, { fit: 'cover', position: 'attention' })
    .jpeg({ quality: 88 })
    .toBuffer();
  return dataUri(resized, 'image/jpeg');
}

/** The OG panel only occupies part of the frame, so its photo is narrower. */
const OG_PHOTO_FRACTION = 0.42;

export async function renderLookCard(input: RenderLookCardInput): Promise<RenderedCard> {
  const started = Date.now();
  const { width, height } = sizeFor(input.variant);

  const photoWidth = input.variant === 'og' ? Math.round(width * OG_PHOTO_FRACTION) : width;

  const [fonts, photoDataUri] = await Promise.all([
    loadFonts(),
    preparePhoto(input.photo, photoWidth, height),
  ]);

  const items: CardItem[] = input.items.map((item) => ({
    index: item.index,
    brand: item.brand,
    title: item.title,
    subtype: item.subtype,
    priceCents: item.priceCents,
    cutoutDataUri: item.cutout ? dataUri(item.cutout, 'image/png') : null,
  }));

  const tree =
    input.variant === 'og'
      ? buildOgCard({
          photoDataUri,
          items,
          archetypeName: input.archetypeName,
          score: input.score,
          handle: input.handle,
          width,
          height,
          ...(input.eyebrow ? { eyebrow: input.eyebrow } : {}),
        })
      : buildCard({
          photoDataUri,
          items,
          layout: input.layout,
          archetypeName: input.archetypeName,
          score: input.score,
          handle: input.handle,
          width,
          height,
          variant: input.variant,
        });

  const svg = await satori(tree as never, { width, height, fonts });
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: width } }).render().asPng();

  return { png: Buffer.from(png), width, height, ms: Date.now() - started };
}

/**
 * Renders all three sizes.
 *
 * story  — 1080x1920, saved to camera roll for Instagram and TikTok
 * og     — 1200x630, the link preview in iMessage and everywhere else
 * square — 1080x1080, feed and profile grid
 */
export async function renderAllCards(
  input: Omit<RenderLookCardInput, 'variant'>,
): Promise<Record<CardVariant, RenderedCard>> {
  const [story, og, square] = await Promise.all([
    renderLookCard({ ...input, variant: 'story' }),
    renderLookCard({ ...input, variant: 'og' }),
    renderLookCard({ ...input, variant: 'square' }),
  ]);
  return { story, og, square };
}
