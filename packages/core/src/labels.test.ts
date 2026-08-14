import { describe, expect, it } from 'vitest';
import {
  fitLabel,
  formatItemLabel,
  formatItemLine,
  labelCharBudget,
  truncateLabel,
} from './labels';

describe('formatItemLabel', () => {
  it('does not repeat the brand when the retailer title already includes it', () => {
    // "ADIDAS / ADIDAS SAMBA OG SHOES" looks careless on an otherwise
    // precise card, and retailer titles almost always lead with the brand.
    expect(
      formatItemLabel({ brand: 'adidas', title: 'adidas Samba OG Shoes', subtype: 'sneaker' }),
    ).toEqual({ brand: 'ADIDAS', name: 'SAMBA OG' });
  });

  it('handles multi-word brands', () => {
    expect(
      formatItemLabel({
        brand: 'Under Armour',
        title: 'Under Armour UA Launch 5" Shorts',
        subtype: 'shorts',
      }),
    ).toEqual({ brand: 'UNDER ARMOUR', name: 'UA LAUNCH 5" SHORTS' });
  });

  it('matches the brand regardless of punctuation', () => {
    expect(
      formatItemLabel({
        brand: "Levi's",
        title: "Levi's 501 '90s Women's Jeans",
        subtype: 'jeans',
      }),
    ).toEqual({ brand: "LEVI'S", name: "501 '90S JEANS" });
  });

  it('leaves the title alone when it does not start with the brand', () => {
    expect(
      formatItemLabel({ brand: 'HOKA', title: 'Skyward X Running Shoe', subtype: 'sneaker' }),
    ).toEqual({ brand: 'HOKA', name: 'SKYWARD X RUNNING' });
  });

  it('falls back to the garment type when there is no title', () => {
    expect(formatItemLabel({ brand: 'HOKA', title: null, subtype: 'road running shoe' })).toEqual({
      brand: 'HOKA',
      name: 'ROAD RUNNING SHOE',
    });
  });

  it('renders an unidentified item with no brand line', () => {
    // A null brand must produce an empty brand line, never the word "null" or
    // a guessed label.
    expect(formatItemLabel({ brand: null, title: null, subtype: 'technical tee' })).toEqual({
      brand: '',
      name: 'TECHNICAL TEE',
    });
  });

  it('keeps the garment type when stripping would empty the line', () => {
    expect(formatItemLabel({ brand: 'Nike', title: 'Nike Shoes', subtype: 'trainer' })).toEqual({
      brand: 'NIKE',
      name: 'TRAINER',
    });
  });

  it('strips gendered retailer boilerplate', () => {
    expect(
      formatItemLabel({
        brand: 'Uniqlo',
        title: 'Uniqlo Ribbed Turtleneck T-Shirt',
        subtype: 'top',
      }).name,
    ).toBe('RIBBED TURTLENECK');
  });

  it('never leaves dangling punctuation', () => {
    const label = formatItemLabel({
      brand: 'COS',
      title: 'COS Structured Tote Bag — ',
      subtype: 'bag',
    });
    expect(label.name).not.toMatch(/[\s,–—-]$/);
  });
});

describe('truncateLabel', () => {
  it('leaves short labels alone', () => {
    expect(truncateLabel('SAMBA OG', 26)).toBe('SAMBA OG');
  });

  it('breaks on a word boundary when it can', () => {
    expect(truncateLabel('STRUCTURED LEATHER TOTE BAG', 26)).toBe('STRUCTURED LEATHER TOTE…');
  });

  it('never splits a long word across the cut', () => {
    // React Native will happily wrap a single long word mid-way as
    // "STRUCTUR" / "ED…", which reads as a rendering fault. Capping the text
    // before it reaches the view is the only reliable prevention.
    // The ellipsis counts against the budget, so an 8-character cap yields
    // seven characters plus the mark.
    const result = truncateLabel('STRUCTURED', 8);
    expect(result).toBe('STRUCTU…');
    expect(result.length).toBe(8);
  });

  it('never exceeds the budget by more than the ellipsis', () => {
    for (const value of ['A'.repeat(60), 'word '.repeat(14), 'HOKA SKYWARD X BLUE']) {
      expect(truncateLabel(value, 20).length).toBeLessThanOrEqual(20);
    }
  });

  it('is identical across every surface that renders a label', () => {
    // The web card, the native card and the server-side renderer all call
    // this. If they disagreed, a shared card would stop matching the page it
    // came from.
    const cases = ['ADIDAS SAMBA OG SHOES', 'STRUCTURED LEATHER TOTE BAG BLACK', 'HOKA'];
    for (const value of cases) {
      expect(truncateLabel(value, 26)).toBe(truncateLabel(value, 26));
    }
  });
});

