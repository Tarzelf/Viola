import type { ProductCandidate } from '@viola/core';
import { describe, expect, it } from 'vitest';
import { buildSearchQuery, normaliseQuery, queryHash, tokenOverlap } from './normalise.js';
import { MIN_ACCEPTABLE_SCORE, isResaleSource, rankCandidates, resolveBest } from './ranking.js';

const candidate = (over: Partial<ProductCandidate> = {}): ProductCandidate => ({
  title: 'HOKA Skyward X Running Shoe',
  brand: 'HOKA',
  source: 'Nordstrom',
  priceCents: 22500,
  currency: 'USD',
  merchantUrl: 'https://example.com/p',
  imageUrl: 'https://cdn.example.com/x.png',
  rating: 4.6,
  reviewCount: 400,
  isSecondhand: false,
  ...over,
});

describe('query normalisation', () => {
  it('collapses punctuation and case onto one cache key', () => {
    // "HOKA Skyward X — Blue!" and "hoka skyward x blue" must hit the same
    // cached product, or we pay for the same lookup thousands of times.
    expect(normaliseQuery('HOKA Skyward X — Blue!')).toBe('hoka skyward x blue');
    expect(queryHash('HOKA Skyward X — Blue!')).toBe(queryHash('hoka skyward x blue'));
  });

  it('drops apostrophes rather than splitting the word', () => {
    expect(normaliseQuery("Levi's 501")).toBe('levis 501');
  });

  it('strips diacritics', () => {
    expect(normaliseQuery('Hermès Birkin')).toBe('hermes birkin');
  });

  it('removes words that add nothing to a shopping query', () => {
    expect(normaliseQuery('the blue shoe for running')).toBe('blue shoe running');
  });

  it('preserves word order, because reordering would merge distinct products', () => {
    expect(normaliseQuery('blue shoe')).not.toBe(normaliseQuery('shoe blue'));
  });

  it('produces a stable hash', () => {
    expect(queryHash('a b c')).toBe(queryHash('a b c'));
    expect(queryHash('a b c')).not.toBe(queryHash('a b d'));
  });

  it('measures token overlap', () => {
    expect(tokenOverlap('hoka skyward x', 'HOKA Skyward X Running Shoe')).toBe(1);
    expect(tokenOverlap('hoka skyward', 'Brooks Ghost 16')).toBe(0);
  });
});

describe('buildSearchQuery', () => {
  it('leads with the brand when a logo was visible', () => {
    expect(buildSearchQuery({ brand: 'HOKA', searchQuery: 'skyward x blue' })).toBe(
      'HOKA skyward x blue',
    );
  });

  it('does not repeat a brand the model already included', () => {
    expect(buildSearchQuery({ brand: 'HOKA', searchQuery: 'hoka skyward x blue' })).toBe(
      'hoka skyward x blue',
    );
  });

  it('leaves the query alone when no brand was identified', () => {
    expect(buildSearchQuery({ brand: null, searchQuery: 'blue running shoe' })).toBe(
      'blue running shoe',
    );
  });
});

describe('ranking', () => {
  const query = 'hoka skyward x blue running shoe';

  it('puts an exact brand match on top', () => {
    const ranked = rankCandidates({
      query,
      brand: 'HOKA',
      candidates: [
        candidate({ brand: 'Brooks', title: 'Brooks Ghost 16 Running Shoe' }),
        candidate(),
      ],
    });
    expect(ranked[0]!.candidate.brand).toBe('HOKA');
  });

  it('heavily penalises a brand mismatch when a logo was seen', () => {
    // Showing someone the wrong shoe is the fastest way to lose their trust in
    // everything else on the card.
    const ranked = rankCandidates({
      query,
      brand: 'HOKA',
      candidates: [candidate({ brand: 'Brooks', title: 'Brooks Ghost 16' })],
    });
    expect(ranked[0]!.score).toBeLessThan(MIN_ACCEPTABLE_SCORE);
    expect(ranked[0]!.reasons).toContain('brand does not match');
  });

  it('demotes a listing with no product image', () => {
    const withImage = rankCandidates({ query, brand: 'HOKA', candidates: [candidate()] })[0]!;
    const without = rankCandidates({
      query,
      brand: 'HOKA',
      candidates: [candidate({ imageUrl: null })],
    })[0]!;
    // No image means no cutout, and the card loses the thing that makes it look
    // premium.
    expect(without.score).toBeLessThan(withImage.score);
  });

  it('rejects implausibly cheap listings', () => {
    const ranked = rankCandidates({
      query,
      brand: 'HOKA',
      candidates: [candidate({ priceCents: 99 })],
    });
    expect(ranked[0]!.reasons).toContain('implausibly cheap');
  });

  it('recognises resale platforms without treating them as bad results', () => {
    expect(isResaleSource('Depop')).toBe(true);
    expect(isResaleSource('ThredUp')).toBe(true);
    expect(isResaleSource('Nordstrom')).toBe(false);
  });

  it('is deterministic, breaking ties by title', () => {
    const candidates = [candidate({ title: 'B item' }), candidate({ title: 'A item' })];
    const first = rankCandidates({ query, brand: 'HOKA', candidates }).map(
      (r) => r.candidate.title,
    );
    const second = rankCandidates({ query, brand: 'HOKA', candidates }).map(
      (r) => r.candidate.title,
    );
    expect(first).toEqual(second);
  });
});

describe('resolveBest', () => {
  const query = 'hoka skyward x blue';

  it('separates the pick, the alternates and the secondhand options', () => {
    const result = resolveBest({
      query,
      brand: 'HOKA',
      candidates: [
        candidate({ source: 'HOKA', title: 'HOKA Skyward X' }),
        candidate({ source: 'Nordstrom', title: 'HOKA Skyward X Blue' }),
        candidate({ source: 'Poshmark', title: 'HOKA Skyward X used', isSecondhand: true }),
        candidate({ source: 'ThredUp', title: 'HOKA Skyward X preloved', isSecondhand: true }),
      ],
    });

    expect(result.best).not.toBeNull();
    expect(result.secondhand.length).toBeGreaterThan(0);
    // Resale belongs in its own rail, not mixed into the main alternates.
    expect(result.alternates.every((a) => !isResaleSource(a.candidate.source))).toBe(true);
  });

  it('returns nothing rather than a wrong product when confidence is low', () => {
    // Better to show the item with no buy link than to send someone to the
    // wrong thing.
    const result = resolveBest({
      query,
      brand: 'HOKA',
      candidates: [candidate({ brand: 'Brooks', title: 'Brooks Ghost 16', imageUrl: null })],
    });
    expect(result.best).toBeNull();
  });

  it('handles an empty candidate list', () => {
    const result = resolveBest({ query, brand: null, candidates: [] });
    expect(result.best).toBeNull();
    expect(result.alternates).toEqual([]);
    expect(result.secondhand).toEqual([]);
  });

  it('caps the number of alternates', () => {
    const many = Array.from({ length: 10 }, (_, i) =>
      candidate({ title: `HOKA Skyward X variant ${i}`, source: 'Nordstrom' }),
    );
    const result = resolveBest({ query, brand: 'HOKA', candidates: many }, 2);
    expect(result.alternates.length).toBeLessThanOrEqual(2);
  });
});
