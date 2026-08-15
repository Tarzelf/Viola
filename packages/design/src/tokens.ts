/**
 * Viola design tokens — "Petal & Pavement".
 *
 * The brief carried a real tension: "girly, super cute" AND "Apple / Ferrari /
 * Lululemon — premium, clean". The resolution is one rule, and every token here
 * obeys it:
 *
 *   The chrome is premium and restrained. The delight lives in motion, copy and
 *   one saturated accent — never in clutter.
 *
 * So: near-black canvas, generous space, hairline borders, precise type, a
 * single violet. The cute arrives through spring animation, the bloom burst and
 * the archetype names.
 *
 * This file is the single source of truth for BOTH platforms. Web consumes it
 * via a Tailwind v4 `@theme` (theme.css); native consumes it through a typed
 * StyleSheet factory. Nothing else may hardcode a colour or a radius.
 */

// ---------------------------------------------------------------------------
// Colour
// ---------------------------------------------------------------------------

export const color = {
  /** Near-black with a faint violet cast. The default canvas. */
  ink: '#0B0A0F',
  /** One step up from ink — cards, sheets, raised surfaces. */
  surface: '#141220',
  /** Two steps up — inputs, pressed states, nested cards. */
  surfaceRaised: '#1D1A2B',
  /** Warm off-white. Light-mode canvas and primary text on dark. */
  paper: '#FBF9FB',

  /**
   * The one accent. CTAs, the score pill, blooms, focus rings.
   * Used sparingly and always at full saturation — that restraint is the
   * whole reason it reads as premium rather than as a toy.
   */
  viola: '#7C5CFC',
  violaPressed: '#6A49F0',
  violaSoft: 'rgba(124, 92, 252, 0.14)',
  /**
   * The accent, lightened for use AS TEXT.
   *
   * #7C5CFC is correct as a fill with white on top, but measured against the
   * surface colour it lands at 4.22:1 — under WCAG AA for body text. Rather
   * than compromise the brand fill, text uses this lighter tint (5.15:1 on
   * surface). Never use it as a background.
   */
  violaText: '#8B70FF',

  /**
   * Secondary hues. GRADIENTS AND GLOWS ONLY — never as UI chrome, never as a
   * button fill, never as a border. This is the guardrail that keeps "cute"
   * from tipping into "cheap".
   */
  orchid: '#E9A9FF',
  blush: '#FFB4C8',

  /** Reserved exclusively for Top of the Week. Nothing else may use gold. */
  gold: '#E8C878',

  // Text
  textPrimary: '#FBF9FB',
  textSecondary: 'rgba(251, 249, 251, 0.68)',
  // 0.44 measured at 4.20:1 on the canvas — under AA, and this carries the
  // footer, view counts and captions. 0.48 clears it at 4.81:1 while still
  // reading as clearly de-emphasised.
  textTertiary: 'rgba(251, 249, 251, 0.48)',
  textInverse: '#0B0A0F',

  // Lines
  hairline: 'rgba(255, 255, 255, 0.08)',
  hairlineStrong: 'rgba(255, 255, 255, 0.14)',

  // Status. Deliberately muted — this app never shouts at the user.
  success: '#5CD6A0',
  warning: '#F0C36B',
  danger: '#F2707F',

  // Scrim over photography, so labels stay legible on any background.
  scrim: 'rgba(11, 10, 15, 0.18)',
  scrimStrong: 'rgba(11, 10, 15, 0.55)',
} as const;

/** Gradients. The only place orchid and blush are allowed to appear. */
export const gradient = {
  petal: ['#7C5CFC', '#E9A9FF'] as const,
  bloom: ['#E9A9FF', '#FFB4C8'] as const,
  dusk: ['#0B0A0F', '#1D1A2B'] as const,
  /** Bottom-up scrim for full-bleed photos. */
  photoFoot: ['rgba(11,10,15,0)', 'rgba(11,10,15,0.82)'] as const,
} as const;

// ---------------------------------------------------------------------------
// Type
// ---------------------------------------------------------------------------

export const font = {
  /** Display. Archetype names, editorial moments. Makes it read fashion-magazine. */
  display: 'Instrument Serif',
  /** All UI. */
  sans: 'Geist Sans',
  /** Scores, prices, counts. */
  mono: 'Geist Mono',
} as const;

/**
 * Type scale. `itemLabel` is the important one: ALL CAPS, small, wide tracking.
 * That single choice is most of why the reference screenshot looks expensive,
 * so it is a first-class token rather than an inline style.
 */
