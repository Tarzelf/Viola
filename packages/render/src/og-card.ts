import { formatItemLabel, formatPrice } from '@viola/core';
import { color } from '@viola/design';
import { truncate } from './card';
import type { CardItem } from './card';

/**
 * The link-preview card.
 *
 * This is a *different composition* from the story card, on purpose.
 *
 * The first attempt reused the annotated overlay and simply rendered it at
 * 1200x630. It failed for two reasons that only became obvious once rendered:
 * cover-fitting a portrait mirror selfie into a landscape frame crops everything
 * below the shoulders, and the layout slots are normalised against the portrait
 * frame, so every leader line ends up pointing somewhere meaningless.
 *
 * More importantly, a link preview is consumed small — a thumbnail in a
 * message thread, glanced at for well under a second. Faithfully miniaturising
 * the story card optimises for the wrong thing. So this is a split composition:
 * the photo on the left, and a legible summary panel on the right carrying the
 * archetype, the score and the pieces. It reads at thumbnail size, which is the
 * only size that matters here.
 */

type Node = Record<string, unknown>;

const el = (type: string, props: Record<string, unknown>, children?: unknown): Node => ({
  type,
  props: children === undefined ? props : { ...props, children },
});

const px = (n: number) => `${n}px`;

export interface OgCardInput {
  photoDataUri: string;
  items: CardItem[];
  archetypeName: string;
  score: number;
  handle: string;
  width: number;
  height: number;
  /** Optional context line, e.g. "Maya wants you to rate this fit". */
  eyebrow?: string;
}

/** Three rows is what fits without crowding at preview size. */
const MAX_ROWS = 3;

function itemRow(item: CardItem, size: number, W: number): Node {
  const label = formatItemLabel(item);
  const cells: Node[] = [];

  cells.push(
    el('div', {
      style: {
        display: 'flex',
        width: px(size),
        height: px(size),
        borderRadius: px(Math.round(size * 0.28)),
        backgroundColor: 'rgba(255,255,255,0.06)',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: px(Math.round(W * 0.014)),
      },
      children: item.cutoutDataUri
        ? el('img', {
            src: item.cutoutDataUri,
            width: Math.round(size * 0.78),
            height: Math.round(size * 0.78),
            style: { objectFit: 'contain' },
          })
        : el('div', {
            style: {
              width: px(Math.round(size * 0.3)),
              height: px(Math.round(size * 0.3)),
              borderRadius: '999px',
              backgroundColor: 'rgba(255,255,255,0.14)',
            },
          }),
    }),
  );

  const text: Node[] = [];
  if (label.brand) {
    text.push(
      el(
        'div',
        {
          style: {
            fontFamily: 'Geist Sans',
            fontSize: px(Math.round(W * 0.0155)),
            fontWeight: 700,
            letterSpacing: px(Math.round(W * 0.0025)),
            color: '#ffffff',
          },
        },
        truncate(label.brand, 16),
      ),
    );
  }
  text.push(
    el(
      'div',
      {
        style: {
          fontFamily: 'Geist Sans',
          fontSize: px(Math.round(W * 0.0142)),
          fontWeight: 500,
          letterSpacing: px(Math.round(W * 0.0016)),
          color: 'rgba(255,255,255,0.66)',
          marginTop: '2px',
        },
      },
      truncate(label.name, 24),
    ),
  );

  cells.push(
    el('div', {
      style: { display: 'flex', flexDirection: 'column', flexGrow: 1 },
      children: text,
    }),
  );

  if (item.priceCents != null) {
    cells.push(
      el(
        'div',
        {
          style: {
            fontFamily: 'Geist Mono',
            fontSize: px(Math.round(W * 0.0155)),
            fontWeight: 600,
            color: 'rgba(255,255,255,0.82)',
            marginLeft: px(Math.round(W * 0.01)),
          },
        },
        formatPrice(item.priceCents),
      ),
    );
  }

  return el('div', {
    style: {
      display: 'flex',
      alignItems: 'center',
      marginBottom: px(Math.round(W * 0.014)),
    },
    children: cells,
  });
}

