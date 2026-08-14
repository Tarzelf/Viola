import type { BBox, LayoutSlot, LookLayout, Rect } from '@viola/core';

/**
 * The layout engine — where product cards get placed around the person.
 *
 * This entire module runs locally. No network, no ML model, no GPU. It is the
 * part that makes a look card resemble the annotated flat-lay reference, and it
 * costs nothing per look. Measured at roughly 10ms for the analysis raster plus
 * a few ms of placement search.
 *
 * ---------------------------------------------------------------------------
 * WHY THE SUBJECT BAND COMES FROM BOUNDING BOXES
 *
 * The first implementation detected the person by summing Sobel edge energy per
 * column and taking the contiguous run around the peak. It failed, and it is
 * worth recording why so nobody rebuilds it: edge energy peaks at the
 * *silhouette boundary*, not across the body. A flat dark torso has almost no
 * internal gradient, so the detector locked onto one shoulder edge and returned
 * a band of 0.427–0.510 for a person who actually spanned 0.313–0.487.
 *
 * The vision stage already returns a bounding box per garment, and those boxes
 * collectively *are* the person. Their union, dilated slightly, gave 0.290–0.530
 * against the same ground truth — accurate enough, already paid for, and with
 * no extra dependency.
 *
 * The energy map still earns its place: it decides which slot within a gutter
 * is calmest, so a card never lands on a cluttered patch of background.
 * ---------------------------------------------------------------------------
 */

export interface EnergyMap {
  width: number;
  height: number;
  /** Per-pixel Sobel gradient magnitude, row-major. */
  data: Float64Array;
}

export interface LayoutOptions {
  /** Normalised slot size. Defaults suit a 4:5 portrait card. */
  slotWidth: number;
  slotHeight: number;
  /** Keep-out margin from the image edges. */
  padding: number;
  /** How far the subject band is expanded beyond the garment boxes. */
  subjectDilation: number;
  /** A gutter narrower than this cannot hold a card. */
  minGutterWidth: number;
  /** Cost weight pulling a card toward its garment's vertical position. */
  driftWeight: number;
  /** Cost weight encouraging cards to alternate sides. */
  balanceWeight: number;
  /** Vertical offsets tried, in order, when searching for a free slot. */
  offsets: readonly number[];
  /**
   * Fraction of the frame reserved at the bottom for the score pill and the
   * handle watermark. Without this, a card placed low collides with the pill —
   * which is the one element on the card that must always be legible.
   */
  bottomSafeZone: number;
  /** Reserved at the top for the subject's head and any app chrome. */
  topSafeZone: number;
}

export const DEFAULT_LAYOUT_OPTIONS: LayoutOptions = {
  slotWidth: 0.26,
  slotHeight: 0.15,
  padding: 0.02,
  subjectDilation: 0.03,
  minGutterWidth: 0.14,
  driftWeight: 220,
  balanceWeight: 9,
  offsets: [0, -0.05, 0.05, -0.1, 0.1, -0.16, 0.16, -0.22, 0.22],
  bottomSafeZone: 0.18,
  topSafeZone: 0.04,
};

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

// ---------------------------------------------------------------------------
// Subject band
// ---------------------------------------------------------------------------

export interface SubjectBand {
  x0: number;
  x1: number;
}

/**
 * The horizontal span the person occupies, so nothing is ever placed on top of
 * her. Union of the garment boxes, dilated.
 */
export function subjectBandFromBoxes(
  boxes: readonly BBox[],
  dilation = DEFAULT_LAYOUT_OPTIONS.subjectDilation,
): SubjectBand {
  if (boxes.length === 0) {
    // No garments detected: assume a centred subject rather than covering her.
    return { x0: 0.3, x1: 0.7 };
  }
  let x0 = 1;
  let x1 = 0;
  for (const b of boxes) {
    if (b[0] < x0) x0 = b[0];
    if (b[2] > x1) x1 = b[2];
  }
  return { x0: clamp(x0 - dilation, 0, 1), x1: clamp(x1 + dilation, 0, 1) };
}

// ---------------------------------------------------------------------------
// Energy map
// ---------------------------------------------------------------------------

/**
 * Sobel gradient magnitude over a greyscale raster.
 *
 * The raster is tiny on purpose — 96×171 is plenty to tell a blank wall from a
 * cluttered shopfront, and it keeps the whole pass in the sub-10ms range.
 */
export function computeEnergyMap(grey: Uint8Array, width: number, height: number): EnergyMap {
  const data = new Float64Array(width * height);
  const at = (x: number, y: number) => grey[y * width + x]!;

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const gx =
        -at(x - 1, y - 1) -
        2 * at(x - 1, y) -
        at(x - 1, y + 1) +
        at(x + 1, y - 1) +
        2 * at(x + 1, y) +
        at(x + 1, y + 1);
      const gy =
        -at(x - 1, y - 1) -
        2 * at(x, y - 1) -
        at(x + 1, y - 1) +
        at(x - 1, y + 1) +
        2 * at(x, y + 1) +
        at(x + 1, y + 1);
      data[y * width + x] = Math.hypot(gx, gy);
    }
  }

  return { width, height, data };
}

/** Mean energy inside a normalised rect. Lower is a calmer place for a card. */
export function busyness(map: EnergyMap, rect: Rect): number {
  const xa = Math.max(0, Math.floor(rect.x0 * map.width));
  const xb = Math.min(map.width, Math.ceil(rect.x1 * map.width));
  const ya = Math.max(0, Math.floor(rect.y0 * map.height));
  const yb = Math.min(map.height, Math.ceil(rect.y1 * map.height));

  let sum = 0;
  let n = 0;
  for (let y = ya; y < yb; y++) {
    for (let x = xa; x < xb; x++) {
      sum += map.data[y * map.width + x]!;
      n++;
    }
  }
  return n > 0 ? sum / n : Number.POSITIVE_INFINITY;
}

