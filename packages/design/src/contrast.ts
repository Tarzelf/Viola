/**
 * Contrast maths.
 *
 * A design review flagged the footer text as hard to read, so rather than
 * nudging the colour until it looked better, this measures it. Most of the
 * secondary and tertiary text in the product is translucent white over the near
 * black canvas, and translucency makes contrast very easy to get wrong by eye —
 * the colour looks fine in isolation and fails once composited.
 */

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

export function parseColor(value: string): { rgb: Rgb; alpha: number } {
  const hex = value.trim().match(/^#([0-9a-f]{6})$/i);
  if (hex) {
    const n = parseInt(hex[1]!, 16);
    return { rgb: { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }, alpha: 1 };
  }

  const rgba = value.trim().match(/^rgba?\(([^)]+)\)$/i);
  if (rgba) {
    const parts = rgba[1]!.split(',').map((p) => Number.parseFloat(p.trim()));
    return {
      rgb: { r: parts[0] ?? 0, g: parts[1] ?? 0, b: parts[2] ?? 0 },
      alpha: parts[3] ?? 1,
    };
  }

  throw new Error(`unsupported colour: ${value}`);
}

/** Flattens a translucent foreground onto an opaque background. */
export function composite(foreground: string, background: string): Rgb {
  const fg = parseColor(foreground);
  const bg = parseColor(background);

  return {
    r: fg.rgb.r * fg.alpha + bg.rgb.r * (1 - fg.alpha),
    g: fg.rgb.g * fg.alpha + bg.rgb.g * (1 - fg.alpha),
    b: fg.rgb.b * fg.alpha + bg.rgb.b * (1 - fg.alpha),
  };
}

/** WCAG relative luminance. */
export function luminance({ r, g, b }: Rgb): number {
  const channel = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** WCAG contrast ratio between a (possibly translucent) foreground and a background. */
export function contrastRatio(foreground: string, background: string): number {
  const fg = luminance(composite(foreground, background));
  const bg = luminance(parseColor(background).rgb);

  const lighter = Math.max(fg, bg);
  const darker = Math.min(fg, bg);
  return (lighter + 0.05) / (darker + 0.05);
}

/** WCAG AA: 4.5:1 for body text, 3:1 for large text (>=18.66px bold or 24px). */
export const AA_NORMAL = 4.5;
export const AA_LARGE = 3;
