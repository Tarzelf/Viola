import { createHash } from 'node:crypto';

/**
 * Query normalisation — the cheapest performance work in the whole system.
 *
 * Product search costs roughly half a cent a call, and popular items recur
 * constantly: when a sneaker goes viral, thousands of looks contain it. Mapping
 * "HOKA Skyward X — Blue!" and "hoka skyward x blue" onto the same cache key
 * means that shoe is resolved once for everyone rather than once per look.
 *
 * The rules are deliberately conservative. Over-aggressive normalisation would
 * collapse genuinely different products together, and showing someone the wrong
 * shoe is far more damaging than paying for one extra search.
 */

/** Words that add nothing to a shopping query. */
const STOPWORDS = new Set([
  'a',
  'an',
  'the',
  'with',
  'and',
  'for',
  'in',
  'of',
  'style',
  'styled',
  'look',
  'outfit',
  'wearing',
  'worn',
  'colour',
  'color',
  'coloured',
  'colored',
]);

export function normaliseQuery(raw: string): string {
  return (
    raw
      .toLowerCase()
      .normalize('NFKD')
      // Strip diacritics so "Levi's" and "Levis" agree.
      .replace(/[\u0300-\u036f]/g, '')
      // Curly and straight apostrophes are dropped entirely rather than turned
      // into spaces, so "levi's" becomes "levis" not "levi s".
      .replace(/['\u2018\u2019\u02bc]/g, '')
      .replace(/[^a-z0-9]+/g, ' ')
      .split(' ')
      .filter((token) => token.length > 0 && !STOPWORDS.has(token))
      // Sorting would merge "blue shoe" with "shoe blue", but it would also
      // merge genuinely distinct queries, so word order is preserved.
      .join(' ')
      .trim()
  );
}

/** Stable cache key for the global product table. */
export function queryHash(raw: string): string {
  return createHash('sha256').update(normaliseQuery(raw)).digest('hex').slice(0, 40);
}

/**
 * Builds the search query for an item. A visible brand is worth a lot to search
 * precision, so it leads — but only when the vision stage actually saw a logo.
 */
export function buildSearchQuery(input: { brand?: string | null; searchQuery: string }): string {
  const base = input.searchQuery.trim();
  if (!input.brand) return base;

  const brand = input.brand.trim();
  const normalisedBase = normaliseQuery(base);
  const normalisedBrand = normaliseQuery(brand);

  // Don't repeat the brand if the model already included it.
  if (normalisedBase.startsWith(normalisedBrand)) return base;
  if (normalisedBase.includes(normalisedBrand)) return base;

  return `${brand} ${base}`;
}

/** Token overlap in 0–1, used when ranking search results against the query. */
export function tokenOverlap(a: string, b: string): number {
  const ta = new Set(normaliseQuery(a).split(' ').filter(Boolean));
  const tb = new Set(normaliseQuery(b).split(' ').filter(Boolean));
  if (ta.size === 0 || tb.size === 0) return 0;

  let hits = 0;
  for (const token of ta) if (tb.has(token)) hits++;
  return hits / ta.size;
}
