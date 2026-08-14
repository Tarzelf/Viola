/**
 * Share slugs.
 *
 * These end up in `viola.app/l/<slug>` — the string that gets pasted into a
 * group chat. So it needs to be short (it is read aloud and retyped), safe to
 * double-click-select, and unguessable enough that an unlisted look cannot be
 * enumerated.
 *
 * Crockford-style alphabet with the ambiguous glyphs removed: no I, L, O, U, or
 * 0/1. Nobody should ever have to work out whether that was an O or a zero.
 */

const ALPHABET = '23456789abcdefghjkmnpqrstvwxyz';
export const SLUG_LENGTH = 10;

/**
 * ~30^10 ≈ 5.9e14 possibilities. At a million looks that is a ~1 in 600 million
 * chance of any single collision, and the database has a unique index as the
 * backstop anyway.
 */
export function generateSlug(random: () => number = Math.random): string {
  let out = '';
  for (let i = 0; i < SLUG_LENGTH; i++) {
    out += ALPHABET[Math.floor(random() * ALPHABET.length)];
  }
  return out;
}

const SLUG_RE = new RegExp(`^[${ALPHABET}]{${SLUG_LENGTH}}$`);

export function isValidSlug(value: string): boolean {
  return SLUG_RE.test(value);
}

/**
 * Turns a display name into a URL-safe handle candidate. Used to pre-fill
 * signup, never to silently assign — people care a lot about their handle.
 */
export function suggestHandle(displayName: string): string {
  const base = displayName
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 24);
  return base.length >= 2 ? base : 'viola_user';
}
