import { pipeline } from '@huggingface/transformers';
import sharp from 'sharp';

/**
 * Sticker rendering, second attempt.
 *
 * The first version looked cheap, and for four specific reasons:
 *
 * 1. The mask is hard binary 0/255, so every edge was jagged staircase.
 * 2. No erosion, so a rim of background colour came along for the ride — the
 *    white crop top had a green halo from the wall behind it.
 * 3. The keyline was sized from SOURCE pixels, so a 721px garment got a thick
 *    outline and a 97px one got a hairline. On the card, where both end up the
 *    same size, they looked like they came from different apps.
 * 4. Where a garment ran off the frame, the mask ended in a straight line and
 *    the keyline traced it, producing an obviously artificial hard edge.
 *
 * All four are fixed below. The keyline is now computed at the FINAL rendered
 * size, which is the only way to get consistency.
 */

export const GARMENT_LABELS = new Set([
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

/** Largest connected region. Two feet in one mask otherwise box the frame. */
function largestBlob(mask, W, H) {
  const seen = new Uint8Array(W * H);
  const out = new Uint8Array(W * H);
  let best = 0;

  for (let start = 0; start < W * H; start++) {
    if (seen[start] || mask[start] <= 128) continue;
    const stack = [start];
    const blob = [];
    seen[start] = 1;

    while (stack.length > 0) {
      const idx = stack.pop();
      blob.push(idx);
      const x = idx % W;
      const y = (idx - x) / W;
      if (x > 0) { const n = idx - 1; if (!seen[n] && mask[n] > 128) { seen[n] = 1; stack.push(n); } }
      if (x < W - 1) { const n = idx + 1; if (!seen[n] && mask[n] > 128) { seen[n] = 1; stack.push(n); } }
      if (y > 0) { const n = idx - W; if (!seen[n] && mask[n] > 128) { seen[n] = 1; stack.push(n); } }
      if (y < H - 1) { const n = idx + W; if (!seen[n] && mask[n] > 128) { seen[n] = 1; stack.push(n); } }
    }
    if (blob.length > best) {
      best = blob.length;
      out.fill(0);
      for (const idx of blob) out[idx] = 255;
    }
  }
  return best > 0 ? out : null;
}

function bbox(mask, W, H) {
  let minX = W, minY = H, maxX = 0, maxY = 0;
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
  return maxX <= minX || maxY <= minY ? null : { minX, minY, maxX, maxY };
}

/**
 * Does this garment run off the edge of the photo?
 *
 * If it does, the mask ends in a dead-straight line and a keyline traced along
 * it screams "cut out". Those sides get no outline.
 */
function openSides(box, W, H, tolerance = 6) {
  return {
    left: box.minX <= tolerance,
    right: box.maxX >= W - 1 - tolerance,
    top: box.minY <= tolerance,
    bottom: box.maxY >= H - 1 - tolerance,
  };
}

export async function extractStickers(src, options = {}) {
  const targetSize = options.targetSize ?? 420;
  const keyline = options.keyline ?? 10;

  const meta = await sharp(src).metadata();
  const W = meta.width;
  const H = meta.height;

  const segmenter =
    options.segmenter ??
    (await pipeline('image-segmentation', 'mattmdjaga/segformer_b2_clothes', { dtype: 'fp32' }));

  const segments = await segmenter(src);
  const rgb = await sharp(src).removeAlpha().raw().toBuffer();
  const stickers = [];

  for (const segment of segments) {
    if (!GARMENT_LABELS.has(segment.label)) continue;

    const raw = Buffer.from(segment.mask.data);
    const mask = largestBlob(raw, W, H) ?? raw;
    const box = bbox(mask, W, H);
    if (!box) continue;

    const width = box.maxX - box.minX;
    const height = box.maxY - box.minY;
    if (width < 24 || height < 24 || width * height < 1200) continue;

    const open = openSides(box, W, H);

    // --- 1. Soften the mask ------------------------------------------------
    // A blur followed by a gentle curve turns the binary staircase into a
    // 1-2px antialiased edge, and pulls the boundary INWARD so the rim of
    // background colour is left behind rather than cut out with the garment.
    const softened = await sharp(Buffer.from(mask), { raw: { width: W, height: H, channels: 1 } })
      .blur(1.6)
      // The threshold sits above the midpoint, which is what erodes the edge.
      .linear(2.2, -180)
      // Two traps here, both of which silently produce a fully transparent
      // sticker rather than an error:
      //   - without .raw() sharp encodes a PNG, so the bytes read below are
      //     file headers rather than mask values
      //   - blur promotes a 1-channel image to 3, so the buffer comes back
      //     three times the expected length and every index is wrong
      .toColourspace('b-w')
      .raw()
      .toBuffer();

    // --- 2. Cut, with the softened mask as alpha ---------------------------
    const pixels = W * H;
    const rgba = Buffer.alloc(pixels * 4);
    for (let i = 0; i < pixels; i++) {
      rgba[i * 4] = rgb[i * 3];
      rgba[i * 4 + 1] = rgb[i * 3 + 1];
      rgba[i * 4 + 2] = rgb[i * 3 + 2];
      rgba[i * 4 + 3] = softened[i];
    }

    const cut = await sharp(rgba, { raw: { width: W, height: H, channels: 4 } })
      .extract({ left: box.minX, top: box.minY, width, height })
      .png()
      .toBuffer();

    // --- 3. Normalise size BEFORE the keyline ------------------------------
    // This is the fix for inconsistency: every sticker is scaled to the same
    // target first, so a fixed keyline reads identically on all of them.
    const scaled = await sharp(cut)
      .resize({ width: targetSize, height: targetSize, fit: 'inside', kernel: 'lanczos3' })
      .png()
      .toBuffer();
    const sm = await sharp(scaled).metadata();

    // --- 4. Keyline, skipped on sides that run off the frame ---------------
    const pad = keyline;
    const alpha = await sharp(scaled).extractChannel('alpha').raw().toBuffer();

    const grown = await sharp(Buffer.from(alpha), {
      raw: { width: sm.width, height: sm.height, channels: 1 },
    })
      .blur(pad * 0.9)
      .linear(4, -60)
      .toColourspace('b-w')
      .raw()
      .toBuffer();

    const outlineRgba = Buffer.alloc(sm.width * sm.height * 4);
    for (let i = 0; i < sm.width * sm.height; i++) {
      outlineRgba[i * 4] = 255;
      outlineRgba[i * 4 + 1] = 255;
      outlineRgba[i * 4 + 2] = 255;
      outlineRgba[i * 4 + 3] = grown[i];
    }
    const outline = await sharp(outlineRgba, {
      raw: { width: sm.width, height: sm.height, channels: 4 },
    })
      .png()
      .toBuffer();

    const canvasW = sm.width + pad * 2;
    const canvasH = sm.height + pad * 2;

    const sticker = await sharp({
      create: { width: canvasW, height: canvasH, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
    })
      .composite([
        { input: outline, left: pad, top: pad },
        { input: scaled, left: pad, top: pad },
      ])
      .png()
      .toBuffer();

    // A garment cut off by the frame keeps a hard edge no matter what, so the
    // caller is told rather than being surprised by it.
    stickers.push({
      label: segment.label,
      buffer: sticker,
      sourceSize: { width, height },
      clipped: open.left || open.right || open.top || open.bottom,
      anchor: { x: (box.minX + box.maxX) / 2 / W, y: (box.minY + box.maxY) / 2 / H },
      area: width * height,
    });
  }

  return stickers;
}
