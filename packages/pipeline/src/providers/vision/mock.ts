import { createHash } from 'node:crypto';
import { visionResultSchema, type VisionResult } from '@viola/core';
import type { VisionProvider, VisionRequest } from '../types.js';

/**
 * The mock vision provider.
 *
 * Returns a plausible, fully-formed analysis so the entire pipeline, the
 * renderer and both clients can be exercised without a Gemini key. Output is
 * chosen deterministically from the image bytes, so the same upload always
 * yields the same look — which keeps golden-image tests and screenshots stable.
 *
 * The fixtures below intentionally mirror what a real model returns, including
 * the awkward parts: a null brand when no logo is visible, varying confidence,
 * and a non-primary accessory.
 */

interface Fixture {
  result: VisionResult;
}

const runningFit: VisionResult = {
  items: [
    {
      category: 'watch',
      subtype: 'GPS running watch',
      brand: 'COROS',
      colors: ['silver', 'grey'],
      pattern: 'solid',
      material: 'titanium',
      styleTags: ['technical', 'athletic', 'running'],
      description: 'A lightweight GPS watch with a titanium bezel and a fabric strap.',
      searchQuery: 'coros pace pro gps watch',
      bbox: [0.44, 0.3, 0.5, 0.35],
      confidence: 0.79,
      isPrimary: true,
    },
    {
      category: 'bottom',
      subtype: '5-inch running shorts',
      brand: 'Under Armour',
      colors: ['black'],
      pattern: 'solid',
      material: 'polyester',
      styleTags: ['athletic', 'running', 'sporty'],
      description: 'Lightweight woven running shorts with a built-in liner.',
      searchQuery: 'under armour ua launch 5 inch shorts black',
      bbox: [0.33, 0.5, 0.47, 0.62],
      confidence: 0.86,
      isPrimary: true,
    },
    {
      category: 'footwear',
      subtype: 'road running shoe',
      brand: 'HOKA',
      colors: ['blue', 'periwinkle'],
      pattern: 'solid',
      material: 'engineered mesh',
      styleTags: ['athletic', 'running', 'technical'],
      description: 'A tall-stack carbon-plated road shoe in a cobalt colourway.',
      searchQuery: 'hoka skyward x blue',
      bbox: [0.34, 0.84, 0.46, 0.92],
      confidence: 0.91,
      isPrimary: true,
    },
    {
      category: 'top',
      subtype: 'technical tee',
      // No visible logo, so no brand. A guess here is worse than an absence.
      brand: null,
      colors: ['charcoal'],
      pattern: 'solid',
      material: 'polyester blend',
      styleTags: ['athletic', 'minimalist'],
      description: 'A relaxed charcoal training tee in a breathable knit.',
      searchQuery: 'charcoal technical running t-shirt',
      bbox: [0.32, 0.26, 0.48, 0.5],
      confidence: 0.64,
      isPrimary: true,
    },
  ],
  styleTags: ['athletic', 'technical', 'running', 'sporty', 'minimalist'],
  score: { fit: 78, colorStory: 71, texture: 63, statement: 60, cohesion: 82 },
  captionSuggestions: ['morning miles', 'easy 5.5 before the heat', 'blue shoes summer'],
  safety: { flagged: false, reasons: [] },
};

const downtownFit: VisionResult = {
  items: [
    {
      category: 'bag',
      subtype: 'structured leather tote',
      brand: null,
      colors: ['black'],
      pattern: 'solid',
      material: 'leather',
      styleTags: ['minimalist', 'refined', 'urban'],
      description: 'A soft-structured leather tote that still holds its shape.',
      searchQuery: 'black structured leather tote bag',
      bbox: [0.58, 0.42, 0.74, 0.58],
      confidence: 0.71,
      isPrimary: true,
    },
    {
      category: 'bottom',
      subtype: 'wide-leg trouser',
      brand: 'Aritzia',
      colors: ['black'],
      pattern: 'solid',
      material: 'crepe',
      styleTags: ['tailored', 'oversized', 'urban', 'black'],
      description: 'A fluid high-rise trouser with a clean break at the shoe.',
      searchQuery: 'aritzia effortless pant black',
      bbox: [0.33, 0.52, 0.55, 0.86],
      confidence: 0.83,
      isPrimary: true,
    },
    {
      category: 'footwear',
      subtype: 'terrace sneaker',
      brand: 'adidas',
      colors: ['white', 'black'],
      pattern: 'solid',
      material: 'leather',
      styleTags: ['street', 'retro', 'urban'],
      description: 'The gum-sole terrace sneaker that refuses to go out of style.',
      searchQuery: 'adidas samba og white black',
      bbox: [0.34, 0.88, 0.54, 0.96],
      confidence: 0.94,
      isPrimary: true,
    },
    {
      category: 'eyewear',
      subtype: 'rectangular sunglasses',
      brand: null,
      colors: ['black'],
      pattern: 'solid',
      material: 'acetate',
      styleTags: ['urban', 'sleek'],
      description: 'Slim rectangular acetate frames.',
      searchQuery: 'black rectangular acetate sunglasses',
      bbox: [0.42, 0.12, 0.52, 0.16],
      confidence: 0.55,
      isPrimary: false,
    },
  ],
  styleTags: ['black', 'oversized', 'urban', 'leather', 'tailored'],
  score: { fit: 85, colorStory: 74, texture: 79, statement: 81, cohesion: 92 },
  captionSuggestions: ['all black everything', 'uniform', 'downtown errands'],
  safety: { flagged: false, reasons: [] },
};

