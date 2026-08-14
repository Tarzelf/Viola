import { formatItemLabel, formatPrice, type LookLayout } from '@viola/core';
import { color, type as typeScale } from '@viola/design';

/**
 * The look card.
 *
 * This is the artefact that gets screenshotted, sent to a group chat and
 * rendered as a link preview, so it carries almost all of the product's viral
 * weight. It follows the reference layout closely:
 *
 *   - the photo, full bleed
 *   - product cutouts floating in the gutters either side of the subject
 *   - ALL-CAPS wide-tracked brand over a product name
 *   - a leader line from each card to the garment it labels
 *   - one saturated pill carrying the archetype and score
 *   - a handle watermark
 *
 * Built as plain satori element trees rather than JSX so the package needs no
 * JSX runtime and stays trivially unit-testable.
 */

export interface CardItem {
  index: number;
  brand: string | null;
  title: string | null;
  subtype: string;
  priceCents: number | null;
  /** Data URI of the trimmed catalogue cutout, if we have one. */
  cutoutDataUri: string | null;
}

export interface CardInput {
  /** Data URI of the user's photo. */
  photoDataUri: string;
  items: CardItem[];
  layout: LookLayout;
  archetypeName: string;
  score: number;
  handle: string;
  width: number;
  height: number;
  /** OG cards are short and wide, so the composition changes. */
  variant: 'story' | 'og' | 'square';
}

type Node = Record<string, unknown>;

const el = (type: string, props: Record<string, unknown>, children?: unknown): Node => ({
  type,
  props: children === undefined ? props : { ...props, children },
});

const px = (n: number) => `${n}px`;

/**
 * Caps a label so it cannot overflow its slot.
 *
 * Retailer titles run long ("Structured Leather Tote Bag, Black"), and a label
 * that wraps to three lines or spills past the card edge undoes the precision
 * the rest of the layout is working for. The reference labels are all short —
 * "HOKA SKYWARD X BLUE" — so this matches that discipline. Breaks on a word
 * boundary where possible rather than mid-word.
 */
export function truncate(value: string, max: number): string {
  if (value.length <= max) return value;
  const clipped = value.slice(0, max - 1);
  const lastSpace = clipped.lastIndexOf(' ');
  const base = lastSpace > max * 0.55 ? clipped.slice(0, lastSpace) : clipped.trimEnd();
  return `${base}…`;
}

// ---------------------------------------------------------------------------

/** Cutout, label and leader line for a single garment. */
function itemCard(item: CardItem, slot: LookLayout['slots'][number], W: number, H: number): Node[] {
  const x = slot.rect.x0 * W;
  const y = slot.rect.y0 * H;
  const w = (slot.rect.x1 - slot.rect.x0) * W;
  const h = (slot.rect.y1 - slot.rect.y0) * H;

  const raw = formatItemLabel(item);
  const label = { brand: truncate(raw.brand, 18), name: truncate(raw.name, 26) };
  const nodes: Node[] = [];

  // --- leader line to the garment -----------------------------------------
  // Drawn as a thin absolutely-positioned block rather than an SVG line:
  // satori has no line primitive, and a 1px div is crisper at these sizes.
  const startX = slot.side === 'left' ? slot.rect.x1 : slot.rect.x0;
  const anchorX = slot.anchor.x;
  const lineY = (slot.rect.y0 + slot.rect.y1) / 2;
  const lineLeft = Math.min(startX, anchorX) * W;
  const lineWidth = Math.abs(anchorX - startX) * W;

  if (lineWidth > 4) {
    nodes.push(
      el('div', {
        style: {
          position: 'absolute',
          left: px(lineLeft),
          top: px(lineY * H),
          width: px(lineWidth),
          height: '1px',
          // Matched to the web card after visual QA found the original too
          // faint to trace against a busy photograph.
          backgroundColor: 'rgba(255,255,255,0.55)',
        },
      }),
    );
  }

  // Dot on the garment itself.
  const dot = Math.max(5, W * 0.006);
  nodes.push(
    el('div', {
      style: {
        position: 'absolute',
        left: px(slot.anchor.x * W - dot / 2),
        top: px(slot.anchor.y * H - dot / 2),
        width: px(dot),
        height: px(dot),
        borderRadius: px(dot),
        backgroundColor: color.viola,
      },
    }),
  );

  // --- the cutout -----------------------------------------------------------
  const cutoutSize = Math.min(w, h * 0.62);
  if (item.cutoutDataUri) {
    nodes.push(
      el('img', {
        src: item.cutoutDataUri,
        width: Math.round(cutoutSize),
        height: Math.round(cutoutSize),
        style: {
          position: 'absolute',
          left: px(x + (w - cutoutSize) / 2),
          top: px(y),
          objectFit: 'contain',
        },
      }),
    );
  }

  // --- the label ------------------------------------------------------------
  // The wide tracking and small caps are the single strongest reason the
  // reference reads as expensive rather than as a debug overlay.
  const labelTop = y + (item.cutoutDataUri ? cutoutSize + h * 0.04 : h * 0.2);
  const labelChildren: Node[] = [];

  if (label.brand) {
    labelChildren.push(
      el(
        'div',
        {
          style: {
            fontFamily: 'Geist Sans',
            fontSize: px(Math.round(W * 0.0165)),
            fontWeight: 700,
            letterSpacing: px(Math.round(W * 0.0028)),
            color: '#ffffff',
            textAlign: 'center',
          },
        },
        label.brand,
      ),
    );
  }

  labelChildren.push(
    el(
      'div',
      {
        style: {
          fontFamily: 'Geist Sans',
          fontSize: px(Math.round(W * 0.0145)),
          fontWeight: 500,
          letterSpacing: px(Math.round(W * 0.0019)),
          color: 'rgba(255,255,255,0.78)',
          textAlign: 'center',
          marginTop: '2px',
        },
      },
      label.name,
    ),
  );

  if (item.priceCents != null) {
    labelChildren.push(
      el(
        'div',
        {
          style: {
            fontFamily: 'Geist Mono',
            fontSize: px(Math.round(W * 0.0135)),
            fontWeight: 600,
            color: 'rgba(255,255,255,0.55)',
            marginTop: '4px',
          },
        },
        formatPrice(item.priceCents),
      ),
    );
  }

  nodes.push(
    el('div', {
      style: {
        position: 'absolute',
        left: px(x),
        top: px(labelTop),
        width: px(w),
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      },
      children: labelChildren,
    }),
  );

  return nodes;
}

