import { describe, expect, it } from 'vitest';
import {
  PROJECT_DISTANCE,
  REST_ANGLES,
  TESSERACT_EDGES,
  TESSERACT_VERTICES,
  foldLattice,
  length4,
  momentEnergy,
  project4to3,
  projectLattice,
  projectPoint,
  relatedness,
  returnPathsFor,
  rotate4,
  toMapPoint,
  unitHash,
  type FoldMomentInput,
} from './fold';
import { SCORE_CEILING, SCORE_FLOOR } from './scoring';

function look(
  partial: Partial<FoldMomentInput> & Pick<FoldMomentInput, 'id' | 'handle'>,
): FoldMomentInput {
  return {
    slug: partial.slug ?? partial.id,
    publishedAt: partial.publishedAt ?? 1_700_000_000_000,
    score: partial.score ?? 88,
    bloomCount: partial.bloomCount ?? 4,
    archetypeId: partial.archetypeId ?? 'clean-girl',
    photoPath: partial.photoPath ?? `seed/${partial.id}.jpg`,
    caption: partial.caption ?? 'a look',
    items: partial.items ?? [
      {
        id: `${partial.id}-item`,
        category: 'footwear',
        brand: 'adidas',
        title: 'Samba OG',
        productId: 'prod-samba',
      },
    ],
    ...partial,
  };
}

describe('tesseract', () => {
  it('has the 16 corners and 32 edges of a hypercube', () => {
    expect(TESSERACT_VERTICES).toHaveLength(16);
    expect(TESSERACT_EDGES).toHaveLength(32);
    expect(new Set(TESSERACT_VERTICES.map((v) => v.join(','))).size).toBe(16);
  });

  it('connects only vertices that differ in a single axis', () => {
    for (const [i, j] of TESSERACT_EDGES) {
      const a = TESSERACT_VERTICES[i]!;
      const b = TESSERACT_VERTICES[j]!;
      const diffs = a.filter((n, k) => n !== b[k]).length;
      expect(diffs).toBe(1);
    }
  });
});

describe('4-space rotation and projection', () => {
  it('preserves 4-length under rotation', () => {
    const p = [0.4, -0.2, 0.7, 0.5] as const;
    const rotated = rotate4(p, { xw: 0.8, yw: 1.1, zw: 0.4, xy: 0.3 });
    expect(length4(rotated)).toBeCloseTo(length4(p), 10);
  });

  it('projects a point on the w=0 hyperplane without scaling', () => {
    expect(project4to3([1, 2, 3, 0], PROJECT_DISTANCE)).toEqual([1, 2, 3]);
  });

  it('exaggerates points that sit closer to the viewer in w', () => {
    const far = project4to3([1, 0, 0, -1], PROJECT_DISTANCE);
    const near = project4to3([1, 0, 0, 1], PROJECT_DISTANCE);
    expect(Math.abs(near[0])).toBeGreaterThan(Math.abs(far[0]));
  });

  it('stays finite for every tesseract corner at rest', () => {
    for (const vertex of TESSERACT_VERTICES) {
      const [x, y, z] = projectPoint(vertex, REST_ANGLES);
      expect(Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z)).toBe(true);
    }
  });
});

describe('energy', () => {
  it('stays inside [0, 1] at the score extremes', () => {
    expect(momentEnergy(SCORE_FLOOR, 0, 0, 0)).toBeGreaterThanOrEqual(0);
    expect(momentEnergy(SCORE_CEILING, 99, 8, 99)).toBeLessThanOrEqual(1);
  });

  it('rises when a look is loved, not when it is merely complete', () => {
    const quiet = momentEnergy(80, 0, 6, 20);
    const loved = momentEnergy(80, 20, 2, 20);
    expect(loved).toBeGreaterThan(quiet);
  });
});

