import { color, gradient, layout, motion, radius, shadow, space, type, font } from './tokens.js';

/**
 * Derives the CSS custom properties for the web theme directly from the TS
 * tokens, so `theme.css` can be generated rather than hand-maintained. A test
 * asserts the committed file matches this output — that's what stops the two
 * platforms drifting apart, which is the usual way a design system dies.
 */

const kebab = (s: string) => s.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();

export function buildCssVars(): Record<string, string> {
  const vars: Record<string, string> = {};

  for (const [key, value] of Object.entries(color)) {
    vars[`--color-${kebab(key)}`] = value;
  }

  for (const [key, stops] of Object.entries(gradient)) {
    vars[`--gradient-${kebab(key)}`] = `linear-gradient(180deg, ${stops.join(', ')})`;
  }

  for (const [key, value] of Object.entries(font)) {
    vars[`--font-${kebab(key)}`] = `'${value}'`;
  }

  for (const [key, value] of Object.entries(space)) {
    vars[`--spacing-${kebab(key)}`] = `${value}px`;
  }

  for (const [key, value] of Object.entries(radius)) {
    vars[`--radius-${kebab(key)}`] = `${value}px`;
  }

  for (const [key, value] of Object.entries(shadow)) {
    vars[`--shadow-${kebab(key)}`] = value;
  }

  for (const [key, value] of Object.entries(type)) {
    const k = kebab(key);
    vars[`--text-${k}`] = `${value.size}px`;
    vars[`--text-${k}--line-height`] = `${value.lineHeight}px`;
    vars[`--text-${k}--font-weight`] = value.weight;
    vars[`--text-${k}--letter-spacing`] = `${value.tracking}px`;
  }

  for (const [key, value] of Object.entries(motion.duration)) {
    vars[`--duration-${kebab(key)}`] = `${value}ms`;
  }
  for (const [key, value] of Object.entries(motion.easing)) {
    vars[`--ease-${kebab(key)}`] = value;
  }
  vars['--stagger'] = `${motion.stagger}ms`;

  for (const [key, value] of Object.entries(layout)) {
    vars[`--layout-${kebab(key)}`] =
      typeof value === 'number' && value < 10 ? `${value}` : `${value}px`;
  }

  return vars;
}

/** Renders the Tailwind v4 `@theme` block. */
export function renderThemeCss(): string {
  const vars = buildCssVars();
  const lines = Object.entries(vars).map(([k, v]) => `  ${k}: ${v};`);
  return [
    '/*',
    ' * GENERATED FILE — do not edit by hand.',
    ' * Source: packages/design/src/tokens.ts',
    ' * Regenerate: pnpm --filter @viola/design generate',
    ' */',
    '',
    '@theme {',
    ...lines,
    '}',
    '',
  ].join('\n');
}