// ---------------------------------------------------------------------------

export function buildCard(input: CardInput): Node {
  const { width: W, height: H } = input;
  const children: Node[] = [];

  // --- photo ---------------------------------------------------------------
  children.push(
    el('img', {
      src: input.photoDataUri,
      width: W,
      height: H,
      style: { position: 'absolute', left: 0, top: 0, objectFit: 'cover' },
    }),
  );

  // A light scrim so white labels stay legible over any photo. Deliberately
  // subtle — heavier and the photo stops looking like a photo.
  children.push(
    el('div', {
      style: {
        position: 'absolute',
        left: 0,
        top: 0,
        width: px(W),
        height: px(H),
        backgroundColor: color.scrim,
      },
    }),
  );

  // Foot gradient, so the score pill and watermark always have contrast.
  children.push(
    el('div', {
      style: {
        position: 'absolute',
        left: 0,
        top: px(H * 0.62),
        width: px(W),
        height: px(H * 0.38),
        backgroundImage: `linear-gradient(180deg, rgba(11,10,15,0) 0%, rgba(11,10,15,0.86) 100%)`,
      },
    }),
  );

  // --- item cards ----------------------------------------------------------
  for (const slot of input.layout.slots) {
    const item = input.items.find((i) => i.index === slot.itemIndex);
    if (!item) continue;
    children.push(...itemCard(item, slot, W, H));
  }

  // --- score pill ----------------------------------------------------------
  // The archetype leads and the number follows. That ordering is the whole
  // anti-comparison thesis: a name invites identity, a number invites ranking.
  const pillFont = Math.round(W * 0.032);
  const pillPadY = Math.round(W * 0.022);
  const pillPadX = Math.round(W * 0.042);
  const pillBottom = input.variant === 'og' ? H * 0.12 : H * 0.11;

  children.push(
    el('div', {
      style: {
        position: 'absolute',
        left: 0,
        top: px(H - pillBottom - pillFont - pillPadY * 2),
        width: px(W),
        display: 'flex',
        justifyContent: 'center',
      },
      children: el(
        'div',
        {
          style: {
            display: 'flex',
            alignItems: 'center',
            backgroundColor: color.viola,
            borderRadius: '999px',
            paddingTop: px(pillPadY),
            paddingBottom: px(pillPadY),
            paddingLeft: px(pillPadX),
            paddingRight: px(pillPadX),
          },
          children: [
            el(
              'div',
              {
                style: {
                  fontFamily: 'Instrument Serif',
                  fontSize: px(pillFont),
                  color: '#ffffff',
                  lineHeight: 1,
                },
              },
              input.archetypeName,
            ),
            el(
              'div',
              {
                style: {
                  fontFamily: 'Geist Mono',
                  fontSize: px(Math.round(pillFont * 0.86)),
                  fontWeight: 600,
                  color: 'rgba(255,255,255,0.72)',
                  marginLeft: px(Math.round(W * 0.016)),
                  lineHeight: 1,
                },
              },
              String(input.score),
            ),
          ],
        },
        undefined,
      ),
    }),
  );

  // --- watermark -----------------------------------------------------------
  // Every exported card carries the handle. This is the cheapest viral surface
  // there is: screenshots travel far beyond the app, and without it they are
  // untraceable.
  children.push(
    el('div', {
      style: {
        position: 'absolute',
        left: 0,
        top: px(H - H * 0.048),
        width: px(W),
        display: 'flex',
        justifyContent: 'center',
        fontFamily: 'Geist Sans',
        fontSize: px(Math.round(W * 0.017)),
        fontWeight: 500,
        letterSpacing: px(Math.round(W * 0.0014)),
        color: 'rgba(255,255,255,0.5)',
      },
      children: `viola.app/@${input.handle}`,
    }),
  );

  return el('div', {
    style: {
      position: 'relative',
      width: px(W),
      height: px(H),
      display: 'flex',
      backgroundColor: color.ink,
      fontFamily: 'Geist Sans',
    },
    children,
  });
}

/** Exposed for tests that assert type-scale parity with the design tokens. */
export const CARD_TYPE_REFERENCE = typeScale;
