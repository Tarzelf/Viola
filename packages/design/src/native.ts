import { type TypeToken, motion, type } from './tokens.js';

/**
 * Native-side consumption of the tokens.
 *
 * We deliberately do NOT use NativeWind. Pinning it against Expo 57 / RN 0.86
 * is avoidable risk, and sharing *tokens* rather than *class names* guarantees
 * the two platforms render identical brand values anyway. If NativeWind becomes
 * compelling later it can sit on top of this without changing the token source.
 */

export interface NativeTextStyle {
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  fontWeight: '400' | '500' | '600' | '700';
  letterSpacing: number;
}

/** Turns a type token into a React Native text style object. */
export function textStyle(token: TypeToken): NativeTextStyle {
  const t = type[token];
  return {
    fontFamily: t.family,
    fontSize: t.size,
    lineHeight: t.lineHeight,
    fontWeight: t.weight as NativeTextStyle['fontWeight'],
    letterSpacing: t.tracking,
  };
}

/** All type tokens pre-resolved, for spreading into a StyleSheet.create call. */
export function buildTextStyles(): Record<TypeToken, NativeTextStyle> {
  const out = {} as Record<TypeToken, NativeTextStyle>;
  for (const key of Object.keys(type) as TypeToken[]) {
    out[key] = textStyle(key);
  }
  return out;
}

export type SpringName = keyof typeof motion.spring;

/** Reanimated `withSpring` config for a named spring. */
export function spring(name: SpringName) {
  const s = motion.spring[name];
  return { stiffness: s.stiffness, damping: s.damping, mass: s.mass };
}

/**
 * Delay for the nth item in the reveal choreography. The stagger is what makes
 * the Voilà feel like a reveal instead of a page load.
 */
export function revealDelay(index: number): number {
  return index * motion.stagger;
}