const cleanFit: VisionResult = {
  items: [
    {
      category: 'top',
      subtype: 'ribbed turtleneck',
      brand: 'Uniqlo',
      colors: ['cream'],
      pattern: 'solid',
      material: 'rayon blend',
      styleTags: ['minimalist', 'clean', 'neutral'],
      description: 'A slim cream turtleneck that layers under almost anything.',
      searchQuery: 'uniqlo heattech turtleneck cream',
      bbox: [0.36, 0.26, 0.6, 0.5],
      confidence: 0.77,
      isPrimary: true,
    },
    {
      category: 'bottom',
      subtype: 'straight-leg jeans',
      brand: "Levi's",
      colors: ['mid blue'],
      pattern: 'solid',
      material: 'denim',
      styleTags: ['denim', 'clean', 'vintage'],
      description: 'Mid-wash straight jeans with a vintage-correct rise.',
      searchQuery: 'levis 501 90s jeans mid wash',
      bbox: [0.34, 0.5, 0.58, 0.88],
      confidence: 0.88,
      isPrimary: true,
    },
    {
      category: 'footwear',
      subtype: 'terrace sneaker',
      brand: 'adidas',
      colors: ['white'],
      pattern: 'solid',
      material: 'leather',
      styleTags: ['clean', 'retro', 'minimalist'],
      description: 'White leather terrace sneakers with a gum sole.',
      searchQuery: 'adidas samba og white black',
      bbox: [0.36, 0.89, 0.56, 0.97],
      confidence: 0.9,
      isPrimary: true,
    },
  ],
  styleTags: ['minimalist', 'neutral', 'clean', 'denim'],
  score: { fit: 88, colorStory: 83, texture: 70, statement: 64, cohesion: 90 },
  captionSuggestions: ['thrifted the jeans', 'no notes', 'simple today'],
  safety: { flagged: false, reasons: [] },
};

const FIXTURES: Fixture[] = [{ result: runningFit }, { result: downtownFit }, { result: cleanFit }];

export interface MockVisionOptions {
  /** Force one fixture, for tests that need a known shape. */
  fixtureIndex?: number;
  /** Simulate the safety filter firing, to exercise quarantine. */
  forceFlagged?: boolean;
  /** Simulated latency, so reveal animations can be developed honestly. */
  delayMs?: number;
}

export class MockVisionProvider implements VisionProvider {
  readonly name = 'mock';
  readonly costCents = 0;

  constructor(private readonly options: MockVisionOptions = {}) {}

  async analyse(request: VisionRequest): Promise<VisionResult> {
    if (this.options.delayMs) {
      await new Promise((resolve) => setTimeout(resolve, this.options.delayMs));
    }

    if (this.options.forceFlagged) {
      return visionResultSchema.parse({
        items: [],
        styleTags: [],
        score: { fit: 0, colorStory: 0, texture: 0, statement: 0, cohesion: 0 },
        captionSuggestions: [],
        safety: { flagged: true, reasons: ['simulated policy violation'] },
      });
    }

    const index =
      this.options.fixtureIndex ??
      // Deterministic per image, so the same upload always yields the same look.
      parseInt(createHash('sha256').update(request.image).digest('hex').slice(0, 8), 16) %
        FIXTURES.length;

    const fixture = FIXTURES[index % FIXTURES.length]!;
    // Parse rather than cast: the mock must satisfy the same contract the real
    // provider does, or it stops being a useful stand-in.
    return visionResultSchema.parse(structuredClone(fixture.result));
  }
}

export const MOCK_VISION_FIXTURE_COUNT = FIXTURES.length;
