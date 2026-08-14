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