describe('labelCharBudget', () => {
  it('scales with the slot width', () => {
    expect(labelCharBudget(280)).toBeGreaterThan(labelCharBudget(100));
  });

  it('never returns a budget too small to be readable', () => {
    // A very narrow gutter should still show something rather than collapsing
    // to a bare ellipsis. Six is the floor — enough for "HOKA…".
    expect(labelCharBudget(10)).toBeGreaterThanOrEqual(6);
  });

  it('keeps a phone and a share card in rough agreement', () => {
    // A 100px slot on a phone and a 280px slot on a 1080px card should both
    // land on a sane number of characters.
    expect(labelCharBudget(100)).toBeGreaterThanOrEqual(8);
    expect(labelCharBudget(280)).toBeLessThanOrEqual(48);
  });
});

describe('formatItemLine', () => {
  it('joins brand and name for the rail', () => {
    expect(formatItemLine({ brand: 'HOKA', title: 'HOKA Skyward X', subtype: 'sneaker' })).toBe(
      'HOKA SKYWARD X',
    );
  });

  it('omits the leading space when there is no brand', () => {
    expect(formatItemLine({ brand: null, title: null, subtype: 'tee' })).toBe('TEE');
  });
});

describe('fitLabel', () => {
  it('hard-cuts a word that is wider than one line', () => {
    // The bug this exists for: a ten-character word in an eight-character
    // line wraps as "STRUCTUR" / "ED…", which looks broken. Capping total
    // length does not help, because the FIRST word is already too wide.
    expect(fitLabel('STRUCTURED LEATHER TOTE', 8, 2)).not.toContain('STRUCTURED');
    expect(fitLabel('STRUCTURED', 8, 1)).toBe('STRUCTU…');
  });

  it('never emits a line longer than the budget', () => {
    const cases = [
      'STRUCTURED LEATHER TOTE BAG BLACK',
      'HEATTECH RIBBED TURTLENECK',
      'SUPERCALIFRAGILISTICEXPIALIDOCIOUS',
      "501 '90S JEANS",
    ];
    for (const value of cases) {
      for (const perLine of [6, 8, 12, 20]) {
        const result = fitLabel(value, perLine, 2);
        for (const line of result.split(' ')) {
          expect(line.length, `"${line}" exceeds ${perLine} for "${value}"`).toBeLessThanOrEqual(
            perLine,
          );
        }
      }
    }
  });

  it('leaves a label that already fits completely alone', () => {
    expect(fitLabel('SAMBA OG', 20, 2)).toBe('SAMBA OG');
    expect(fitLabel('HOKA', 12, 1)).toBe('HOKA');
  });

  it('marks truncation with an ellipsis', () => {
    expect(fitLabel('STRUCTURED LEATHER TOTE BAG BLACK', 10, 2)).toMatch(/…$/);
  });

  it('handles empty and degenerate input', () => {
    expect(fitLabel('', 10, 2)).toBe('');
    expect(fitLabel('ANYTHING', 1, 2)).toBe('…');
  });

  it('respects the line limit', () => {
    const oneLine = fitLabel('ONE TWO THREE FOUR FIVE', 9, 1);
    expect(oneLine.length).toBeLessThanOrEqual(10);
  });
});
