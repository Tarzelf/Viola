import { describe, expect, it } from 'vitest';
import { getArchetype, pickArchetype, rankArchetypes, ARCHETYPES } from './archetypes.js';
import {
  SCORE_BANDS,
  SCORE_CEILING,
  SCORE_FLOOR,
  bandFor,
  compress,
  computeScore,
  scoreHeadline,
  strongestDimension,
  type ScoreBreakdown,
} from './scoring.js';

const raw = (n: number): ScoreBreakdown => ({
  fit: n,
  colorStory: n,
  texture: n,
  statement: n,
  cohesion: n,
});

describe('score compression', () => {
  it('maps the full raw range into the generous published band', () => {
    expect(compress(0)).toBe(SCORE_FLOOR);
    expect(compress(100)).toBe(SCORE_CEILING);
    expect(compress(50)).toBe(Math.round((SCORE_FLOOR + SCORE_CEILING) / 2));
  });

  it('clamps out-of-range input rather than throwing', () => {
    expect(compress(-40)).toBe(SCORE_FLOOR);
    expect(compress(500)).toBe(SCORE_CEILING);
  });
});

describe('computeScore', () => {
  it('never publishes a score below the floor, even for the worst possible input', () => {
    const s = computeScore({ raw: raw(0), itemCount: 1 });
    expect(s.overall).toBeGreaterThanOrEqual(SCORE_FLOOR);
  });

  it('never exceeds the ceiling', () => {
    const s = computeScore({ raw: raw(100), itemCount: 8 });
    expect(s.overall).toBeLessThanOrEqual(SCORE_CEILING);
  });

  it('is deterministic — the same fit always scores the same', () => {
    const input = { raw: raw(71), itemCount: 4 };
    const a = computeScore(input);
    const b = computeScore(input);
    expect(a).toEqual(b);
  });

  it('rewards a committed vibe on the dimensions it leans on', () => {
    const plain = computeScore({ raw: raw(60), itemCount: 4 });
    const withVibe = computeScore({
      raw: raw(60),
      itemCount: 4,
      archetype: getArchetype('quiet-luxury'),
    });
    // Quiet Luxury favours texture and cohesion.
    expect(withVibe.breakdown.texture).toBeGreaterThan(plain.breakdown.texture);
    expect(withVibe.breakdown.cohesion).toBeGreaterThan(plain.breakdown.cohesion);
    expect(withVibe.breakdown.statement).toBe(plain.breakdown.statement);
  });

  it('pulls sparse looks toward the middle rather than letting one item top out', () => {
    const sparse = computeScore({ raw: raw(100), itemCount: 1 });
    const full = computeScore({ raw: raw(100), itemCount: 5 });
    expect(sparse.overall).toBeLessThan(full.overall);
  });

  it('does not punish a sparse look that scored badly — the floor still holds', () => {
    const sparse = computeScore({ raw: raw(0), itemCount: 1 });
    const full = computeScore({ raw: raw(0), itemCount: 5 });
    expect(sparse.overall).toBeGreaterThanOrEqual(full.overall);
    expect(full.overall).toBeGreaterThanOrEqual(SCORE_FLOOR);
  });

  it('assigns a band consistent with the overall', () => {
    for (const n of [0, 25, 50, 75, 100]) {
      const s = computeScore({ raw: raw(n), itemCount: 4 });
      expect(s.band).toEqual(bandFor(s.overall));
    }
  });
});

describe('score bands', () => {
  it('every band name is a compliment — there is no failing grade', () => {
    // Encoded as a test because it is a product principle, not a preference:
    // the app exists to make someone feel good about what they already wore.
    const names = SCORE_BANDS.map((b) => b.name.toLowerCase());
    const pejoratives = ['poor', 'bad', 'weak', 'low', 'fail', 'rough', 'messy'];
    for (const name of names) {
      expect(pejoratives).not.toContain(name);
    }
  });

  it('is ordered high to low and terminates at zero', () => {
    const mins = SCORE_BANDS.map((b) => b.min);
    expect([...mins].sort((a, b) => b - a)).toEqual(mins);
    expect(mins[mins.length - 1]).toBe(0);
  });

  it('covers every reachable score', () => {
    for (let n = SCORE_FLOOR; n <= SCORE_CEILING; n++) {
      expect(bandFor(n)).toBeDefined();
    }
  });
});

describe('headline', () => {
  it('leads with the archetype, not the number', () => {
    // The ordering is the entire anti-comparison thesis in one string.
    const headline = scoreHeadline('Clean Girl', 94);
    expect(headline).toBe('Clean Girl · 94');
    expect(headline.indexOf('Clean Girl')).toBeLessThan(headline.indexOf('94'));
  });
});

describe('strongestDimension', () => {
  it('finds the standout', () => {
    expect(
      strongestDimension({ fit: 70, colorStory: 95, texture: 80, statement: 60, cohesion: 75 }),
    ).toBe('colorStory');
  });

  it('is stable when everything ties', () => {
    expect(strongestDimension(raw(80))).toBe('fit');
  });
});

describe('archetypes', () => {
  it('matches obvious tag sets to the right vibe', () => {
    expect(pickArchetype(['ballet', 'satin', 'ribbon']).id).toBe('balletcore');
    expect(pickArchetype(['leopard', 'fur', 'gold']).id).toBe('mob-wife');
    expect(pickArchetype(['tweed', 'blazer', 'loafers']).id).toBe('dark-academia');
  });

  it('always returns something, even for nonsense', () => {
    expect(pickArchetype([]).id).toBeDefined();
    expect(pickArchetype(['asdfgh']).id).toBeDefined();
  });

  it('is deterministic across calls', () => {
    const tags = ['denim', 'boots', 'linen'];
    expect(pickArchetype(tags).id).toBe(pickArchetype(tags).id);
  });

  it('breaks ties deterministically rather than at random', () => {
    // A slot-machine vibe would make the rating feel arbitrary.
    const tags = ['black'];
    const first = rankArchetypes(tags);
    const second = rankArchetypes(tags);
    expect(first.map((m) => m.archetype.id)).toEqual(second.map((m) => m.archetype.id));
  });

  it('normalises so verbose archetypes do not dominate', () => {
    const ranked = rankArchetypes(['minimal']);
    expect(ranked.length).toBeGreaterThan(0);
    expect(ranked[0]!.score).toBeGreaterThan(0);
  });

  it('has unique ids and non-empty copy throughout', () => {
    const ids = ARCHETYPES.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const a of ARCHETYPES) {
      expect(a.name.length).toBeGreaterThan(0);
      expect(a.blurb.length).toBeGreaterThan(0);
      expect(a.keywords.length).toBeGreaterThan(0);
      expect(a.favours.length).toBeGreaterThan(0);
    }
  });

  it('keeps names short enough to fit a share-card pill', () => {
    for (const a of ARCHETYPES) {
      expect(a.name.length).toBeLessThanOrEqual(18);
    }
  });
});
