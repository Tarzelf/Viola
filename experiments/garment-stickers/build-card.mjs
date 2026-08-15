import { pipeline } from '@huggingface/transformers';
import sharp from 'sharp';
import { writeFile } from 'node:fs/promises';

/**
 * Real photo -> semantic garment stickers -> assembled shareable card.
 *
 * Entirely local. No API key, no network after the model is cached.
 */

const SRC = process.argv[2] ?? 'photo-1529139574466.jpg';
const OUT = process.argv[3] ?? 'card-stickers.png';

/** Labels that are clothing. Everything else is the person. */
const GARMENT_LABELS = new Set([
  'Hat',
  'Sunglasses',
  'Upper-clothes',
  'Skirt',
  'Pants',
  'Dress',
  'Belt',
  'Left-shoe',
  'Right-shoe',
  'Bag',
  'Scarf',
]);

const PRETTY = {
  'Upper-clothes': 'UPPER LAYER',
  Sunglasses: 'SUNGLASSES',
  Skirt: 'SKIRT',
  Pants: 'TROUSERS',
  Dress: 'DRESS',
  Bag: 'BAG',
  Hat: 'HAT',
  Belt: 'BELT',
  Scarf: 'SCARF',
};

const meta = await sharp(SRC).metadata();
const W = meta.width;
const H = meta.height;

console.log(`source ${W}x${H}`);
const segmenter = await pipeline('image-segmentation', 'mattmdjaga/segformer_b2_clothes', {
  dtype: 'fp32',
});

