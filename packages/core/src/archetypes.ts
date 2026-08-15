/**
 * Vibe archetypes.
 *
 * This is the single most important product decision in the rating system.
 *
 * 59% of Gen Z report feeling worse after using social media. A bare number
 * ("72") invites comparison and ranking; a *name* ("Coastal Cowgirl") invites
 * identity and sharing. So the headline of every rating is the archetype, and
 * the number is supporting detail. It is simultaneously the kinder design and
 * the more viral one — people screenshot a label, not a score.
 *
 * Every archetype is aspirational. There is no archetype for "badly dressed",
 * because that product does not need to exist.
 */

export interface Archetype {
  readonly id: string;
  /** What we show. Short enough to fit a share card pill. */
  readonly name: string;
  /** One line, second person, warm. Shown under the score. */
  readonly blurb: string;
  /** Style tags from the vision model that pull toward this archetype. */
  readonly keywords: readonly string[];
  /** Dimensions this vibe naturally leans on, used to nudge the score. */
  readonly favours: readonly ScoreDimension[];
}

export type ScoreDimension = 'fit' | 'colorStory' | 'texture' | 'statement' | 'cohesion';

export const ARCHETYPES: readonly Archetype[] = [
  {
    id: 'clean-girl',
    name: 'Clean Girl',
    blurb: 'Effortless, polished, not trying — the hardest one to fake.',
    keywords: ['minimalist', 'clean', 'neutral', 'slick', 'simple', 'monochrome', 'fresh'],
    favours: ['cohesion', 'fit'],
  },
  {
    id: 'quiet-luxury',
    name: 'Quiet Luxury',
    blurb: 'No logos, all signal. Money that whispers.',
    keywords: ['tailored', 'cashmere', 'wool', 'neutral', 'refined', 'understated', 'luxury'],
    favours: ['texture', 'cohesion'],
  },
  {
    id: 'old-money',
    name: 'Old Money',
    blurb: 'Boat shoes energy. Looks inherited, in a good way.',
    keywords: ['preppy', 'classic', 'loafers', 'collared', 'knit', 'heritage', 'tweed'],
    favours: ['cohesion', 'fit'],
  },
  {
    id: 'coastal-cowgirl',
    name: 'Coastal Cowgirl',
    blurb: 'Denim, sun, and somewhere better to be.',
    keywords: ['denim', 'western', 'boots', 'linen', 'fringe', 'sun', 'cowboy'],
    favours: ['statement', 'texture'],
  },
  {
    id: 'balletcore',
    name: 'Balletcore',
    blurb: 'Soft, precise, quietly disciplined.',
    keywords: ['ballet', 'wrap', 'satin', 'pink', 'flats', 'ribbon', 'leg warmers', 'tulle'],
    favours: ['texture', 'colorStory'],
  },
  {
    id: 'soft-grunge',
    name: 'Soft Grunge',
    blurb: 'Sweet silhouette, sharp edges.',
    keywords: ['plaid', 'distressed', 'leather', 'boots', 'layered', 'grunge', 'dark'],
    favours: ['texture', 'statement'],
  },
  {
    id: 'y2k-revival',
    name: 'Y2K Revival',
    blurb: 'Low rise, high confidence.',
    keywords: ['low rise', 'baby tee', 'metallic', 'butterfly', 'y2k', 'cargo', 'rhinestone'],
    favours: ['statement', 'colorStory'],
  },
  {
    id: 'downtown-girl',
    name: 'Downtown Girl',
    blurb: 'Black on black on black, and a coffee.',
    keywords: ['black', 'leather', 'boots', 'oversized', 'urban', 'sunglasses', 'moto'],
    favours: ['cohesion', 'statement'],
  },
  {
    id: 'coquette',
    name: 'Coquette',
    blurb: 'Bows, lace, and absolutely no apology.',
    keywords: ['bow', 'lace', 'pink', 'ruffle', 'feminine', 'pearl', 'mary jane'],
    favours: ['colorStory', 'texture'],
  },
  {
    id: 'mob-wife',
    name: 'Mob Wife',
    blurb: 'Fur, gold, and a very good reason.',
    keywords: ['fur', 'animal print', 'gold', 'leopard', 'bold', 'red lip', 'faux fur'],
    favours: ['statement', 'texture'],
  },
  {
    id: 'scandi-minimal',
    name: 'Scandi Minimal',
    blurb: 'Three colours, zero noise.',
    keywords: ['minimal', 'beige', 'grey', 'straight', 'wool', 'nordic', 'sleek'],
    favours: ['cohesion', 'colorStory'],
  },
  {
    id: 'athleisure-luxe',
    name: 'Athleisure Luxe',
    blurb: 'Gym-adjacent, dinner-capable.',
    keywords: ['leggings', 'sneakers', 'technical', 'zip', 'sporty', 'athletic', 'running'],
    favours: ['fit', 'cohesion'],
  },
  {
    id: 'streetcore',
    name: 'Streetcore',
    blurb: 'Proportions doing the heavy lifting.',
    keywords: ['oversized', 'baggy', 'hoodie', 'sneakers', 'street', 'graphic', 'cargo'],
    favours: ['statement', 'fit'],
  },
  {
    id: 'dark-academia',
    name: 'Dark Academia',
    blurb: 'Dressed for a library you do not have access to.',
    keywords: ['tweed', 'blazer', 'brown', 'plaid', 'loafers', 'academic', 'turtleneck'],
    favours: ['texture', 'cohesion'],
  },
  {
    id: 'cottagecore',
    name: 'Cottagecore',
    blurb: 'Soft, sunlit, faintly agricultural.',
    keywords: ['floral', 'gingham', 'prairie', 'linen', 'puff sleeve', 'pastoral', 'crochet'],
    favours: ['colorStory', 'texture'],
  },
  {
    id: 'tomboy-chic',
    name: 'Tomboy Chic',
    blurb: 'Borrowed fit, better on you.',
    keywords: ['boyfriend', 'relaxed', 'denim', 'button down', 'loafers', 'menswear'],
    favours: ['fit', 'cohesion'],
  },
] as const;

