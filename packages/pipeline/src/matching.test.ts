import { describe, expect, it } from 'vitest';
import type { ProductCandidate } from '@viola/core';
import {
  chooseStrategy,
  findGarment,
  savingsPercent,
  type MatchDeps,
  type MatchInput,
} from './matching';
import { MockProductSearchProvider } from './providers/product/mock';
import { MockVisualSearchProvider, type VisualSearchProvider } from './providers/product/visual';

const cutout = Buffer.from('a-clean-garment-cutout');

const input = (over: Partial<MatchInput> = {}): MatchInput => ({
  brand: null,
  searchQuery: 'striped wide leg trousers',
  subtype: 'trousers',
  cutout,
  confidence: 0.8,
  ...over,
});

const deps = (over: Partial<MatchDeps> = {}): MatchDeps => ({
  text: over.text ?? new MockProductSearchProvider(),
  visual: over.visual ?? new MockVisualSearchProvider(),
});

describe('choosing how to look a garment up', () => {
  it('leads with text when a logo was visible', () => {
    // A confirmed brand is the strongest signal there is; visual search is
    // less precise about exact identity.
    expect(chooseStrategy(input({ brand: 'Aritzia' }))).toBe('text-first');
  });

  it('leads with visual when there is no brand', () => {
    // This is the common case. "white crop top" matches ten thousand crop tops
    // and none of them are hers.
    expect(chooseStrategy(input({ brand: null }))).toBe('visual-first');
  });

  it('falls back to text when there is no usable cutout', () => {
    expect(chooseStrategy(input({ brand: null, cutout: null }))).toBe('text-only');
    expect(chooseStrategy(input({ brand: 'HOKA', cutout: null }))).toBe('text-only');
  });

  it('treats an empty buffer as no cutout', () => {
    expect(chooseStrategy(input({ brand: null, cutout: Buffer.alloc(0) }))).toBe('text-only');
  });
});

describe('finding a branded garment', () => {
  it('uses the text result as the pick', async () => {
    const result = await findGarment(
      input({ brand: 'Aritzia', searchQuery: 'effortless pant black' }),
      deps(),
    );

    expect(result.strategy).toBe('text-first');
    expect(result.best).not.toBeNull();
    expect(result.best!.title).toContain('Aritzia');
  });

  it('still runs visual search, because the dupes rail is the point', async () => {
    // Text search cannot answer "where else, cheaper". That is the entire
    // reason someone opens the look-alikes.
    const visual = new MockVisualSearchProvider();
    const result = await findGarment(input({ brand: 'Aritzia' }), deps({ visual }));

    expect(visual.calls).toHaveLength(1);
    expect(result.lookAlikes.length).toBeGreaterThan(0);
    expect(result.searches).toBe(2);
  });

  it('does not let a weak visual match override a confirmed text match', async () => {
    const result = await findGarment(
      input({ brand: 'Aritzia', searchQuery: 'effortless pant black' }),
      deps(),
    );
    // The pick came from text; visual only contributed look-alikes.
    expect(result.best!.source).toBe('Aritzia');
  });
});

describe('finding an unbranded garment', () => {
  it('falls back to a visual exact match when text found nothing', async () => {
    const emptyText = new MockProductSearchProvider({ returnEmpty: true });
    const result = await findGarment(input({ brand: null }), deps({ text: emptyText }));

    expect(result.strategy).toBe('visual-first');
    expect(result.best).not.toBeNull();
  });

  it('shows look-alikes even when nothing matches exactly', async () => {
    const barren: VisualSearchProvider = {
      name: 'barren',
      costCents: 0,
      search: async () => ({
        exact: [],
        similar: [
          {
            title: 'Similar trousers',
            brand: null,
            source: 'Zara',
            priceCents: 4990,
            currency: 'USD',
            merchantUrl: 'https://zara.example/p/1',
            imageUrl: 'https://cdn.example/1.png',
            rating: null,
            reviewCount: null,
            isSecondhand: false,
          },
        ],
      }),
    };

    const result = await findGarment(input({ brand: null }), deps({ visual: barren }));

    expect(result.best).toBeNull();
    expect(result.lookAlikes).toHaveLength(1);
    expect(result.notes.some((n) => n.includes('look-alikes only'))).toBe(true);
  });
});