const t0 = Date.now();
const segments = await segmenter(SRC);
console.log(`segmented in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
console.log(`labels: ${segments.map((s) => s.label).join(', ')}\n`);

const rgb = await sharp(SRC).removeAlpha().raw().toBuffer();
const pixels = W * H;

/** Applies a mask as the alpha channel. Building RGBA by hand is unambiguous —
 *  sharp's dest-in reads the source's alpha, not its luminance, which silently
 *  does nothing when the mask is a greyscale PNG. */
function applyMask(mask) {
  const rgba = Buffer.alloc(pixels * 4);
  for (let i = 0; i < pixels; i++) {
    rgba[i * 4] = rgb[i * 3];
    rgba[i * 4 + 1] = rgb[i * 3 + 1];
    rgba[i * 4 + 2] = rgb[i * 3 + 2];
    rgba[i * 4 + 3] = mask[i];
  }
  return rgba;
}

/** Where a mask sits in the frame, normalised. */
function bounds(mask) {
  let minX = W;
  let minY = H;
  let maxX = 0;
  let maxY = 0;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (mask[y * W + x] > 128) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  return maxX <= minX ? null : { minX, minY, maxX, maxY };
}

const stickers = [];

for (const segment of segments) {
  if (!GARMENT_LABELS.has(segment.label)) continue;

  const mask = Buffer.from(segment.mask.data);
  const box = bounds(mask);
  if (!box) continue;

  const width = box.maxX - box.minX;
  const height = box.maxY - box.minY;
  if (width < 60 || height < 60) {
    console.log(`${segment.label.padEnd(15)} too small (${width}x${height}), skipped`);
    continue;
  }

  const cut = await sharp(applyMask(mask), { raw: { width: W, height: H, channels: 4 } })
    .extract({ left: box.minX, top: box.minY, width, height })
    .png()
    .toBuffer();

  // The sticker keyline: dilate the alpha and fill it white.
  //
  // Compositing white with dest-in against a greyscale alpha image does NOT
  // work — dest-in reads the SOURCE'S alpha, and a greyscale image is opaque
  // everywhere, so you get a solid white rectangle. Same trap as masking the
  // photo. Build the RGBA by hand instead.
  const pad = Math.max(6, Math.round(Math.max(width, height) * 0.015));
  const dilated = await sharp(cut)
    .extractChannel('alpha')
    .blur(pad * 0.8)
    .threshold(24)
    .raw()
    .toBuffer();

  const outlineRgba = Buffer.alloc(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    outlineRgba[i * 4] = 255;
    outlineRgba[i * 4 + 1] = 255;
    outlineRgba[i * 4 + 2] = 255;
    outlineRgba[i * 4 + 3] = dilated[i];
  }
  const outline = await sharp(outlineRgba, { raw: { width, height, channels: 4 } })
    .png()
    .toBuffer();

  const sticker = await sharp({
    create: {
      width: width + pad * 2,
      height: height + pad * 2,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([
      { input: outline, left: 0, top: pad },
      { input: outline, left: pad * 2, top: pad },
      { input: outline, left: pad, top: 0 },
      { input: outline, left: pad, top: pad * 2 },
      { input: cut, left: pad, top: pad },
    ])
    .png()
    .toBuffer();

  const label = PRETTY[segment.label] ?? segment.label.toUpperCase();
  await writeFile(`sticker-${segment.label.toLowerCase()}.png`, sticker);
  stickers.push({
    label,
    buffer: sticker,
    anchor: {
      x: (box.minX + box.maxX) / 2 / W,
      y: (box.minY + box.maxY) / 2 / H,
    },
  });

  console.log(`${segment.label.padEnd(15)} ${width}x${height}  -> sticker-${segment.label.toLowerCase()}.png`);
}

// --------------------------------------------------------------------------
// Assemble the shareable card
// --------------------------------------------------------------------------

const CW = 1080;
const CH = 1920;

const photo = await sharp(SRC).resize(CW, CH, { fit: 'cover', position: 'attention' }).toBuffer();

const layers = [
  { input: photo, left: 0, top: 0 },
  {
    input: await sharp({
      create: { width: CW, height: CH, channels: 4, background: { r: 11, g: 10, b: 15, alpha: 0.34 } },
    })
      .png()
      .toBuffer(),
    left: 0,
    top: 0,
  },
];

// Stickers alternate sides, sized to the gutter, ordered top to bottom.
stickers.sort((a, b) => a.anchor.y - b.anchor.y);

const slotW = Math.round(CW * 0.3);
const svgParts = [];

for (const [index, sticker] of stickers.entries()) {
  const side = index % 2 === 0 ? 'left' : 'right';
  const resized = await sharp(sticker.buffer)
    .resize({ width: slotW, height: slotW, fit: 'inside' })
    .toBuffer();
  const rm = await sharp(resized).metadata();

  const x = side === 'left' ? Math.round(CW * 0.04) : CW - Math.round(CW * 0.04) - rm.width;
  const y = Math.round(CH * (0.16 + index * 0.2));

  layers.push({ input: resized, left: x, top: y });

  svgParts.push(`
    <text x="${x + rm.width / 2}" y="${y + rm.height + 26}"
          font-family="sans-serif" font-size="19" font-weight="700"
          letter-spacing="3" fill="#ffffff" text-anchor="middle">${sticker.label}</text>`);
}

svgParts.push(`
  <rect x="${CW / 2 - 210}" y="${CH - 250}" width="420" height="86" rx="43" fill="#7C5CFC"/>
  <text x="${CW / 2 - 40}" y="${CH - 194}" font-family="serif" font-size="38"
        fill="#ffffff" text-anchor="middle">Downtown Girl</text>
  <text x="${CW / 2 + 140}" y="${CH - 194}" font-family="monospace" font-size="32"
        font-weight="600" fill="rgba(255,255,255,0.75)" text-anchor="middle">91</text>
  <text x="${CW / 2}" y="${CH - 92}" font-family="sans-serif" font-size="23"
        fill="rgba(255,255,255,0.55)" text-anchor="middle">viola.app/@you</text>`);

layers.push({
  input: Buffer.from(`<svg width="${CW}" height="${CH}">${svgParts.join('')}</svg>`),
  left: 0,
  top: 0,
});

await sharp({ create: { width: CW, height: CH, channels: 4, background: { r: 11, g: 10, b: 15, alpha: 1 } } })
  .composite(layers)
  .png()
  .toFile(OUT);

console.log(`\n${stickers.length} stickers -> ${OUT}`);
