import type { ProductCandidate } from '@viola/core';
import type { ProductSearchProvider } from './providers/types';
import type { VisualSearchProvider } from './providers/product/visual';
import { buildSearchQuery } from './normalise';
import { isResaleSource, rankCandidates, resolveBest, MIN_ACCEPTABLE_SCORE } from './ranking';

/**
 * Deciding how to find a garment.
 *
 * There are two ways to look something up and they fail in opposite
 * directions, so choosing between them per item matters more than either
 * search on its own:
 *
 *   TEXT   precise when a logo was visible ("HOKA Skyward X"), useless when it
 *          was not — "white crop top" matches ten thousand white crop tops and
 *          none of them are hers.
 *
 *   VISUAL works without a name, and is the only way to get look-alikes at
 *          all. Less precise on exact identity, and costs an image upload.
 *
 * So: text leads when there is a brand, visual leads when there is not, and
 * visual always runs for the dupes rail because "where else can I get this,
 * cheaper" is a question text search cannot answer.
 */

export type MatchStrategy = 'text-first' | 'visual-first' | 'text-only' | 'visual-only';

export interface MatchInput {
  /** Only set when a logo or wordmark was genuinely visible. */
  brand: string | null;
  /** Model-written shopping query, e.g. "striped wide leg trousers". */
  searchQuery: string;
  subtype: string;
  /**
   * A clean cutout of THIS garment. Feeding the whole photo to a reverse image
   * search returns "woman in front of a green wall"; feeding an isolated
   * garment returns garments. The segmentation output is the query.
   */
  cutout?: Buffer | null;
  /** How confident the vision stage was, 0-1. */
  confidence: number;
}

export interface MatchResult {
  strategy: MatchStrategy;
  /** Our single best guess at the actual item, or null if nothing was good enough. */
  best: ProductCandidate | null;
  /** Other places to buy the same thing. */
  alternates: ProductCandidate[];
  /** Cheaper equivalents and visually similar items. */
  lookAlikes: ProductCandidate[];
  /** Resale listings, kept separate — a large share of this audience buys used. */
  secondhand: ProductCandidate[];
  /** How many billable lookups this cost. */
  searches: number;
  notes: string[];
}

export function chooseStrategy(input: MatchInput): MatchStrategy {
  const hasCutout = Boolean(input.cutout && input.cutout.byteLength > 0);

  if (input.brand && hasCutout) return 'text-first';
  if (input.brand) return 'text-only';
  if (hasCutout) return 'visual-first';

  // No brand and no usable cutout. Text search will be vague, but a vague
  // result with a price beats showing nothing.
  return 'text-only';
}

export interface MatchDeps {
  text: ProductSearchProvider;
  visual: VisualSearchProvider;
}

export async function findGarment(
  input: MatchInput,
  deps: MatchDeps,
  options: { maxLookAlikes?: number } = {},
): Promise<MatchResult> {
  const strategy = chooseStrategy(input);
  const maxLookAlikes = options.maxLookAlikes ?? 4;
  const notes: string[] = [];
  let searches = 0;

  const query = buildSearchQuery({ brand: input.brand, searchQuery: input.searchQuery });

  let best: ProductCandidate | null = null;
  let alternates: ProductCandidate[] = [];
  let lookAlikes: ProductCandidate[] = [];
  let secondhand: ProductCandidate[] = [];

  // --- text ---------------------------------------------------------------
  if (strategy === 'text-first' || strategy === 'text-only') {
    try {
      searches++;
      const candidates = await deps.text.search({ query, brand: input.brand, limit: 10 });
      const resolved = resolveBest({ query, brand: input.brand, candidates });

      best = resolved.best?.candidate ?? null;
      alternates = resolved.alternates.map((a) => a.candidate);
      secondhand = resolved.secondhand.map((a) => a.candidate);

      if (!best) notes.push('no text result cleared the confidence bar');
    } catch (error) {
      notes.push(`text search failed: ${(error as Error).message}`);
    }
  }

  // --- visual --------------------------------------------------------------
  const wantsVisual =
    strategy === 'visual-first' ||
    strategy === 'visual-only' ||
    // Always run visual on a text-first item too: the dupes rail is the point,
    // and it is the only thing that can answer "cheaper somewhere else".
    (strategy === 'text-first' && Boolean(input.cutout));

  if (wantsVisual && input.cutout) {
    try {
      searches++;
      const visual = await deps.visual.search({
        image: input.cutout,
        hint: input.searchQuery,
        limit: 10,
      });

      // A visual exact match only overrides text when text found nothing.
      // Text with a confirmed brand is the stronger signal.
      if (!best && visual.exact.length > 0) {
        const ranked = rankCandidates({ query, brand: input.brand, candidates: visual.exact });
        const top = ranked[0];
        if (top && top.score >= MIN_ACCEPTABLE_SCORE) {
          best = top.candidate;
        } else {
          notes.push('visual exact match was too weak to show as the pick');
        }
      }

      const similar = visual.similar.filter((c) => c.merchantUrl !== best?.merchantUrl);
      lookAlikes = similar.filter((c) => !isResaleSource(c.source)).slice(0, maxLookAlikes);
      secondhand = [...secondhand, ...similar.filter((c) => isResaleSource(c.source))].slice(
        0,
        maxLookAlikes,
      );

      if (!best && visual.similar.length > 0) {
        notes.push('no exact match; showing look-alikes only');
      }
    } catch (error) {
      notes.push(`visual search failed: ${(error as Error).message}`);
    }
  }

  // Cheapest first in the dupes rail — the whole reason someone opens it.
  lookAlikes.sort((a, b) => (a.priceCents ?? Infinity) - (b.priceCents ?? Infinity));
  secondhand.sort((a, b) => (a.priceCents ?? Infinity) - (b.priceCents ?? Infinity));

  return { strategy, best, alternates, lookAlikes, secondhand, searches, notes };
}

/** How much cheaper the best look-alike is. Drives the "save 62%" badge. */
export function savingsPercent(
  original: ProductCandidate | null,
  alternative: ProductCandidate | null,
): number | null {
  if (!original?.priceCents || !alternative?.priceCents) return null;
  if (alternative.priceCents >= original.priceCents) return null;
  return Math.round((1 - alternative.priceCents / original.priceCents) * 100);
}
