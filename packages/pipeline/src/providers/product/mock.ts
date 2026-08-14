import { productCandidateSchema, type ProductCandidate } from '@viola/core';
import { normaliseQuery, tokenOverlap } from '../../normalise.js';
import type { ProductSearchProvider, ProductSearchRequest } from '../types.js';

/**
 * Mock product search.
 *
 * Holds a small catalogue matching the mock vision fixtures, so an end-to-end
 * run offline produces a look with real-looking brands, prices and retailers.
 *
 * It also returns deliberately imperfect result sets — a wrong-brand listing, a
 * resale option, one entry with no image — because the ranking code needs to be
 * exercised against the mess it will actually see, not a curated happy path.
 */

interface CatalogueEntry extends ProductCandidate {
  keywords: string[];
}

const entry = (
  e: Omit<CatalogueEntry, 'currency' | 'isSecondhand'> & {
    currency?: string;
    isSecondhand?: boolean;
  },
): CatalogueEntry => ({
  currency: 'USD',
  isSecondhand: false,
  ...e,
});

const CATALOGUE: CatalogueEntry[] = [
  entry({
    keywords: ['hoka', 'skyward', 'blue', 'running', 'shoe'],
    title: 'HOKA Skyward X Running Shoe',
    brand: 'HOKA',
    source: 'HOKA',
    priceCents: 22500,
    merchantUrl: 'https://www.hoka.com/en/us/mens-road/skyward-x/',
    imageUrl: 'https://cdn.example.com/hoka-skyward-x-blue.png',
    rating: 4.6,
    reviewCount: 812,
  }),
  entry({
    keywords: ['hoka', 'skyward', 'blue', 'running', 'shoe'],
    title: 'HOKA Skyward X — Virtual Blue / Cosmos',
    brand: 'HOKA',
    source: 'Nordstrom',
    priceCents: 22500,
    merchantUrl: 'https://www.nordstrom.com/s/hoka-skyward-x',
    imageUrl: 'https://cdn.example.com/hoka-nordstrom.png',
    rating: 4.5,
    reviewCount: 143,
  }),
  entry({
    keywords: ['hoka', 'skyward', 'blue', 'running', 'shoe'],
    title: 'HOKA Skyward X (pre-owned, size 9)',
    brand: 'HOKA',
    source: 'Poshmark',
    priceCents: 12000,
    merchantUrl: 'https://poshmark.com/listing/hoka-skyward-x',
    imageUrl: 'https://cdn.example.com/hoka-posh.png',
    rating: null,
    reviewCount: null,
    isSecondhand: true,
  }),
  entry({
    // Wrong brand for a HOKA query — ranking must push this down.
    keywords: ['running', 'shoe', 'blue'],
    title: 'Brooks Ghost 16 Running Shoe',
    brand: 'Brooks',
    source: 'Zappos',
    priceCents: 14000,
    merchantUrl: 'https://www.zappos.com/p/brooks-ghost-16',
    imageUrl: 'https://cdn.example.com/brooks-ghost.png',
    rating: 4.7,
    reviewCount: 2210,
  }),
  entry({
    keywords: ['coros', 'pace', 'pro', 'gps', 'watch'],
    title: 'COROS PACE Pro GPS Sport Watch',
    brand: 'COROS',
    source: 'COROS',
    priceCents: 34900,
    merchantUrl: 'https://coros.com/pace-pro',
    imageUrl: 'https://cdn.example.com/coros-pace-pro.png',
    rating: 4.8,
    reviewCount: 1240,
  }),
  entry({
    keywords: ['under', 'armour', 'launch', 'shorts', 'black', '5'],
    title: 'Under Armour UA Launch 5" Shorts',
    brand: 'Under Armour',
    source: 'Under Armour',
    priceCents: 3500,
    merchantUrl: 'https://www.underarmour.com/en-us/p/shorts/ua-launch-5-shorts/',
    imageUrl: 'https://cdn.example.com/ua-launch.png',
    rating: 4.5,
    reviewCount: 3410,
  }),
  entry({
    keywords: ['aritzia', 'effortless', 'pant', 'black', 'trouser', 'wide'],
    title: 'Aritzia Effortless Pant',
    brand: 'Aritzia',
    source: 'Aritzia',
    priceCents: 12800,
    merchantUrl: 'https://www.aritzia.com/us/en/product/effortless-pant',
    imageUrl: 'https://cdn.example.com/aritzia-effortless.png',
    rating: 4.7,
    reviewCount: 2210,
  }),
  entry({
    keywords: ['aritzia', 'effortless', 'pant', 'black'],
    title: 'Aritzia Effortless Pant, black, size 4',
    brand: 'Aritzia',
    source: 'Depop',
    priceCents: 5500,
    merchantUrl: 'https://depop.com/products/aritzia-effortless',
    imageUrl: 'https://cdn.example.com/depop-aritzia.png',
    rating: null,
    reviewCount: null,
    isSecondhand: true,
  }),
  entry({
    keywords: ['adidas', 'samba', 'og', 'white', 'black', 'sneaker', 'terrace'],
    title: 'adidas Samba OG Shoes',
    brand: 'adidas',
    source: 'adidas',
    priceCents: 10000,
    merchantUrl: 'https://www.adidas.com/us/samba-og-shoes',
    imageUrl: 'https://cdn.example.com/samba-og.png',
    rating: 4.8,
    reviewCount: 9820,
  }),
  entry({
    keywords: ['uniqlo', 'heattech', 'turtleneck', 'cream', 'ribbed', 'top'],
    title: 'Uniqlo HEATTECH Ribbed Turtleneck T-Shirt',
    brand: 'Uniqlo',
    source: 'Uniqlo',
    priceCents: 1990,
    merchantUrl: 'https://www.uniqlo.com/us/en/products/heattech-turtleneck',
    imageUrl: 'https://cdn.example.com/uniqlo-turtleneck.png',
    rating: 4.4,
    reviewCount: 5120,
  }),
  entry({
    keywords: ['levis', '501', '90s', 'jeans', 'straight', 'denim', 'mid', 'wash'],
    title: "Levi's 501 '90s Women's Jeans",
    brand: "Levi's",
    source: "Levi's",
    priceCents: 9800,
    merchantUrl: 'https://www.levi.com/US/en_US/clothing/women/jeans/501-90s',
    imageUrl: 'https://cdn.example.com/levis-501-90s.png',
    rating: 4.6,
    reviewCount: 4400,
  }),
  entry({
    keywords: ['levis', '501', 'jeans', 'vintage', 'denim'],
    title: "Vintage Levi's 501 Jeans, mid wash",
    brand: "Levi's",
    source: 'ThredUp',
    priceCents: 2900,
    merchantUrl: 'https://thredup.com/product/levis-501',
    imageUrl: 'https://cdn.example.com/thredup-levis.png',
    rating: null,
    reviewCount: null,
    isSecondhand: true,
  }),
  entry({
    keywords: ['black', 'structured', 'leather', 'tote', 'bag'],
    title: 'Structured Leather Tote Bag, Black',
    brand: null,
    source: 'COS',
    priceCents: 25000,
    merchantUrl: 'https://www.cos.com/en/bags/tote',
    imageUrl: 'https://cdn.example.com/cos-tote.png',
    rating: 4.3,
    reviewCount: 88,
  }),
  entry({
    // No image on purpose — ranking should demote it.
    keywords: ['charcoal', 'technical', 'running', 'shirt', 't', 'tee'],
    title: 'Technical Running T-Shirt, Charcoal',
    brand: null,
    source: 'Decathlon',
    priceCents: 1500,
    merchantUrl: 'https://www.decathlon.com/products/technical-tee',
    imageUrl: null,
    rating: 4.1,
    reviewCount: 320,
  }),
  entry({
    keywords: ['black', 'rectangular', 'acetate', 'sunglasses', 'eyewear'],
    title: 'Rectangular Acetate Sunglasses',
    brand: null,
    source: 'Mango',
    priceCents: 3590,
    merchantUrl: 'https://shop.mango.com/us/sunglasses',
    imageUrl: 'https://cdn.example.com/mango-sunglasses.png',
    rating: 4.0,
    reviewCount: 41,
  }),
];

