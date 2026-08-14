import type { BBox } from '@viola/core';
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_LAYOUT_OPTIONS,
  busyness,
  computeEnergyMap,
  computeLayout,
  flatEnergyMap,
  guttersFor,
  leaderLineStart,
  subjectBandFromBoxes,
} from './layout.js';

/** The reference outfit: watch, shorts, shoes, jacket on a centred subject. */
const REFERENCE_BOXES: BBox[] = [
  [0.44, 0.3, 0.5, 0.35], // watch
  [0.33, 0.5, 0.47, 0.62], // shorts
  [0.34, 0.84, 0.46, 0.92], // shoes
  [0.32, 0.26, 0.48, 0.5], // jacket
];

describe('subject band', () => {
  it('spans the union of the garment boxes, dilated', () => {
    const band = subjectBandFromBoxes(REFERENCE_BOXES);
    // Ground truth for this synthetic subject is roughly 0.313–0.487.
    expect(band.x0).toBeCloseTo(0.29, 2);
    expect(band.x1).toBeCloseTo(0.53, 2);
    expect(band.x0).toBeLessThan(0.313);
    expect(band.x1).toBeGreaterThan(0.487);
  });

  it('never returns a band outside the frame', () => {
    const band = subjectBandFromBoxes([[0, 0, 1, 1]]);
    expect(band.x0).toBe(0);
    expect(band.x1).toBe(1);
  });

  it('assumes a centred subject when nothing was detected', () => {
    // Better to place nothing over the middle than to cover her face.
    const band = subjectBandFromBoxes([]);
    expect(band.x0).toBeLessThan(0.5);
    expect(band.x1).toBeGreaterThan(0.5);
  });

  it('is not fooled by a flat dark torso', () => {
    // This is the regression guard for the approach that failed: column edge
    // energy locks onto the silhouette boundary, not the body, and returned
    // 0.427-0.510 for a subject spanning 0.313-0.487. Bounding boxes do not
    // have that failure mode because they describe regions, not edges.
    const band = subjectBandFromBoxes(REFERENCE_BOXES);
    expect(band.x0).toBeLessThan(0.427);
  });
});

describe('energy map', () => {
  it('reports near-zero energy for a uniform image', () => {
    const grey = new Uint8Array(96 * 171).fill(128);
    const map = computeEnergyMap(grey, 96, 171);
    expect(busyness(map, { x0: 0.2, y0: 0.2, x1: 0.4, y1: 0.4 })).toBe(0);
  });

  it('reports high energy across a hard edge', () => {
    const w = 96;
    const h = 171;
    const grey = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) grey[y * w + x] = x < w / 2 ? 0 : 255;
    }
    const map = computeEnergyMap(grey, w, h);
    const acrossEdge = busyness(map, { x0: 0.45, y0: 0.3, x1: 0.55, y1: 0.5 });
    const flatRegion = busyness(map, { x0: 0.05, y0: 0.3, x1: 0.15, y1: 0.5 });
    expect(acrossEdge).toBeGreaterThan(flatRegion);
  });

  it('returns infinity for an empty rect rather than NaN', () => {
    expect(busyness(flatEnergyMap(), { x0: 0.5, y0: 0.5, x1: 0.5, y1: 0.5 })).toBe(
      Number.POSITIVE_INFINITY,
    );
  });
});

describe('gutters', () => {
  it('finds space on both sides of a centred subject', () => {
    const gutters = guttersFor({ x0: 0.35, x1: 0.65 }, DEFAULT_LAYOUT_OPTIONS);
    expect(gutters.map((g) => g.side)).toEqual(['left', 'right']);
  });

  it('drops a gutter too narrow to hold a card', () => {
    const gutters = guttersFor({ x0: 0.05, x1: 0.6 }, DEFAULT_LAYOUT_OPTIONS);
    expect(gutters.map((g) => g.side)).toEqual(['right']);
  });
});

