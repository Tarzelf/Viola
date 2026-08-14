/**
 * Item label formatting.
 *
 * The reference layout shows each product as two lines: the brand in wide-
 * tracked caps, then the product name beneath it. Retailer titles almost always
 * repeat the brand ("adidas Samba OG Shoes"), so rendering brand + title
 * verbatim produces "ADIDAS / ADIDAS SAMBA OG SHOES", which looks careless on
 * an otherwise precise card.
 *
 * This strips the redundancy and trims the retailer boilerplate that clutters
 * marketplace titles.
 */

/** Words retailers append that add nothing on a look card. */
const NOISE = [
  "women's",
  'womens',
  "men's",
  'mens',
  'unisex',
  'shoes',
  'shoe',
  'sneakers',
  't-shirt',
  'tshirt',
  'for women',
  'for men',
];

export interface ItemLabel {
  /** Wide-tracked caps, top line. Empty when no brand was identified. */
  brand: string;
  /** Product name, second line. */
  name: string;
}

function titleCaseFold(value: string): string {
  return (
    value
      .toLowerCase()
      // Apostrophes are removed rather than turned into spaces, so "Levi's"
      // folds to one token ("levis") instead of two ("levi", "s") — otherwise
      // the brand-word count is wrong and the prefix never matches.
      .replace(/['\u2018\u2019\u02bc]/g, '')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim()
  );
}

export function formatItemLabel(input: {
  brand?: string | null;
  title?: string | null;
  subtype: string;
}): ItemLabel {
  const brand = input.brand?.trim() ?? '';
  const rawTitle = input.title?.trim() ?? '';

  // With no title we fall back to the garment type, which always reads
  // sensibly: "CROPPED HOODIE", "WIDE-LEG TROUSER".
  if (!rawTitle) {
    return { brand: brand.toUpperCase(), name: input.subtype.toUpperCase() };
  }

  let name = rawTitle;

  if (brand) {
    // Remove the brand from the start of the title, however it is punctuated.
    const foldedBrand = titleCaseFold(brand);
    const words = name.split(/\s+/);
    const brandWordCount = foldedBrand.split(' ').length;
    const leading = titleCaseFold(words.slice(0, brandWordCount).join(' '));
    if (leading === foldedBrand) {
      name = words.slice(brandWordCount).join(' ');
    }
  }

  // Strip trailing retailer noise, longest phrases first.
  for (const noise of [...NOISE].sort((a, b) => b.length - a.length)) {
    const pattern = new RegExp(`\\b${noise.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
    name = name.replace(pattern, ' ');
  }

  name = name
    .replace(/[\s,–—-]+$/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

  // If stripping left nothing meaningful, prefer the garment type over an
  // empty line.
  if (name.length < 2) name = input.subtype;

  return { brand: brand.toUpperCase(), name: name.toUpperCase() };
}

/** Single-line variant, for the item rail and share text. */
export function formatItemLine(input: {
  brand?: string | null;
  title?: string | null;
  subtype: string;
}): string {
  const label = formatItemLabel(input);
  return [label.brand, label.name].filter(Boolean).join(' ');
}

/**
 * Caps a label so it cannot overflow its slot.
 *
 * Shared by the web card, the native card and the server-side renderer — the
 * same product name has to break identically in all three, or a share card
 * stops matching the app it came from.
 *
 * Breaks on a word boundary where possible. A hard character cut is the
 * fallback, but it is genuinely worse: React Native will happily split a long
 * word across two lines as "STRUCTUR" / "ED…", which reads as a rendering
 * fault rather than as deliberate truncation.
 */
export function truncateLabel(value: string, max: number): string {
  if (value.length <= max) return value;

  const clipped = value.slice(0, max - 1);
  const lastSpace = clipped.lastIndexOf(' ');
  const base = lastSpace > max * 0.55 ? clipped.slice(0, lastSpace) : clipped.trimEnd();
  return `${base}\u2026`;
}

/**
 * How many characters fit a label slot.
 *
 * The annotation boxes are narrow — roughly a quarter of the frame — and the
 * signature ALL-CAPS treatment carries wide letter-spacing, so far less text
 * fits than the raw pixel width suggests. Deriving the cap from the slot width
 * keeps a phone and a 1080px share card from disagreeing about where a name
 * should stop.
 */
export function labelCharBudget(slotWidthPx: number): number {
  // ~8px per character at 11-12px with 2-3px tracking, measured against the
  // rendered cards rather than computed from font metrics.
  return Math.max(6, Math.floor(slotWidthPx / 8));
}

/**
 * Fits a label into a fixed number of lines of a given width.
 *
 * `truncateLabel` alone is not sufficient, and the reason is worth recording
 * because it took two attempts to see it: capping the *total* length does
 * nothing when a single word is wider than the line. "STRUCTURED LEATHER TOTE"
 * shortened to 20 characters still begins with a ten-character word, and a
 * narrow gutter will happily wrap that as "STRUCTUR" / "ED…" — which reads as
 * a rendering fault rather than as deliberate truncation.
 *
 * So any word longer than one line is hard-cut first, then the remainder is
 * wrapped greedily and elided if it overflows the line count.
 */
export function fitLabel(value: string, charsPerLine: number, maxLines = 2): string {
  if (charsPerLine <= 1) return '\u2026';

  const words = value.split(/\s+/).filter(Boolean);
  if (words.length === 0) return '';

  // No word may be wider than a line.
  const fitted = words.map((word) =>
    word.length > charsPerLine ? `${word.slice(0, charsPerLine - 1)}\u2026` : word,
  );

  const lines: string[] = [];
  let current = '';

  for (const word of fitted) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= charsPerLine) {
      current = candidate;
      continue;
    }
    if (current) lines.push(current);
    current = word;
    if (lines.length === maxLines) break;
  }
  if (current && lines.length < maxLines) lines.push(current);

  const kept = lines.slice(0, maxLines);
  const overflowed = kept.join(' ').length < fitted.join(' ').length;

  if (!overflowed) return kept.join(' ');

  const last = kept[kept.length - 1] ?? '';
  if (last.endsWith('\u2026')) return kept.join(' ');

  // The ellipsis counts against the line budget too. Appending it blindly is
  // how a "never wider than a line" guarantee quietly becomes false.
  const room = last.length + 1 > charsPerLine ? charsPerLine - 1 : last.length;
  kept[kept.length - 1] = `${last.slice(0, room).replace(/[\s,]+$/, '')}\u2026`;

  return kept.join(' ');
}
