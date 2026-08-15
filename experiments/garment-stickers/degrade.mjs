import sharp from 'sharp';

/**
 * Simulates a phone mirror selfie from a studio shot.
 *
 * Cannot reproduce a cluttered bedroom, but it can reproduce the things that
 * actually degrade segmentation: lower resolution, sensor noise, flat indoor
 * lighting, mild motion blur and JPEG compression.
 */
const SRC = process.argv[2] ?? 'fb-2.jpg';
const meta = await sharp(SRC).metadata();

// Phone selfie in poor indoor light, downscaled and recompressed.
const base = await sharp(SRC)
  .resize(Math.round(meta.width * 0.55))
  .modulate({ brightness: 0.86, saturation: 0.78 })   // dim, flat indoor light
  .linear(0.88, 14)                                    // lifted blacks, low contrast
  .blur(0.6)                                           // slight handshake
  .jpeg({ quality: 62 })                               // aggressive phone JPEG
  .toBuffer();

// Sensor noise on top.
const { data, info } = await sharp(base).raw().toBuffer({ resolveWithObject: true });
for (let i = 0; i < data.length; i++) {
  const n = (Math.random() - 0.5) * 26;
  data[i] = Math.max(0, Math.min(255, data[i] + n));
}
await sharp(data, { raw: { width: info.width, height: info.height, channels: info.channels } })
  .jpeg({ quality: 70 })
  .toFile('degraded.jpg');

const dm = await sharp('degraded.jpg').metadata();
console.log(`degraded: ${dm.width}x${dm.height} (from ${meta.width}x${meta.height})`);
