import { Platform } from 'react-native';
import {
  buildTextStyles,
  color,
  gradient,
  motion,
  radius,
  shadow,
  space,
  spring,
  revealDelay,
  type NativeTextStyle,
  type TypeToken,
} from '@viola/design';

/**
 * The native side of the design system.
 *
 * Tokens come straight from `@viola/design`, the same module the web app and
 * the server-side card renderer consume. That is the whole reason the shared
 * package exists: a violet that drifts between platforms, or a share card that
 * does not match the app it came from, is exactly the kind of small
 * inconsistency that makes a product feel unconsidered.
 *
 * NativeWind is deliberately not used. Sharing *tokens* rather than class names
 * guarantees identical values without pinning a styling library against a
 * specific React Native version.
 */

export const text: Record<TypeToken, NativeTextStyle> = buildTextStyles();

export const theme = {
  color,
  gradient,
  space,
  radius,
  shadow,
  motion,
} as const;

/** Font files registered at startup. Names must match the design tokens. */
export const FONTS = {
  'Instrument Serif': require('../assets/fonts/InstrumentSerif-Regular.ttf'),
  'Geist Sans': require('../assets/fonts/Geist-Regular.ttf'),
  'Geist Sans Medium': require('../assets/fonts/Geist-Medium.ttf'),
  'Geist Sans SemiBold': require('../assets/fonts/Geist-SemiBold.ttf'),
  'Geist Sans Bold': require('../assets/fonts/Geist-Bold.ttf'),
  'Geist Mono': require('../assets/fonts/GeistMono-Medium.ttf'),
} as const;

/**
 * React Native has no synthetic bolding for custom fonts on iOS — asking for
 * weight 700 on a regular face silently gives you the regular face. Each weight
 * has to be a separately registered family.
 */
export function fontFamily(family: string, weight: string): string {
  if (family !== 'Geist Sans') return family;
  switch (weight) {
    case '500':
      return 'Geist Sans Medium';
    case '600':
      return 'Geist Sans SemiBold';
    case '700':
      return 'Geist Sans Bold';
    default:
      return 'Geist Sans';
  }
}

/** Resolves a type token into a style RN will actually honour. */
export function typeStyle(token: TypeToken): NativeTextStyle {
  const base = text[token];
  return { ...base, fontFamily: fontFamily(base.fontFamily, base.fontWeight) };
}

export { spring, revealDelay };

/** iOS-only affordances, guarded so the web build does not break. */
export const isIOS = Platform.OS === 'ios';