export function buildOgCard(input: OgCardInput): Node {
  const { width: W, height: H } = input;
  const photoWidth = Math.round(W * 0.42);
  const panelPad = Math.round(W * 0.038);
  const rowSize = Math.round(W * 0.058);

  const rows = input.items.slice(0, MAX_ROWS).map((item) => itemRow(item, rowSize, W));
  const remaining = Math.max(0, input.items.length - MAX_ROWS);

  const panelChildren: Node[] = [];

  if (input.eyebrow) {
    panelChildren.push(
      el(
        'div',
        {
          style: {
            fontFamily: 'Geist Sans',
            fontSize: px(Math.round(W * 0.0155)),
            fontWeight: 600,
            letterSpacing: px(Math.round(W * 0.002)),
            color: color.viola,
            marginBottom: px(Math.round(W * 0.012)),
          },
        },
        input.eyebrow.toUpperCase(),
      ),
    );
  }

  // The archetype is the headline, set in the display serif. This is the line
  // people read first, and the reason the card reads as fashion rather than as
  // a dashboard.
  panelChildren.push(
    el('div', {
      style: { display: 'flex', alignItems: 'baseline', marginBottom: px(Math.round(W * 0.022)) },
      children: [
        el(
          'div',
          {
            style: {
              fontFamily: 'Instrument Serif',
              fontSize: px(Math.round(W * 0.062)),
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
              fontSize: px(Math.round(W * 0.038)),
              fontWeight: 600,
              color: color.viola,
              marginLeft: px(Math.round(W * 0.016)),
              lineHeight: 1,
            },
          },
          String(input.score),
        ),
      ],
    }),
  );

  panelChildren.push(...rows);

  if (remaining > 0) {
    panelChildren.push(
      el(
        'div',
        {
          style: {
            fontFamily: 'Geist Sans',
            fontSize: px(Math.round(W * 0.014)),
            fontWeight: 500,
            color: 'rgba(255,255,255,0.42)',
            marginTop: px(Math.round(W * 0.004)),
          },
        },
        `+${remaining} more`,
      ),
    );
  }

  panelChildren.push(
    el('div', {
      style: {
        display: 'flex',
        marginTop: 'auto',
        fontFamily: 'Geist Sans',
        fontSize: px(Math.round(W * 0.0145)),
        fontWeight: 500,
        letterSpacing: px(Math.round(W * 0.0012)),
        color: 'rgba(255,255,255,0.46)',
      },
      children: `viola.app/@${input.handle}`,
    }),
  );

  return el('div', {
    style: {
      display: 'flex',
      width: px(W),
      height: px(H),
      backgroundColor: color.ink,
      fontFamily: 'Geist Sans',
    },
    children: [
      // --- photo ---------------------------------------------------------
      el('div', {
        style: { display: 'flex', position: 'relative', width: px(photoWidth), height: px(H) },
        children: [
          el('img', {
            src: input.photoDataUri,
            width: photoWidth,
            height: H,
            style: { objectFit: 'cover' },
          }),
          // Feathers the photo into the panel so the join is not a hard seam.
          el('div', {
            style: {
              position: 'absolute',
              top: 0,
              left: px(photoWidth - Math.round(W * 0.05)),
              width: px(Math.round(W * 0.05)),
              height: px(H),
              backgroundImage: `linear-gradient(90deg, rgba(11,10,15,0) 0%, ${color.ink} 100%)`,
            },
          }),
        ],
      }),
      // --- panel ---------------------------------------------------------
      el('div', {
        style: {
          display: 'flex',
          flexDirection: 'column',
          width: px(W - photoWidth),
          height: px(H),
          paddingTop: px(panelPad),
          paddingBottom: px(panelPad),
          paddingLeft: px(panelPad),
          paddingRight: px(panelPad),
        },
        children: panelChildren,
      }),
    ],
  });
}
