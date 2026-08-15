import { pipeline } from '@huggingface/transformers';
import { readdirSync } from 'node:fs';

/**
 * Screens candidate photos by how many distinct GARMENT categories the model
 * finds. A full-body mirror selfie should surface a top, a bottom and shoes —
 * a headshot surfaces one. Cheaper than eyeballing a dozen images.
 */

const GARMENTS = new Set([
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

const segmenter = await pipeline('image-segmentation', 'mattmdjaga/segformer_b2_clothes', {
  dtype: 'fp32',
});

const files = readdirSync('.').filter((f) => /^fb-\d+\.jpg$/.test(f)).sort();
const results = [];

for (const file of files) {
  try {
    const output = await segmenter(file);
    const found = output.map((o) => o.label).filter((l) => GARMENTS.has(l));
    // Shoes are the strongest signal that we are looking at a full-body shot.
    const fullBody = found.some((l) => l.includes('shoe')) || found.some((l) => /Pants|Skirt|Dress/.test(l));
    results.push({ file, count: found.length, fullBody, found });
  } catch (error) {
    results.push({ file, count: -1, fullBody: false, found: [String(error).slice(0, 40)] });
  }
}

results.sort((a, b) => Number(b.fullBody) - Number(a.fullBody) || b.count - a.count);

for (const r of results) {
  const flag = r.fullBody ? 'FULL-BODY' : '         ';
  console.log(`${r.file.padEnd(10)} ${flag} ${String(r.count).padStart(2)}  ${r.found.join(', ')}`);
}
