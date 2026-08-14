import sharp from 'sharp';
import { computeEnergyMap, type EnergyMap } from './layout.js';

/**
 * Local image processing.
 *
 * Everything in this file runs on the machine — no network, no model. Together
 * with the layout engine it covers the entire visual side of a look card. The
 * only things the pipeline cannot do locally are naming the brand and finding
 * where to buy it.
 */

/** Longest edge of the stored upload. Beyond this adds cost, not quality. */
export const MAX_UPLOAD_EDGE = 1600;
/** Analysis raster. Tiny on purpose — enough to tell a blank wall from clutter. */
export const ANALYSIS_WIDTH = 96;
export const ANALYSIS_HEIGHT = 171;

export interface PreparedUpload {
  data: Buffer;
  width: number;
  height: number;
  format: string;
}

/**
 * Prepares a user upload for storage.
 *
 * The metadata stripping is not an optimisation, it is a privacy requirement:
 * phone photos carry GPS coordinates, and this app's whole content type is
 * "here is where I am, in a mirror". `sharp` drops all EXIF unless explicitly
 * asked to keep it, and the rotate() call bakes in orientation first so
 * portrait shots do not end up sideways once the tag is gone.
 */
export async function prepareUpload(input: Buffer): Promise<PreparedUpload> {
  const pipeline = sharp(input, { failOn: 'none' })
    .rotate()
    .resize({
      width: MAX_UPLOAD_EDGE,
      height: MAX_UPLOAD_EDGE,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .jpeg({ quality: 86, mozjpeg: true });

  const { data, info } = await pipeline.toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height, format: info.format };
}

/**
 * Detects a GPS block in an image's EXIF.
 *
 * Location is not stored as the ASCII string "GPS" — it hangs off tag 0x8825,
 * the GPS IFD pointer, whose byte order depends on the TIFF header ("II" for
 * little-endian, "MM" for big). Searching for the literal text finds nothing,
 * which would make this check quietly always pass.
 */
export async function hasLocationMetadata(image: Buffer): Promise<boolean> {
  const meta = await sharp(image).metadata();
  if (!meta.exif) return false;

  const exif = meta.exif;
  const tiffStart = exif.indexOf(Buffer.from('Exif\0\0', 'latin1')) === 0 ? 6 : 0;
  const littleEndian = exif[tiffStart] === 0x49; // 'I'

  const gpsPointerTag = littleEndian
    ? Buffer.from([0x25, 0x88]) // 0x8825 little-endian
    : Buffer.from([0x88, 0x25]);

  return exif.includes(gpsPointerTag);
}

/** Greyscale raster for the layout energy map. */
export async function analysisRaster(image: Buffer): Promise<EnergyMap> {
  const { data } = await sharp(image)
    .resize(ANALYSIS_WIDTH, ANALYSIS_HEIGHT, { fit: 'fill' })
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  return computeEnergyMap(new Uint8Array(data), ANALYSIS_WIDTH, ANALYSIS_HEIGHT);
}

export interface CutoutOptions {
  /** Target width in pixels for the stored cutout. */
  width?: number;
  /** Trim tolerance. Catalogue whites are rarely pure #fff. */
  threshold?: number;
  /** How close to white a pixel must be to count as background, 0-255. */
  whiteCutoff?: number;
}

/**
 * Removes the white background from a catalogue image.
 *
 * Trimming alone is not enough. `sharp.trim()` crops the surrounding whitespace
 * but leaves an opaque white rectangle, so the product sits in a visible box
 * when composited over a photo instead of floating. That box is the difference
 * between the reference layout and something that looks like a debug overlay.
 *
 * The removal is a flood fill inward from the border rather than a global
 * "delete every white pixel" threshold. That distinction matters a great deal
 * here: a white sneaker on a white background is extremely common in fashion
 * catalogues, and a global threshold would erase the product itself. Only white
 * that is reachable from the edge is background.
 */
export async function removeWhiteBackground(input: Buffer, whiteCutoff = 238): Promise<Buffer> {
  const { data, info } = await sharp(input)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height, channels } = info;
  const pixels = new Uint8ClampedArray(data);
  const visited = new Uint8Array(width * height);

  const isNearWhite = (idx: number) => {
    const o = idx * channels;
    return (
      pixels[o]! >= whiteCutoff && pixels[o + 1]! >= whiteCutoff && pixels[o + 2]! >= whiteCutoff
    );
  };

  // Seed from every border pixel, then flood inward.
  const queue: number[] = [];
  const push = (x: number, y: number) => {
    const idx = y * width + x;
    if (visited[idx] || !isNearWhite(idx)) return;
    visited[idx] = 1;
    queue.push(idx);
  };

  for (let x = 0; x < width; x++) {
    push(x, 0);
    push(x, height - 1);
  }
  for (let y = 0; y < height; y++) {
    push(0, y);
    push(width - 1, y);
  }

  while (queue.length > 0) {
    const idx = queue.pop()!;
    const x = idx % width;
    const y = (idx - x) / width;
    pixels[idx * channels + 3] = 0;

    if (x > 0) push(x - 1, y);
    if (x < width - 1) push(x + 1, y);
    if (y > 0) push(x, y - 1);
    if (y < height - 1) push(x, y + 1);
  }

  return sharp(Buffer.from(pixels.buffer), { raw: { width, height, channels: 4 } })
    .png({ compressionLevel: 9 })
    .toBuffer();
}

