import { createHash } from 'node:crypto';
import sharp from 'sharp';

/**
 * A stand-in retailer CDN for mock mode.
 *
 * Without this, every development upload resolves products correctly and then
 * fails to fetch their imagery, because the mock catalogue points at a hostname
 * that does not exist. The pipeline degrades gracefully — labels and prices
 * still render — but you never see a finished card, which makes the product
 * impossible to evaluate or design against locally.
 *
 * Images are generated deterministically from the URL so the same product
 * always looks the same, keeping screenshots and golden tests stable. They are
 * drawn on white exactly like real catalogue photography, so they exercise the
 * genuine cutout path rather than skipping it.
 */

export const FIXTURE_HOST = 'https://cdn.viola-fixtures.test';

const SHAPES = ['pill', 'block', 'round', 'tall'] as const;
const PALETTE = [
  '#6C63FF',
  '#1B1B22',
  '#C9A227',
  '#8FB7D6',
  '#D8CFC6',
  '#4A4458',
  '#B25B67',
  '#3F6F5A',
];

function shapeFor(seed: number): string {
  const shape = SHAPES[seed % SHAPES.length]!;
  const fill = PALETTE[seed % PALETTE.length]!;

  switch (shape) {
    case 'pill':
      return `<rect x="120" y="230" width="460" height="240" rx="120" fill="${fill}"/>`;
    case 'block':
      return `<rect x="160" y="170" width="380" height="360" rx="46" fill="${fill}"/>`;
    case 'round':
      return `<circle cx="350" cy="350" r="205" fill="${fill}"/>`;
    case 'tall':
      return `<rect x="215" y="110" width="270" height="480" rx="64" fill="${fill}"/>`;
  }
}

export async function fixtureImage(url: string): Promise<Buffer> {
  const seed = parseInt(createHash('sha256').update(url).digest('hex').slice(0, 6), 16);

  return sharp({
    create: { width: 700, height: 700, channels: 3, background: { r: 255, g: 255, b: 255 } },
  })
    .composite([{ input: Buffer.from(`<svg width="700" height="700">${shapeFor(seed)}</svg>`) }])
    .png()
    .toBuffer();
}

/**
 * A `fetch` that serves fixture catalogue images and passes everything else
 * through. Used in mock mode so a local upload produces a complete card.
 */
export function createFixtureFetch(passthrough: typeof fetch = fetch): typeof fetch {
  return (async (input: string | URL | Request, init?: RequestInit) => {
    const url =
      typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;

    if (url.startsWith(FIXTURE_HOST)) {
      const png = await fixtureImage(url);
      return new Response(new Uint8Array(png), {
        status: 200,
        headers: { 'content-type': 'image/png' },
      });
    }

    return passthrough(input as never, init);
  }) as typeof fetch;
}
