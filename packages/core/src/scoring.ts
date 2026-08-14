import { type Archetype, type ScoreDimension } from './archetypes.js';

/**
 * The Viola Score.
 *
 * Design constraints, in priority order:
 *
 * 1. **It must never feel like a verdict.** The ICP research is unambiguous
 *    that comparison is the harm vector in this category. So the scale is
 *    compressed into a generous band and every dimension is named as a
 *    strength ("Colour Story", "Statement") rather than a deficiency.
 * 2. **It must be deterministic.** Same input, same score, forever. If a user
 *    re-uploads the same fit and gets a different number, the whole feature
 *    reads as arbitrary.
 * 3. **It must be shareable.** Which is why the band name and the archetype do
 *    the talking, and the integer is supporting cast.
 */

export const SCORE_DIMENSIONS = [
  'fit',
  'colorStory',
  'texture',
  'statement',
  'cohesion',
] as const satisfies readonly ScoreDimension[];

export const DIMENSION_LABELS: Record<ScoreDimension, string> = {
  fit: 'Fit',
  colorStory: 'Colour Story',
  texture: 'Texture',
  statement: 'Statement',
  cohesion: 'Cohesion',
};

export interface ScoreBreakdown {
  fit: number;
  colorStory: number;
  texture: number;
  statement: number;
  cohesion: number;
}

export interface ViolaScore {
  overall: number;
  breakdown: ScoreBreakdown;
  band: ScoreBand;
}

/**
 * The floor. A published look never scores below this.
 *
 * This is not grade inflation for its own sake — it is a product decision. The
 * app's job is to make someone feel good about what they already put on and
 * then show them where to buy it. There is no version of "you scored 31" that
 * serves either goal.
 */
export const SCORE_FLOOR = 62;
export const SCORE_CEILING = 99;

export interface ScoreBand {
  readonly id: string;
  readonly name: string;
  readonly min: number;
}

/** Every band name is a compliment. That is the point. */
export const SCORE_BANDS: readonly ScoreBand[] = [
  { id: 'iconic', name: 'Iconic', min: 95 },
  { id: 'immaculate', name: 'Immaculate', min: 90 },
  { id: 'elite', name: 'Elite', min: 85 },
  { id: 'sharp', name: 'Sharp', min: 80 },
  { id: 'solid', name: 'Solid', min: 75 },
  { id: 'clean', name: 'Clean', min: 70 },
  { id: 'emerging', name: 'Emerging', min: 0 },
] as const;

export function bandFor(overall: number): ScoreBand {
  // SCORE_BANDS is ordered high to low and terminates at min: 0.
  return SCORE_BANDS.find((b) => overall >= b.min) ?? SCORE_BANDS[SCORE_BANDS.length - 1]!;
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/** Maps a raw 0–100 signal into the generous published band. */
export function compress(raw: number): number {
  const t = clamp(raw, 0, 100) / 100;
  return Math.round(SCORE_FLOOR + t * (SCORE_CEILING - SCORE_FLOOR));
}

/** Weights for the overall. Fit and cohesion carry the most because they are
 *  what people actually read as "put together". */
const WEIGHTS: Record<ScoreDimension, number> = {
  fit: 0.26,
  cohesion: 0.24,
  colorStory: 0.2,
  texture: 0.15,
  statement: 0.15,
};

/** Small bonus on the dimensions an archetype naturally leans on, so a
 *  committed vibe is rewarded rather than averaged into mush. */
const ARCHETYPE_BONUS = 4;

export interface ComputeScoreInput {
  /** Raw 0–100 signals from the vision stage. */
  raw: ScoreBreakdown;
  archetype?: Archetype;
  /** A look with more identified pieces has more to judge; a single item
   *  shouldn't be able to score Iconic on cohesion alone. */
  itemCount: number;
}

export function computeScore({ raw, archetype, itemCount }: ComputeScoreInput): ViolaScore {
  const breakdown = {} as ScoreBreakdown;

  for (const dim of SCORE_DIMENSIONS) {
    let value = raw[dim];
    if (archetype?.favours.includes(dim)) value += ARCHETYPE_BONUS;
    breakdown[dim] = compress(value);
  }

  let weighted = 0;
  for (const dim of SCORE_DIMENSIONS) {
    weighted += breakdown[dim] * WEIGHTS[dim];
  }

  // Sparse looks get pulled gently toward the middle of the band rather than
  // being allowed to top out on thin evidence.
  const confidence = clamp(itemCount / 3, 0.55, 1);
  const midpoint = (SCORE_FLOOR + SCORE_CEILING) / 2;
  const adjusted = midpoint + (weighted - midpoint) * confidence;

  const overall = clamp(Math.round(adjusted), SCORE_FLOOR, SCORE_CEILING);

  return { overall, breakdown, band: bandFor(overall) };
}

/**
 * The share-card headline. Archetype first, number second — the ordering is
 * the whole anti-comparison thesis in one string.
 */
export function scoreHeadline(archetypeName: string, overall: number): string {
  return `${archetypeName} · ${overall}`;
}

/** Names the standout dimension, for the "why" line under the score. */
export function strongestDimension(breakdown: ScoreBreakdown): ScoreDimension {
  let best: ScoreDimension = 'fit';
  for (const dim of SCORE_DIMENSIONS) {
    if (breakdown[dim] > breakdown[best]) best = dim;
  }
  return best;
}