export interface MockProductSearchOptions {
  delayMs?: number;
  /** Return nothing, to exercise the unresolved-item path. */
  returnEmpty?: boolean;
}

export class MockProductSearchProvider implements ProductSearchProvider {
  readonly name = 'mock';
  readonly costCents = 0;

  /** Lets tests assert the cache actually prevented duplicate lookups. */
  public readonly calls: string[] = [];

  constructor(private readonly options: MockProductSearchOptions = {}) {}

  async search(request: ProductSearchRequest): Promise<ProductCandidate[]> {
    this.calls.push(request.query);

    if (this.options.delayMs) {
      await new Promise((resolve) => setTimeout(resolve, this.options.delayMs));
    }
    if (this.options.returnEmpty) return [];

    const tokens = new Set(normaliseQuery(request.query).split(' ').filter(Boolean));

    const scored = CATALOGUE.map((item) => {
      let hits = 0;
      for (const keyword of item.keywords) if (tokens.has(keyword)) hits++;
      const titleOverlap = tokenOverlap(request.query, item.title);
      return { item, relevance: hits + titleOverlap * 2 };
    })
      .filter((s) => s.relevance > 0.5)
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, request.limit ?? 8);

    return scored.map((s) => {
      const { keywords: _keywords, ...candidate } = s.item;
      return productCandidateSchema.parse(candidate);
    });
  }
}