describe('foldLattice', () => {
  it('returns an empty room for an empty corpus', () => {
    const lattice = foldLattice([]);
    expect(lattice.moments).toEqual([]);
    expect(lattice.paths).toEqual([]);
    expect(lattice.tesseract.vertices).toHaveLength(16);
  });

  it('is deterministic', () => {
    const input = [
      look({ id: 'a', handle: 'maya', publishedAt: 100, archetypeId: 'athleisure-luxe' }),
      look({ id: 'b', handle: 'priya', publishedAt: 200, archetypeId: 'clean-girl' }),
    ];
    expect(foldLattice(input)).toEqual(foldLattice(input));
  });

  it('draws a closet path through one person over time', () => {
    const lattice = foldLattice([
      look({ id: 'm1', handle: 'maya', publishedAt: 100, archetypeId: 'athleisure-luxe' }),
      look({ id: 'm2', handle: 'maya', publishedAt: 200, archetypeId: 'athleisure-luxe' }),
      look({ id: 'm3', handle: 'maya', publishedAt: 300, archetypeId: 'athleisure-luxe' }),
    ]);
    const closet = lattice.paths.find((p) => p.kind === 'time' && p.id === 'time:maya');
    expect(closet?.nodes).toEqual(['m1', 'm2', 'm3']);
    expect(closet?.label).toBe("@maya's closet");
  });

  it('folds later looks further along w', () => {
    const lattice = foldLattice([
      look({ id: 'early', handle: 'maya', publishedAt: 100 }),
      look({ id: 'late', handle: 'maya', publishedAt: 900 }),
    ]);
    const early = lattice.moments.find((m) => m.id === 'early')!;
    const late = lattice.moments.find((m) => m.id === 'late')!;
    expect(late.p4[3]).toBeGreaterThan(early.p4[3]);
    expect(early.dims.time).toBe(0);
    expect(late.dims.time).toBe(1);
  });

  it('connects two closets that share a piece', () => {
    const lattice = foldLattice([
      look({
        id: 'noor',
        handle: 'noor',
        publishedAt: 100,
        archetypeId: 'downtown-girl',
        items: [
          {
            id: 'n1',
            category: 'footwear',
            brand: 'adidas',
            title: 'Samba OG',
            productId: 'prod-samba',
          },
        ],
      }),
      look({
        id: 'priya',
        handle: 'priya',
        publishedAt: 200,
        archetypeId: 'clean-girl',
        items: [
          {
            id: 'p1',
            category: 'footwear',
            brand: 'adidas',
            title: 'Samba OG',
            productId: 'prod-samba',
          },
        ],
      }),
    ]);
    const kinship = lattice.paths.filter((p) => p.kind === 'kinship');
    expect(kinship.length).toBeGreaterThan(0);
    expect(kinship.some((p) => p.nodes.includes('noor') && p.nodes.includes('priya'))).toBe(true);
  });

  it('hashes the same kinship key to the same unit interval', () => {
    expect(unitHash('adidas|prod-samba')).toBe(unitHash('adidas|prod-samba'));
    expect(unitHash('a')).not.toBe(unitHash('b'));
    expect(unitHash('x')).toBeGreaterThanOrEqual(0);
    expect(unitHash('x')).toBeLessThan(1);
  });
});

describe('return paths', () => {
  it('walks a closet backward to the look you are standing in', () => {
    const lattice = foldLattice([
      look({ id: 'm1', handle: 'maya', publishedAt: 100, archetypeId: 'athleisure-luxe' }),
      look({ id: 'm2', handle: 'maya', publishedAt: 200, archetypeId: 'athleisure-luxe' }),
      look({ id: 'm3', handle: 'maya', publishedAt: 300, archetypeId: 'athleisure-luxe' }),
    ]);
    const paths = returnPathsFor(lattice, 'm3');
    expect(paths.length).toBeGreaterThan(0);
    expect(paths[0]!.kind).toBe('return');
    expect(paths[0]!.nodes.at(-1)).toBe('m3');
    expect(paths[0]!.nodes[0]).toBe('m1');
  });

  it('finds a way back through a shared piece from another closet', () => {
    const lattice = foldLattice([
      look({
        id: 'noor-early',
        handle: 'noor',
        publishedAt: 100,
        archetypeId: 'downtown-girl',
        items: [
          {
            id: 'n1',
            category: 'footwear',
            brand: 'adidas',
            title: 'Samba OG',
            productId: 'prod-samba',
          },
        ],
      }),
      look({
        id: 'priya-now',
        handle: 'priya',
        publishedAt: 400,
        archetypeId: 'clean-girl',
        items: [
          {
            id: 'p1',
            category: 'footwear',
            brand: 'adidas',
            title: 'Samba OG',
            productId: 'prod-samba',
          },
        ],
      }),
    ]);
    const paths = returnPathsFor(lattice, 'priya-now');
    expect(
      paths.some((p) => p.nodes.includes('noor-early') && p.nodes.at(-1) === 'priya-now'),
    ).toBe(true);
    expect(paths.some((p) => /samba/i.test(p.label) || /adidas/i.test(p.label))).toBe(true);
  });

  it('returns nothing for a look that is not in the room', () => {
    const lattice = foldLattice([look({ id: 'a', handle: 'maya' })]);
    expect(returnPathsFor(lattice, 'missing')).toEqual([]);
  });
});

describe('relatedness', () => {
  it('is 1 for a look with itself and 0 for strangers', () => {
    const lattice = foldLattice([
      look({
        id: 'a',
        handle: 'maya',
        items: [{ id: '1', category: 'top', brand: 'Uniqlo', title: 'Tee', productId: 'u' }],
      }),
      look({
        id: 'b',
        handle: 'noor',
        archetypeId: 'downtown-girl',
        items: [{ id: '2', category: 'bag', brand: 'The Row', title: 'Tote', productId: 'r' }],
      }),
    ]);
    const [a, b] = lattice.moments;
    expect(relatedness(a!, a!)).toBe(1);
    expect(relatedness(a!, b!)).toBe(0);
  });
});

describe('flat map', () => {
  it('lands every projected moment inside the unit square', () => {
    const lattice = foldLattice([
      look({ id: 'a', handle: 'maya', publishedAt: 100 }),
      look({ id: 'b', handle: 'priya', publishedAt: 200, archetypeId: 'coastal-cowgirl' }),
    ]);
    const projected = projectLattice(lattice, REST_ANGLES);
    for (const moment of projected.moments) {
      const point = toMapPoint(moment.position);
      expect(point.x).toBeGreaterThanOrEqual(0);
      expect(point.x).toBeLessThanOrEqual(1);
      expect(point.y).toBeGreaterThanOrEqual(0);
      expect(point.y).toBeLessThanOrEqual(1);
    }
  });
});
