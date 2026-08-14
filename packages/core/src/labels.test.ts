import { describe, expect, it } from 'vitest';
import { formatItemLabel, formatItemLine } from './labels.js';

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
