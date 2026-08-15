import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import {
  ANALYSIS_HEIGHT,
  ANALYSIS_WIDTH,
  MAX_UPLOAD_EDGE,
  analysisRaster,
  dominantColour,
  hasLocationMetadata,
  luminance,
  makeCutout,
  prepareUpload,
  solidImage,
  tinyPlaceholder,
} from './imagery';

/** A JPEG carrying EXIF, including a GPS block. */
async function photoWithGps(): Promise<Buffer> {
  return sharp({
    create: { width: 800, height: 1000, channels: 3, background: { r: 120, g: 110, b: 130 } },
  })
    .withExif({
      IFD0: { Make: 'Apple', Model: 'iPhone 15 Pro' },
      // sharp writes the GPS block as IFD3, not a key called "GPS".
      IFD3: { GPSLatitudeRef: 'N', GPSLongitudeRef: 'W', GPSAltitude: '100/1' },
    })
    .jpeg()
    .toBuffer();
}

describe('prepareUpload', () => {
  it('strips all location metadata', async () => {
    // Not an optimisation — a privacy requirement. This app's content type is
    // literally "here is where I am, in a mirror", and phone photos carry GPS.
    const original = await photoWithGps();
    expect(await hasLocationMetadata(original)).toBe(true);

    const prepared = await prepareUpload(original);
    expect(await hasLocationMetadata(prepared.data)).toBe(false);

    const meta = await sharp(prepared.data).metadata();
    expect(meta.exif).toBeUndefined();
  });

  it('downscales oversized uploads', async () => {
    const huge = await solidImage(4000, 5000, { r: 10, g: 20, b: 30 });
    const prepared = await prepareUpload(huge);
    expect(Math.max(prepared.width, prepared.height)).toBeLessThanOrEqual(MAX_UPLOAD_EDGE);
  });

  it('leaves small uploads at their original size', async () => {
    const small = await solidImage(400, 500, { r: 10, g: 20, b: 30 });
    const prepared = await prepareUpload(small);
    expect(prepared.width).toBe(400);
    expect(prepared.height).toBe(500);
  });

  it('normalises to JPEG', async () => {
    const png = await sharp({
      create: { width: 200, height: 200, channels: 4, background: { r: 1, g: 2, b: 3, alpha: 1 } },
    })
      .png()
      .toBuffer();
    const prepared = await prepareUpload(png);
    expect(prepared.format).toBe('jpeg');
  });

  it('bakes in orientation before dropping the tag', async () => {
    // Otherwise portrait shots come out sideways once EXIF is gone.
    const rotated = await sharp({
      create: { width: 900, height: 600, channels: 3, background: { r: 5, g: 5, b: 5 } },
    })
      // Orientation has to go through withMetadata; setting it via withExif is
      // silently ignored by sharp.
      .withMetadata({ orientation: 6 })
      .jpeg()
      .toBuffer();
    const prepared = await prepareUpload(rotated);
    expect(prepared.width).toBeLessThan(prepared.height);
  });
});

describe('analysisRaster', () => {
  it('produces an energy map at the analysis resolution', async () => {
    const photo = await solidImage(1200, 1500, { r: 60, g: 60, b: 70 });
    const map = await analysisRaster(photo);
    expect(map.width).toBe(ANALYSIS_WIDTH);
    expect(map.height).toBe(ANALYSIS_HEIGHT);
    expect(map.data.length).toBe(ANALYSIS_WIDTH * ANALYSIS_HEIGHT);
  });

  it('is fast enough to run on every upload', async () => {
    const photo = await solidImage(1600, 2000, { r: 60, g: 60, b: 70 });
    const started = Date.now();
    await analysisRaster(photo);
    expect(Date.now() - started).toBeLessThan(500);
  });
});

describe('makeCutout', () => {
  it('trims the white field off a catalogue image', async () => {
    // This is what produces the floating-product look, and why we fetch the
    // retailer's image instead of segmenting the user's blurry selfie.
    const catalogue = await sharp({
      create: { width: 800, height: 800, channels: 3, background: { r: 255, g: 255, b: 255 } },
    })
      .composite([
        {
          input: Buffer.from(
            '<svg width="800" height="800"><rect x="300" y="300" width="200" height="200" fill="#123456"/></svg>',
          ),
        },
      ])
      .png()
      .toBuffer();

    const cutout = await makeCutout(catalogue);
    const meta = await sharp(cutout).metadata();
    expect(meta.width!).toBeLessThan(800);
    expect(meta.height!).toBeLessThan(800);
    expect(meta.format).toBe('png');
  });

  it('does not throw on a completely uniform image', async () => {
    // trim() cannot find an edge here; the fallback must keep the image.
    const blank = await sharp({
      create: { width: 300, height: 300, channels: 3, background: { r: 255, g: 255, b: 255 } },
    })
      .png()
      .toBuffer();
    const cutout = await makeCutout(blank);
    expect((await sharp(cutout).metadata()).format).toBe('png');
  });

  it('respects the requested width', async () => {
    const catalogue = await sharp({
      create: { width: 1200, height: 1200, channels: 3, background: { r: 255, g: 255, b: 255 } },
    })
      .composite([
        {
          input: Buffer.from(
            '<svg width="1200" height="1200"><circle cx="600" cy="600" r="500" fill="#333"/></svg>',
          ),
        },
      ])
      .png()
      .toBuffer();
    const cutout = await makeCutout(catalogue, { width: 256 });
    expect((await sharp(cutout).metadata()).width!).toBeLessThanOrEqual(256);
  });
});

describe('colour helpers', () => {
  it('reports the dominant colour', async () => {
    const red = await solidImage(200, 200, { r: 220, g: 20, b: 20 });
    const dominant = await dominantColour(red);
    expect(dominant.r).toBeGreaterThan(dominant.g);
    expect(dominant.r).toBeGreaterThan(dominant.b);
  });

  it('computes luminance so labels can pick a readable treatment', () => {
    expect(luminance({ r: 255, g: 255, b: 255 })).toBeCloseTo(1, 2);
    expect(luminance({ r: 0, g: 0, b: 0 })).toBeCloseTo(0, 2);
    expect(luminance({ r: 11, g: 10, b: 15 })).toBeLessThan(0.1);
  });
});

describe('tinyPlaceholder', () => {
  it('produces a small inline data URI', async () => {
    const photo = await solidImage(1200, 1500, { r: 90, g: 80, b: 110 });
    const placeholder = await tinyPlaceholder(photo);
    expect(placeholder.startsWith('data:image/webp;base64,')).toBe(true);
    // Must be small enough to inline in a feed payload without bloating it.
    expect(placeholder.length).toBeLessThan(2000);
  });
});