describe('computeLayout', () => {
  it('places every item for a normal outfit', () => {
    const layout = computeLayout({ boxes: REFERENCE_BOXES });
    expect(layout.slots).toHaveLength(4);
    expect(layout.unplaced).toHaveLength(0);
  });

  it('flanks the subject rather than stacking down one edge', () => {
    // The brief asked for items "right next to the person on the left and right
    // side". Without the balance term every card piles into whichever gutter
    // happens to be calmest.
    const layout = computeLayout({ boxes: REFERENCE_BOXES });
    const left = layout.slots.filter((s) => s.side === 'left').length;
    const right = layout.slots.filter((s) => s.side === 'right').length;
    expect(left).toBeGreaterThan(0);
    expect(right).toBeGreaterThan(0);
    expect(Math.abs(left - right)).toBeLessThanOrEqual(1);
  });

  it('never places a card over the subject', () => {
    const layout = computeLayout({ boxes: REFERENCE_BOXES });
    for (const slot of layout.slots) {
      const clearLeft = slot.rect.x1 <= layout.subject.x0 + 1e-9;
      const clearRight = slot.rect.x0 >= layout.subject.x1 - 1e-9;
      expect(clearLeft || clearRight, `slot ${slot.itemIndex} overlaps the subject`).toBe(true);
    }
  });

  it('never overlaps two cards', () => {
    const layout = computeLayout({ boxes: REFERENCE_BOXES });
    for (let i = 0; i < layout.slots.length; i++) {
      for (let j = i + 1; j < layout.slots.length; j++) {
        const a = layout.slots[i]!.rect;
        const b = layout.slots[j]!.rect;
        const disjoint = a.x1 <= b.x0 || a.x0 >= b.x1 || a.y1 <= b.y0 || a.y0 >= b.y1;
        expect(disjoint, `slots ${i} and ${j} overlap`).toBe(true);
      }
    }
  });

  it('keeps every card inside the frame', () => {
    const layout = computeLayout({ boxes: REFERENCE_BOXES });
    for (const slot of layout.slots) {
      expect(slot.rect.x0).toBeGreaterThanOrEqual(0);
      expect(slot.rect.y0).toBeGreaterThanOrEqual(0);
      expect(slot.rect.x1).toBeLessThanOrEqual(1);
      expect(slot.rect.y1).toBeLessThanOrEqual(1);
    }
  });

  it('anchors each card to the centroid of its garment', () => {
    const layout = computeLayout({ boxes: REFERENCE_BOXES });
    for (const slot of layout.slots) {
      const box = REFERENCE_BOXES[slot.itemIndex]!;
      expect(slot.anchor.x).toBeCloseTo((box[0] + box[2]) / 2, 6);
      expect(slot.anchor.y).toBeCloseTo((box[1] + box[3]) / 2, 6);
    }
  });

  it('stays roughly level with the garment it labels', () => {
    const layout = computeLayout({ boxes: REFERENCE_BOXES });
    for (const slot of layout.slots) {
      const cardCentre = (slot.rect.y0 + slot.rect.y1) / 2;
      expect(Math.abs(cardCentre - slot.anchor.y)).toBeLessThan(0.3);
    }
  });

  it('is deterministic', () => {
    const a = computeLayout({ boxes: REFERENCE_BOXES });
    const b = computeLayout({ boxes: REFERENCE_BOXES });
    expect(a).toEqual(b);
  });

  it('returns slots in item order regardless of vertical placement order', () => {
    const layout = computeLayout({ boxes: REFERENCE_BOXES });
    const indices = layout.slots.map((s) => s.itemIndex);
    expect([...indices].sort((x, y) => x - y)).toEqual(indices);
  });

  it('fits a busy ten-item outfit across both gutters without overlap', () => {
    // Each gutter holds about six slots of 0.15 height, so ten is within
    // capacity. Worth asserting, because it means a maximalist outfit still
    // gets a fully annotated card.
    const many: BBox[] = Array.from({ length: 10 }, (_, i) => {
      const y = 0.05 + i * 0.09;
      return [0.4, y, 0.6, y + 0.05] as BBox;
    });
    const layout = computeLayout({ boxes: many });
    expect(layout.slots).toHaveLength(10);
    expect(layout.unplaced).toHaveLength(0);

    for (let i = 0; i < layout.slots.length; i++) {
      for (let j = i + 1; j < layout.slots.length; j++) {
        const a = layout.slots[i]!.rect;
        const b = layout.slots[j]!.rect;
        expect(a.x1 <= b.x0 || a.x0 >= b.x1 || a.y1 <= b.y0 || a.y0 >= b.y1).toBe(true);
      }
    }
  });

  it('sends the overflow to the rail once both gutters are full', () => {
    // Beyond capacity, unplaced items are rendered in the item rail instead.
    // A dropped card is always better than an overlapping one.
    const tooMany: BBox[] = Array.from({ length: 20 }, (_, i) => {
      const y = 0.02 + (i % 10) * 0.095;
      return [0.4, y, 0.6, y + 0.04] as BBox;
    });
    const layout = computeLayout({ boxes: tooMany });
    expect(layout.slots.length + layout.unplaced.length).toBe(20);
    expect(layout.unplaced.length).toBeGreaterThan(0);

    for (let i = 0; i < layout.slots.length; i++) {
      for (let j = i + 1; j < layout.slots.length; j++) {
        const a = layout.slots[i]!.rect;
        const b = layout.slots[j]!.rect;
        expect(a.x1 <= b.x0 || a.x0 >= b.x1 || a.y1 <= b.y0 || a.y0 >= b.y1).toBe(true);
      }
    }
  });

  it('still places cards when the subject fills the frame', () => {
    const layout = computeLayout({ boxes: [[0.02, 0.02, 0.98, 0.98]] });
    expect(layout.slots.length + layout.unplaced.length).toBe(1);
  });

  it('handles a single item', () => {
    const layout = computeLayout({ boxes: [[0.4, 0.4, 0.6, 0.6]] });
    expect(layout.slots).toHaveLength(1);
  });

  it('handles no items at all', () => {
    const layout = computeLayout({ boxes: [] });
    expect(layout.slots).toHaveLength(0);
    expect(layout.unplaced).toHaveLength(0);
  });

  it('prefers the calmer side when the energy map says one side is busy', () => {
    const w = 96;
    const h = 171;
    const grey = new Uint8Array(w * h).fill(120);
    // Make the left third visually noisy.
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w / 3; x++) grey[y * w + x] = (x + y) % 2 === 0 ? 0 : 255;
    }
    const energy = computeEnergyMap(grey, w, h);
    const layout = computeLayout({
      boxes: [[0.45, 0.45, 0.55, 0.55]],
      energy,
      // Remove the balance nudge so busyness alone decides.
      options: { balanceWeight: 0 },
    });
    expect(layout.slots[0]!.side).toBe('right');
  });
});

describe('leader lines', () => {
  it('starts on the edge of the card facing the subject', () => {
    const layout = computeLayout({ boxes: REFERENCE_BOXES });
    for (const slot of layout.slots) {
      const start = leaderLineStart(slot);
      expect(start.x).toBe(slot.side === 'left' ? slot.rect.x1 : slot.rect.x0);
      expect(start.y).toBeCloseTo((slot.rect.y0 + slot.rect.y1) / 2, 6);
    }
  });
});