/** A flat map, for when no photo analysis is available. */
export function flatEnergyMap(width = 96, height = 171): EnergyMap {
  return { width, height, data: new Float64Array(width * height) };
}

// ---------------------------------------------------------------------------
// Gutters
// ---------------------------------------------------------------------------

export interface Gutter {
  side: 'left' | 'right';
  x0: number;
  x1: number;
  width: number;
}

export function guttersFor(subject: SubjectBand, options: LayoutOptions): Gutter[] {
  return (
    [
      { side: 'left' as const, x0: 0, x1: subject.x0 },
      { side: 'right' as const, x0: subject.x1, x1: 1 },
    ]
      .map((g) => ({ ...g, width: g.x1 - g.x0 }))
      // A gutter too narrow to hold a card is not a gutter.
      .filter((g) => g.width >= options.minGutterWidth)
  );
}

const overlaps = (a: Rect, b: Rect) =>
  !(a.x1 <= b.x0 || a.x0 >= b.x1 || a.y1 <= b.y0 || a.y0 >= b.y1);

// ---------------------------------------------------------------------------
// Placement
// ---------------------------------------------------------------------------

export interface PlacementInput {
  boxes: readonly BBox[];
  energy?: EnergyMap;
  options?: Partial<LayoutOptions>;
}

/**
 * Places one card per garment.
 *
 * Cards are laid out in vertical order so the result reads top-to-bottom like
 * the reference. For each garment we try the vertical offsets in order and pick
 * the lowest-cost non-overlapping slot, where cost balances three things:
 *
 *   busyness   — sit on a calm patch of background
 *   drift      — stay level with the garment being labelled
 *   balance    — alternate sides so cards flank the subject rather than
 *                stacking down one edge
 *
 * A garment that cannot be placed without collision is returned in `unplaced`
 * and rendered in the item rail instead. Dropping it from the card is always
 * better than overlapping something.
 */
export function computeLayout({ boxes, energy, options }: PlacementInput): LookLayout {
  const opts: LayoutOptions = { ...DEFAULT_LAYOUT_OPTIONS, ...options };
  const map = energy ?? flatEnergyMap();
  const subject = subjectBandFromBoxes(boxes, opts.subjectDilation);
  const gutters = gutterList(subject, opts);

  const order = boxes
    .map((bbox, itemIndex) => ({ bbox, itemIndex, yCentre: (bbox[1] + bbox[3]) / 2 }))
    .sort((a, b) => a.yCentre - b.yCentre || a.itemIndex - b.itemIndex);

  const placed: Rect[] = [];
  const slots: LayoutSlot[] = [];
  const unplaced: number[] = [];
  const used: Record<'left' | 'right', number> = { left: 0, right: 0 };

  for (const entry of order) {
    let best: { rect: Rect; side: 'left' | 'right'; cost: number } | null = null;

    for (const gutter of gutters) {
      const width = Math.min(opts.slotWidth, gutter.width - opts.padding * 2);
      if (width < 0.12) continue;

      const x0 =
        gutter.side === 'left'
          ? Math.max(opts.padding, gutter.x1 - opts.padding - width)
          : Math.min(1 - opts.padding - width, gutter.x0 + opts.padding);

      const minY = Math.max(opts.padding, opts.topSafeZone);
      const maxY = 1 - opts.bottomSafeZone - opts.slotHeight;

      for (const dy of opts.offsets) {
        // A garment low in the frame (shoes, almost always) still gets a card,
        // but the card is lifted clear of the score pill rather than sitting
        // on top of it.
        if (maxY < minY) continue;
        const y0 = clamp(entry.yCentre - opts.slotHeight / 2 + dy, minY, maxY);
        const rect: Rect = { x0, y0, x1: x0 + width, y1: y0 + opts.slotHeight };

        if (placed.some((p) => overlaps(rect, p))) continue;

        const cost =
          busyness(map, rect) +
          Math.abs(dy) * opts.driftWeight +
          used[gutter.side] * opts.balanceWeight;

        if (!best || cost < best.cost) best = { rect, side: gutter.side, cost };
      }
    }

    if (best) {
      placed.push(best.rect);
      used[best.side]++;
      slots.push({
        itemIndex: entry.itemIndex,
        side: best.side,
        rect: best.rect,
        anchor: {
          x: (entry.bbox[0] + entry.bbox[2]) / 2,
          y: (entry.bbox[1] + entry.bbox[3]) / 2,
        },
      });
    } else {
      unplaced.push(entry.itemIndex);
    }
  }

  slots.sort((a, b) => a.itemIndex - b.itemIndex);
  unplaced.sort((a, b) => a - b);

  return { subject, slots, unplaced };
}

function gutterList(subject: SubjectBand, opts: LayoutOptions): Gutter[] {
  const gutters = guttersFor(subject, opts);
  if (gutters.length > 0) return gutters;

  // The subject fills the frame. Rather than give up, fall back to narrow
  // strips at both edges — a slightly overlapping card beats no card at all
  // when the alternative is an unannotated photo.
  return [
    { side: 'left', x0: 0, x1: opts.minGutterWidth, width: opts.minGutterWidth },
    { side: 'right', x0: 1 - opts.minGutterWidth, x1: 1, width: opts.minGutterWidth },
  ];
}

/** Where the leader line meets the card. */
export function leaderLineStart(slot: LayoutSlot): { x: number; y: number } {
  const midY = (slot.rect.y0 + slot.rect.y1) / 2;
  return { x: slot.side === 'left' ? slot.rect.x1 : slot.rect.x0, y: midY };
}