const BY_ID = new Map(ARCHETYPES.map((a) => [a.id, a]));

export function getArchetype(id: string): Archetype | undefined {
  return BY_ID.get(id);
}

/** Fallback when nothing matches — never leave a look unnamed. */
export const DEFAULT_ARCHETYPE_ID = 'clean-girl';

export interface ArchetypeMatch {
  archetype: Archetype;
  score: number;
}

/**
 * Ranks archetypes against the style tags the vision model returned.
 *
 * Scoring is intentionally simple and deterministic: an exact tag match is
 * worth more than a substring match, and we normalise by keyword count so
 * archetypes with long keyword lists don't dominate. Deterministic matters —
 * the same photo must always produce the same vibe, or the score stops feeling
 * like a judgement and starts feeling like a slot machine.
 */
export function rankArchetypes(styleTags: readonly string[]): ArchetypeMatch[] {
  const tags = styleTags.map((t) => t.toLowerCase().trim()).filter(Boolean);

  const ranked = ARCHETYPES.map((archetype) => {
    let raw = 0;
    for (const keyword of archetype.keywords) {
      for (const tag of tags) {
        if (tag === keyword) raw += 3;
        else if (tag.includes(keyword) || keyword.includes(tag)) raw += 1;
      }
    }
    return { archetype, score: raw / Math.sqrt(archetype.keywords.length) };
  })
    .filter((m) => m.score > 0)
    .sort((a, b) => b.score - a.score || a.archetype.id.localeCompare(b.archetype.id));

  return ranked;
}

/** Picks the winning archetype, always returning something. */
export function pickArchetype(styleTags: readonly string[]): Archetype {
  const ranked = rankArchetypes(styleTags);
  return ranked[0]?.archetype ?? getArchetype(DEFAULT_ARCHETYPE_ID)!;
}