export const type = {
  displayXl: { family: font.display, size: 56, lineHeight: 60, weight: '400', tracking: -1.2 },
  displayLg: { family: font.display, size: 40, lineHeight: 44, weight: '400', tracking: -0.8 },
  displayMd: { family: font.display, size: 30, lineHeight: 34, weight: '400', tracking: -0.4 },

  titleLg: { family: font.sans, size: 24, lineHeight: 30, weight: '600', tracking: -0.4 },
  titleMd: { family: font.sans, size: 19, lineHeight: 25, weight: '600', tracking: -0.2 },
  titleSm: { family: font.sans, size: 16, lineHeight: 22, weight: '600', tracking: -0.1 },

  body: { family: font.sans, size: 15, lineHeight: 22, weight: '400', tracking: 0 },
  bodySm: { family: font.sans, size: 13, lineHeight: 19, weight: '400', tracking: 0 },
  caption: { family: font.sans, size: 12, lineHeight: 16, weight: '500', tracking: 0.1 },

  /** The signature. Brand + product name on a look card. */
  itemLabel: { family: font.sans, size: 12, lineHeight: 15, weight: '700', tracking: 3 },
  itemLabelSub: { family: font.sans, size: 11, lineHeight: 14, weight: '500', tracking: 2 },

  /** Numerals: score, price, bloom and view counts. */
  stat: { family: font.mono, size: 15, lineHeight: 20, weight: '600', tracking: -0.2 },
  statLg: { family: font.mono, size: 34, lineHeight: 38, weight: '600', tracking: -1 },
} as const;

export type TypeToken = keyof typeof type;

// ---------------------------------------------------------------------------
// Space, form
// ---------------------------------------------------------------------------

/** 8px grid, with a 4px half-step for tight optical work. */
export const space = {
  none: 0,
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  xxxl: 64,
} as const;

/** Squircle-ish. Nothing in Viola has a sharp corner except hairlines. */
export const radius = {
  none: 0,
  sm: 10,
  md: 16,
  lg: 20,
  xl: 28,
  pill: 999,
} as const;

export const border = {
  hairline: 1,
  thick: 2,
} as const;

/**
 * Shadows are violet glows, never grey drop shadows. A grey shadow on a
 * near-black canvas reads as dirt; a violet glow reads as light.
 */
export const shadow = {
  none: 'none',
  soft: '0 4px 24px rgba(124, 92, 252, 0.10)',
  glow: '0 8px 40px rgba(124, 92, 252, 0.24)',
  lift: '0 16px 60px rgba(11, 10, 15, 0.55)',
} as const;

// ---------------------------------------------------------------------------
// Motion
// ---------------------------------------------------------------------------

/**
 * Springs only — no linear easing anywhere in the product. Linear easing is the
 * single fastest way to make an interface feel cheap.
 */
export const motion = {
  spring: {
    /** Default for most transitions. */
    gentle: { stiffness: 180, damping: 22, mass: 1 },
    /** Bloom burst, score pill landing. */
    bouncy: { stiffness: 260, damping: 16, mass: 0.9 },
    /** Sheets and modals. */
    stiff: { stiffness: 320, damping: 30, mass: 1 },
  },
  duration: {
    instant: 120,
    fast: 200,
    normal: 320,
    slow: 520,
    /** One beat of the reveal choreography. */
    reveal: 420,
  },
  /** Delay between consecutive item cards popping in during the Voilà. */
  stagger: 90,
  /** CSS equivalents for web, matched as closely as a bezier can match a spring. */
  easing: {
    gentle: 'cubic-bezier(0.32, 0.72, 0, 1)',
    bouncy: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
    exit: 'cubic-bezier(0.4, 0, 1, 1)',
  },
} as const;

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

export const layout = {
  /** Feed column cap. Wider than this and the feed stops feeling like a phone. */
  feedMaxWidth: 560,
  pageMaxWidth: 1120,
  /** Portrait 4:5 — the aspect a mirror selfie actually wants. */
  lookAspect: 4 / 5,
  tabBarHeight: 64,
  headerHeight: 56,
} as const;

/** Share card dimensions. Consumed by the server-side renderer. */
export const card = {
  story: { width: 1080, height: 1920 },
  og: { width: 1200, height: 630 },
  square: { width: 1080, height: 1080 },
} as const;

export const z = {
  base: 0,
  raised: 10,
  sticky: 100,
  header: 200,
  overlay: 300,
  modal: 400,
  toast: 500,
} as const;

export const tokens = {
  color,
  gradient,
  font,
  type,
  space,
  radius,
  border,
  shadow,
  motion,
  layout,
  card,
  z,
} as const;

export type Tokens = typeof tokens;
