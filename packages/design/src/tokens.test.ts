import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { buildCssVars, renderThemeCss } from './css.js';
import { buildTextStyles, revealDelay, spring, textStyle } from './native.js';
import { color, gradient, motion, radius, shadow, type } from './tokens.js';

const here = dirname(fileURLToPath(import.meta.url));

describe('theme.css generation', () => {
  it('committed theme.css matches the tokens', () => {
    const committed = readFileSync(join(here, 'theme.css'), 'utf8');
    expect(committed).toBe(renderThemeCss());
  });

  it('exposes every colour token as a CSS variable', () => {
    const vars = buildCssVars();
    for (const key of Object.keys(color)) {
      const kebab = key.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
      expect(vars).toHaveProperty(`--color-${kebab}`);
    }
  });

  it('emits size, line-height, weight and tracking for every type token', () => {
    const vars = buildCssVars();
    for (const key of Object.keys(type)) {
      const kebab = key.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
      expect(vars[`--text-${kebab}`]).toBeDefined();
      expect(vars[`--text-${kebab}--line-height`]).toBeDefined();
      expect(vars[`--text-${kebab}--font-weight`]).toBeDefined();
      expect(vars[`--text-${kebab}--letter-spacing`]).toBeDefined();
    }
  });
});

describe('native token bridge', () => {
  it('resolves a type token to a React Native text style', () => {
    expect(textStyle('itemLabel')).toEqual({
      fontFamily: 'Geist Sans',
      fontSize: 12,
      lineHeight: 15,
      fontWeight: '700',
      letterSpacing: 3,
    });
  });

  it('builds a style for every type token', () => {
    const styles = buildTextStyles();
    expect(Object.keys(styles).sort()).toEqual(Object.keys(type).sort());
  });

  it('exposes spring configs for Reanimated', () => {
    expect(spring('bouncy')).toEqual({ stiffness: 260, damping: 16, mass: 0.9 });
  });

  it('staggers the reveal', () => {
    expect(revealDelay(0)).toBe(0);
    expect(revealDelay(3)).toBe(3 * motion.stagger);
  });
});

/**
 * Brand guardrails. These encode the design decisions that are easy to erode
 * one careless commit at a time, which is exactly how a premium UI turns
 * cluttered. Breaking one of these should require deleting a test on purpose.
 */
describe('brand guardrails', () => {
  it('keeps exactly one saturated accent', () => {
    expect(color.viola).toBe('#7C5CFC');
  });

  it('confines orchid and blush to gradients, never to chrome', () => {
    const chrome = [
      color.ink,
      color.surface,
      color.surfaceRaised,
      color.paper,
      color.textPrimary,
      color.textSecondary,
      color.textTertiary,
      color.hairline,
      color.hairlineStrong,
    ];
    expect(chrome).not.toContain(color.orchid);
    expect(chrome).not.toContain(color.blush);

    const inGradients = Object.values(gradient).flatMap((stops) => [...stops]);
    expect(inGradients).toContain(color.orchid);
    expect(inGradients).toContain(color.blush);
  });

  it('reserves gold for Top of the Week alone', () => {
    const others = Object.entries(color)
      .filter(([k]) => k !== 'gold')
      .map(([, v]) => v);
    expect(others).not.toContain(color.gold);
  });

  it('uses violet glows rather than grey drop shadows', () => {
    // A grey shadow on a near-black canvas reads as dirt, not as light. Every
    // shadow that carries colour must carry the accent's RGB, not neutral grey.
    const violaRgb = '124, 92, 252';
    const coloured = Object.entries(shadow).filter(
      ([key, value]) => key !== 'none' && key !== 'lift' && value.includes('rgba'),
    );
    expect(coloured.length).toBeGreaterThan(0);
    for (const [, value] of coloured) {
      expect(value).toContain(violaRgb);
    }
    // `lift` is the one exception: it is depth under a sheet, not light.
    expect(shadow.lift).toContain('11, 10, 15');
  });

  it('has no sharp corners except the explicit none', () => {
    const values = Object.entries(radius)
      .filter(([k]) => k !== 'none')
      .map(([, v]) => v);
    expect(values.every((v) => v >= 10)).toBe(true);
  });

  it('keeps the item label ALL-CAPS-wide — the signature of the reference layout', () => {
    expect(type.itemLabel.tracking).toBeGreaterThanOrEqual(3);
    expect(type.itemLabel.size).toBeLessThanOrEqual(13);
    expect(type.itemLabel.weight).toBe('700');
  });

  it('offers springs, and only bezier approximations of them for CSS', () => {
    expect(Object.keys(motion.spring)).toEqual(['gentle', 'bouncy', 'stiff']);
    for (const value of Object.values(motion.easing)) {
      expect(value.startsWith('cubic-bezier(')).toBe(true);
    }
  });
});