/**
 * Turns a retailer catalogue image into a card-ready cutout.
 *
 * Catalogue photography is almost always a product centred on a white or very
 * light background, usually with generous padding. Trimming that away and
 * re-encoding with an alpha channel is what produces the floating-product look
 * of the reference image — and it is far more reliable than trying to segment
 * the garment out of a blurry mirror selfie, which is why we fetch the
 * retailer's image in the first place.
 */
export async function makeCutout(input: Buffer, options: CutoutOptions = {}): Promise<Buffer> {
  const width = options.width ?? 512;
  const threshold = options.threshold ?? 12;

  let trimmed: Buffer;
  try {
    trimmed = await sharp(input, { failOn: 'none' }).trim({ threshold }).png().toBuffer();
  } catch {
    // trim() throws when an image is entirely uniform. Keep the image rather
    // than losing the product altogether.
    trimmed = await sharp(input, { failOn: 'none' }).png().toBuffer();
  }

  const transparent = await removeWhiteBackground(trimmed, options.whiteCutoff);

  return sharp(transparent)
    .resize({ width, height: width, fit: 'inside', withoutEnlargement: true })
    .png({ compressionLevel: 9 })
    .toBuffer();
}

/** Average colour, used to pick a contrast-safe label treatment. */
export async function dominantColour(image: Buffer): Promise<{ r: number; g: number; b: number }> {
  const { dominant } = await sharp(image).stats();
  return dominant;
}

/**
 * Relative luminance, for deciding whether a label sits on light or dark
 * backing. WCAG formula.
 */
export function luminance({ r, g, b }: { r: number; g: number; b: number }): number {
  const channel = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** A tiny inline placeholder so the feed never flashes an empty box. */
export async function tinyPlaceholder(image: Buffer): Promise<string> {
  const buf = await sharp(image)
    .resize(16, 20, { fit: 'cover' })
    .blur(1)
    .webp({ quality: 40 })
    .toBuffer();
  return `data:image/webp;base64,${buf.toString('base64')}`;
}

/** Solid-colour image generator, used by tests and the demo script. */
export async function solidImage(
  width: number,
  height: number,
  colour: { r: number; g: number; b: number },
): Promise<Buffer> {
  return sharp({ create: { width, height, channels: 3, background: colour } })
    .jpeg()
    .toBuffer();
}
