import type { ProductCandidate } from '@viola/core';
import { normaliseQuery, tokenOverlap } from './normalise';

/**
 * Ranking search results.
 *
 * This is the trust surface of the whole product. If the shoe on the card is
 * not the shoe in the photo, nothing else matters — the user stops believing
 * any of it. So the scoring is conservative and heavily weighted toward the
 * brand actually matching, and we surface alternates rather than pretending the
 * top hit is certainly right.
 */

export interface RankingInput {
  query: string;
  /** Only set when a logo was genuinely visible. */
  brand?: string | null;
  candidates: readonly ProductCandidate[];
}

export interface RankedCandidate {
  candidate: ProductCandidate;
  score: number;
  reasons: string[];
}

/** Retailers whose listings are consistently well-formed and in stock. */
const TRUSTED_SOURCES = new Set([
  'nordstrom',
  'ssense',
  'net-a-porter',
  'revolve',
  'aritzia',
  'zara',
  'uniqlo',
  'adidas',
  'nike',
  'hoka',
  'lululemon',
  'urban outfitters',
  'asos',
  'farfetch',
  'mytheresa',
  'shopbop',
  'anthropologie',
  'free people',
  'abercrombie',
  'madewell',
  'levis',
  "levi's",
  'under armour',
  'amazon',
  'target',
  'macys',
  "macy's",
]);

/** Resale platforms. Surfaced deliberately, not penalised. */
const RESALE_SOURCES = new Set([
  'depop',
  'poshmark',
  'thredup',
  'vinted',
  'the realreal',
  'ebay',
  'grailed',
  'vestiaire collective',
]);

export function isResaleSource(source: string): boolean {
  return RESALE_SOURCES.has(source.toLowerCase().trim());
}

export function rankCandidates({ query, brand, candidates }: RankingInput): RankedCandidate[] {
  const wantedBrand = brand ? normaliseQuery(brand) : null;

  return candidates
    .map((candidate) => {
      let score = 0;
      const reasons: string[] = [];

      // --- brand agreement, the strongest signal available ------------------
      if (wantedBrand) {
        const candidateBrand = normaliseQuery(candidate.brand ?? '');
        const candidateTitle = normaliseQuery(candidate.title);
        if (candidateBrand === wantedBrand) {
          score += 50;
          reasons.push('brand matches exactly');
        } else if (candidateTitle.startsWith(wantedBrand)) {
          score += 38;
          reasons.push('title leads with the brand');
        } else if (candidateTitle.includes(wantedBrand)) {
          score += 26;
          reasons.push('title mentions the brand');
        } else {
          // We saw a logo and this listing is for something else. Heavily
          // penalised rather than excluded, so a thin result set still returns
          // something rather than nothing.
          score -= 30;
          reasons.push('brand does not match');
        }
      }

      // --- how well the title covers the query ------------------------------
      const overlap = tokenOverlap(query, candidate.title);
      score += overlap * 34;
      if (overlap > 0.6) reasons.push('title closely matches the query');

      // --- a clean catalogue image is what makes the card look premium ------
      if (candidate.imageUrl) {
        score += 12;
      } else {
        // Without an image there is no cutout, and the card falls back to a
        // text-only label. Usable, but much weaker.
        score -= 18;
        reasons.push('no product image');
      }

      // --- price sanity ------------------------------------------------------
      if (candidate.priceCents === null) {
        score -= 6;
      } else if (candidate.priceCents < 200) {
        // Sub-$2 apparel listings are almost always accessories, counterfeits
        // or bad data.
        score -= 20;
        reasons.push('implausibly cheap');
      } else {
        score += 6;
      }

      // --- retailer quality --------------------------------------------------
      const source = candidate.source.toLowerCase().trim();
      if (TRUSTED_SOURCES.has(source)) {
        score += 10;
        reasons.push('known retailer');
      }
      if (isResaleSource(source)) {
        // Not a penalty. Resale is a first-class option for this audience —
        // it just belongs in the alternates rail rather than as the headline.
        score -= 4;
        reasons.push('resale listing');
      }

      // --- social proof ------------------------------------------------------
      if (candidate.rating !== null && candidate.reviewCount !== null) {
        if (candidate.reviewCount >= 25 && candidate.rating >= 4) {
          score += 6;
        }
      }

      return { candidate, score, reasons };
    })
    .sort((a, b) => b.score - a.score || a.candidate.title.localeCompare(b.candidate.title));
}

export interface ResolutionResult {
  best: RankedCandidate | null;
  alternates: RankedCandidate[];
  /** Cheaper or secondhand equivalents, surfaced separately. */
  secondhand: RankedCandidate[];
}

/**
 * Confidence gate. Below this we would rather show the item with no buy link
 * than send someone to the wrong product.
 */
export const MIN_ACCEPTABLE_SCORE = 10;

export function resolveBest(input: RankingInput, maxAlternates = 3): ResolutionResult {
  const ranked = rankCandidates(input);
  const acceptable = ranked.filter((r) => r.score >= MIN_ACCEPTABLE_SCORE);

  const best = acceptable[0] ?? null;
  const rest = acceptable.slice(1);

  return {
    best,
    alternates: rest.filter((r) => !isResaleSource(r.candidate.source)).slice(0, maxAlternates),
    secondhand: rest.filter((r) => isResaleSource(r.candidate.source)).slice(0, maxAlternates),
  };
}