describe('the look-alikes rail', () => {
  it('is sorted cheapest first', async () => {
    const result = await findGarment(input({ brand: null }), deps());
    const prices = result.lookAlikes.map((c) => c.priceCents ?? Infinity);
    expect([...prices].sort((a, b) => a - b)).toEqual(prices);
  });

  it('keeps resale separate from new', async () => {
    // Roughly half of younger shoppers' apparel spend goes to resale, so it
    // gets its own rail rather than being mixed in or filtered out.
    const result = await findGarment(input({ brand: null }), deps());
    expect(
      result.secondhand.every((c) => c.isSecondhand || /depop|poshmark|thredup/i.test(c.source)),
    ).toBe(true);
    expect(result.lookAlikes.every((c) => !/depop|poshmark|thredup/i.test(c.source))).toBe(true);
  });

  it('never repeats the main pick in the look-alikes', async () => {
    const result = await findGarment(input({ brand: null }), deps());
    if (result.best) {
      expect(result.lookAlikes.some((c) => c.merchantUrl === result.best!.merchantUrl)).toBe(false);
    }
  });
});

describe('resilience', () => {
  it('survives text search being down', async () => {
    const broken = {
      name: 'broken',
      costCents: 0,
      search: async () => {
        throw new Error('vendor down');
      },
    };
    const result = await findGarment(input({ brand: 'Aritzia' }), deps({ text: broken }));

    expect(result.notes.some((n) => n.includes('text search failed'))).toBe(true);
    // Visual still ran, so the user is not left with nothing.
    expect(result.lookAlikes.length).toBeGreaterThan(0);
  });

  it('survives visual search being down', async () => {
    const broken: VisualSearchProvider = {
      name: 'broken',
      costCents: 0,
      search: async () => {
        throw new Error('lens down');
      },
    };
    const result = await findGarment(input({ brand: 'Aritzia' }), deps({ visual: broken }));

    expect(result.notes.some((n) => n.includes('visual search failed'))).toBe(true);
    expect(result.best).not.toBeNull();
  });

  it('survives both being down without throwing', async () => {
    const broken = {
      name: 'broken',
      costCents: 0,
      search: async () => {
        throw new Error('down');
      },
    };
    const result = await findGarment(input({ brand: 'Aritzia' }), {
      text: broken,
      visual: broken as unknown as VisualSearchProvider,
    });

    expect(result.best).toBeNull();
    expect(result.lookAlikes).toEqual([]);
    expect(result.notes).toHaveLength(2);
  });

  it('does not attempt visual search without a cutout', async () => {
    const visual = new MockVisualSearchProvider();
    const result = await findGarment(input({ brand: 'HOKA', cutout: null }), deps({ visual }));

    expect(visual.calls).toHaveLength(0);
    expect(result.searches).toBe(1);
  });
});

describe('savings', () => {
  const priced = (cents: number): ProductCandidate => ({
    title: 't',
    brand: null,
    source: 's',
    priceCents: cents,
    currency: 'USD',
    merchantUrl: 'https://x.example',
    imageUrl: null,
    rating: null,
    reviewCount: null,
    isSecondhand: false,
  });

  it('computes how much cheaper the dupe is', () => {
    expect(savingsPercent(priced(12800), priced(4990))).toBe(61);
  });

  it('returns nothing when the alternative is not actually cheaper', () => {
    expect(savingsPercent(priced(4990), priced(12800))).toBeNull();
    expect(savingsPercent(priced(4990), priced(4990))).toBeNull();
  });

  it('handles a missing price', () => {
    expect(savingsPercent(priced(4990), null)).toBeNull();
    expect(savingsPercent(null, priced(4990))).toBeNull();
  });
});
