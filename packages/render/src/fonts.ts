import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { SatoriOptions } from 'satori';

/**
 * Fonts for the server-side renderer.
 *
 * satori cannot read system fonts — every face has to be handed to it as a
 * buffer. They are vendored into the repo rather than fetched at runtime so a
 * card render never depends on the network, and so the output is byte-stable
 * for the golden-image tests.
 *
 * All three families are OFL licensed:
 *   Instrument Serif — display, the archetype name
 *   Geist Sans       — UI and the wide-tracked item labels
 *   Geist Mono       — score, prices, counters
 */

const FONT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'fonts');

export type FontSet = SatoriOptions['fonts'];

let cached: FontSet | null = null;

export async function loadFonts(): Promise<FontSet> {
  if (cached) return cached;

  const [serif, regular, medium, semibold, bold, mono] = await Promise.all([
    readFile(join(FONT_DIR, 'InstrumentSerif-Regular.ttf')),
    readFile(join(FONT_DIR, 'Geist-Regular.ttf')),
    readFile(join(FONT_DIR, 'Geist-Medium.ttf')),
    readFile(join(FONT_DIR, 'Geist-SemiBold.ttf')),
    readFile(join(FONT_DIR, 'Geist-Bold.ttf')),
    readFile(join(FONT_DIR, 'GeistMono-Medium.ttf')),
  ]);

  cached = [
    { name: 'Instrument Serif', data: serif, weight: 400, style: 'normal' },
    { name: 'Geist Sans', data: regular, weight: 400, style: 'normal' },
    { name: 'Geist Sans', data: medium, weight: 500, style: 'normal' },
    { name: 'Geist Sans', data: semibold, weight: 600, style: 'normal' },
    { name: 'Geist Sans', data: bold, weight: 700, style: 'normal' },
    { name: 'Geist Mono', data: mono, weight: 600, style: 'normal' },
  ];

  return cached;
}
