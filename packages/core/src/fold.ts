import { ARCHETYPES, getArchetype } from './archetypes';
import { SCORE_CEILING, SCORE_FLOOR } from './scoring';

/**
 * The Fold.
 *
 * A look is five dimensions that a phone cannot show at once:
 *
 *   time      — when it was worn
 *   vibe      — the archetype
 *   energy    — score, blooms, how much the look is *doing*
 *   kinship   — shared pieces; the same Samba walking from closet to closet
 *   scenario  — whose closet, which telling of the same fit
 *
 * The Interstellar move is to fold those extra axes into a tesseract and
 * project the result into a room you can turn. The Pantheon move is to treat
 * energy as the thing that lights a path *back* — not a ranking, a way home.
 *
 * This module is the math only. No renderer, no database. Same lattice on
 * web (WebGL) and iOS (a flat map). Deterministic: same looks, same rooms.
 */

export type Vec3 = readonly [number, number, number];
export type Vec4 = readonly [number, number, number, number];

export type FoldPathKind = 'time' | 'vibe' | 'kinship' | 'return';
export type FoldMode = 'moments' | 'scenarios' | 'return';

export interface FoldAngles {
  /** Mixes the time axis (w) into x. The "unfold time" gesture. */
  xw: number;
  /** Mixes time into height. */
  yw: number;
  /** Mixes time into depth. */
  zw: number;
  /** Spin in ordinary space, so the ring of vibes can turn. */
  xy: number;
}

/** A first view that already reads as a room, not a cloud of dots. */
export const REST_ANGLES: FoldAngles = {
  xw: 0.62,
  yw: 0.28,
  zw: 0.18,
  xy: 0.12,
};

export const PROJECT_DISTANCE = 3;

export interface FoldItem {
  id: string;
  category: string;
  brand: string | null;
  title: string | null;
  productId: string | null;
}

export interface FoldMomentInput {
  id: string;
  slug: string;
  handle: string;
  publishedAt: number;
  score: number | null;
  bloomCount: number;
  archetypeId: string | null;
  photoPath: string;
  caption: string | null;
  items: FoldItem[];
}

export interface FoldDims {
  time: number;
  vibe: number;
  energy: number;
  kinship: number;
  scenario: number;
}

export interface FoldMoment {
  id: string;
  slug: string;
  handle: string;
  publishedAt: number;
  score: number;
  bloomCount: number;
  archetypeId: string | null;
  archetypeName: string | null;
  photoPath: string;
  caption: string | null;
  itemCount: number;
  energy: number;
  dims: FoldDims;
  p4: Vec4;
  items: FoldItem[];
}

export interface FoldPath {
  id: string;
  kind: FoldPathKind;
  label: string;
  nodes: string[];
  energy: number;
}

export interface FoldTesseract {
  vertices: Vec4[];
  edges: Array<readonly [number, number]>;
}

export interface FoldLattice {
  moments: FoldMoment[];
  paths: FoldPath[];
  tesseract: FoldTesseract;
}

export function clamp01(n: number): number {
  if (n <= 0) return 0;
  if (n >= 1) return 1;
  return n;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function norm(value: number, min: number, max: number): number {
  if (max === min) return 0.5;
  return clamp01((value - min) / (max - min));
}

/** FNV-1a, mapped onto [0, 1). Stable across runs; not a cryptographic hash. */
export function unitHash(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967296;
}

export function tesseractVertices(): Vec4[] {
  const out: Vec4[] = [];
  for (const x of [-1, 1] as const) {
    for (const y of [-1, 1] as const) {
      for (const z of [-1, 1] as const) {
        for (const w of [-1, 1] as const) {
          out.push([x, y, z, w]);
        }
      }
    }
  }
  return out;
}

export function tesseractEdges(vertices: readonly Vec4[]): Array<readonly [number, number]> {
  const edges: Array<readonly [number, number]> = [];
  for (let i = 0; i < vertices.length; i++) {
    for (let j = i + 1; j < vertices.length; j++) {
      const a = vertices[i]!;
      const b = vertices[j]!;
      let diffs = 0;
      for (let k = 0; k < 4; k++) if (a[k] !== b[k]) diffs++;
      if (diffs === 1) edges.push([i, j]);
    }
  }
  return edges;
}

export const TESSERACT_VERTICES: readonly Vec4[] = tesseractVertices();
export const TESSERACT_EDGES: ReadonlyArray<readonly [number, number]> =
  tesseractEdges(TESSERACT_VERTICES);

function rotatePlane(a: number, b: number, angle: number): [number, number] {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return [a * c - b * s, a * s + b * c];
}

/** Rotate a 4-vector through the planes that mix time (w) into ordinary space. */
export function rotate4(p: Vec4, angles: FoldAngles): Vec4 {
  let [x, y, z, w] = p;
  [x, y] = rotatePlane(x, y, angles.xy);
  [x, w] = rotatePlane(x, w, angles.xw);
  [y, w] = rotatePlane(y, w, angles.yw);
  [z, w] = rotatePlane(z, w, angles.zw);
  return [x, y, z, w];
}

/**
 * Perspective from 4-space into 3-space.
 *
 * `distance` is how far the viewer sits from the w = 0 hyperplane. Smaller
 * values exaggerate the fold; 3 is the value that keeps a unit tesseract
 * inside a comfortable room.
 */
export function project4to3(p: Vec4, distance = PROJECT_DISTANCE): Vec3 {
  const denom = distance - p[3];
  const s = Math.abs(denom) < 1e-6 ? 1e6 : distance / denom;
  return [p[0] * s, p[1] * s, p[2] * s];
}

export function length4(p: Vec4): number {
  return Math.hypot(p[0], p[1], p[2], p[3]);
}

function vibeScalar(archetypeId: string | null): number {
  if (!archetypeId) return 0.5;
  const index = ARCHETYPES.findIndex((a) => a.id === archetypeId);
  if (index < 0) return unitHash(archetypeId);
  return (index + 0.5) / ARCHETYPES.length;
}

function kinshipKey(items: readonly FoldItem[]): string {
  const tokens = items
    .flatMap((item) => [item.brand?.toLowerCase().trim(), item.productId])
    .filter((token): token is string => Boolean(token));
  return tokens.sort().join('|');
}

export function momentEnergy(
  score: number,
  bloomCount: number,
  itemCount: number,
  maxBlooms: number,
): number {
  const scoreN = norm(score, SCORE_FLOOR, SCORE_CEILING);
  const bloomN = maxBlooms <= 0 ? 0 : Math.log1p(bloomCount) / Math.log1p(maxBlooms);
  const itemN = clamp01(itemCount / 6);
  return clamp01(0.55 * scoreN + 0.3 * bloomN + 0.15 * itemN);
}

function place4(dims: FoldDims, jitter: number): Vec4 {
  const angle = dims.vibe * Math.PI * 2;
  const radius = 0.42 + 0.38 * dims.kinship;
  const x = Math.cos(angle) * radius + Math.cos(dims.scenario * Math.PI * 2) * 0.16 + jitter;
  const y = (dims.energy - 0.5) * 1.55;
  const z =
    Math.sin(angle) * radius + Math.sin(dims.scenario * Math.PI * 1.7) * 0.16 + jitter * 0.7;
  const w = (dims.time - 0.5) * 2;
  return [x, y, z, w];
}

export function relatedness(a: FoldMoment, b: FoldMoment): number {
  if (a.id === b.id) return 1;
  let score = 0;
  if (a.handle === b.handle) score += 0.45;
  if (a.archetypeId && a.archetypeId === b.archetypeId) score += 0.25;

  const aBrands = new Set(a.items.map((i) => i.brand?.toLowerCase()).filter(Boolean));
  const bBrands = new Set(b.items.map((i) => i.brand?.toLowerCase()).filter(Boolean));
  let sharedBrands = 0;
  for (const brand of aBrands) if (bBrands.has(brand)) sharedBrands++;
  score += Math.min(0.4, sharedBrands * 0.2);

  const aProducts = new Set(a.items.map((i) => i.productId).filter(Boolean));
  const bProducts = new Set(b.items.map((i) => i.productId).filter(Boolean));
  let sharedProducts = 0;
  for (const product of aProducts) if (bProducts.has(product)) sharedProducts++;
  score += Math.min(0.4, sharedProducts * 0.25);

  return clamp01(score);
}

function sharedLabels(a: FoldMoment, b: FoldMoment): string[] {
  const labels: string[] = [];
  const seen = new Set<string>();
  for (const item of a.items) {
    const hit = b.items.find(
      (other) =>
        (item.productId && other.productId === item.productId) ||
        (item.brand && other.brand && item.brand.toLowerCase() === other.brand.toLowerCase()),
    );
    if (!hit) continue;
    const label = (item.brand ?? item.title ?? hit.title ?? '').trim();
    const key = label.toLowerCase();
    if (!label || seen.has(key)) continue;
    seen.add(key);
    labels.push(label);
  }
  return labels;
}

function pathEnergy(nodes: readonly FoldMoment[]): number {
  if (nodes.length === 0) return 0;
  return nodes.reduce((sum, node) => sum + node.energy, 0) / nodes.length;
}

function timePaths(moments: readonly FoldMoment[]): FoldPath[] {
  const byHandle = new Map<string, FoldMoment[]>();
  for (const moment of moments) {
    const list = byHandle.get(moment.handle) ?? [];
    list.push(moment);
    byHandle.set(moment.handle, list);
  }

  const paths: FoldPath[] = [];
  for (const [handle, list] of [...byHandle.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const ordered = [...list].sort(
      (a, b) => a.publishedAt - b.publishedAt || a.id.localeCompare(b.id),
    );
    if (ordered.length < 2) continue;
    paths.push({
      id: `time:${handle}`,
      kind: 'time',
      label: `@${handle}'s closet`,
      nodes: ordered.map((m) => m.id),
      energy: pathEnergy(ordered),
    });
  }
  return paths;
}

function vibePaths(moments: readonly FoldMoment[]): FoldPath[] {
  const byVibe = new Map<string, FoldMoment[]>();
  for (const moment of moments) {
    if (!moment.archetypeId) continue;
    const list = byVibe.get(moment.archetypeId) ?? [];
    list.push(moment);
    byVibe.set(moment.archetypeId, list);
  }

  const paths: FoldPath[] = [];
  for (const [archetypeId, list] of [...byVibe.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const ordered = [...list].sort(
      (a, b) => a.publishedAt - b.publishedAt || a.id.localeCompare(b.id),
    );
    if (ordered.length < 2) continue;
    const name = getArchetype(archetypeId)?.name ?? archetypeId;
    paths.push({
      id: `vibe:${archetypeId}`,
      kind: 'vibe',
      label: `${name}, through time`,
      nodes: ordered.map((m) => m.id),
      energy: pathEnergy(ordered),
    });
  }
  return paths;
}

function kinshipPaths(moments: readonly FoldMoment[]): FoldPath[] {
  const byProduct = new Map<string, FoldMoment[]>();
  const byBrand = new Map<string, FoldMoment[]>();

  for (const moment of moments) {
    const seenProduct = new Set<string>();
    const seenBrand = new Set<string>();
    for (const item of moment.items) {
      if (item.productId && !seenProduct.has(item.productId)) {
        seenProduct.add(item.productId);
        const list = byProduct.get(item.productId) ?? [];
        list.push(moment);
        byProduct.set(item.productId, list);
      }
      const brand = item.brand?.toLowerCase().trim();
      if (brand && !seenBrand.has(brand)) {
        seenBrand.add(brand);
        const list = byBrand.get(brand) ?? [];
        list.push(moment);
        byBrand.set(brand, list);
      }
    }
  }

  const paths: FoldPath[] = [];
  const used = new Set<string>();

  const consider = (
    key: string,
    list: FoldMoment[],
    labelFor: (members: FoldMoment[]) => string,
  ) => {
    const unique = uniqueById(list);
    const handles = new Set(unique.map((m) => m.handle));
    if (unique.length < 2 || handles.size < 2) return;
    const ordered = [...unique].sort(
      (a, b) => a.publishedAt - b.publishedAt || a.id.localeCompare(b.id),
    );
    const fingerprint = ordered.map((m) => m.id).join('>');
    if (used.has(fingerprint)) return;
    used.add(fingerprint);
    paths.push({
      id: `kinship:${key}`,
      kind: 'kinship',
      label: labelFor(ordered),
      nodes: ordered.map((m) => m.id),
      energy: pathEnergy(ordered),
    });
  };

  for (const [productId, list] of [...byProduct.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    consider(`p:${productId}`, list, (members) => {
      const piece = members[0]?.items.find((i) => i.productId === productId);
      const name = [piece?.brand, piece?.title].filter(Boolean).join(' ') || 'a shared piece';
      return `the ${name}`;
    });
  }

  for (const [brand, list] of [...byBrand.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    consider(`b:${brand}`, list, () => `through ${brand}`);
  }

  return paths;
}

function uniqueById(list: readonly FoldMoment[]): FoldMoment[] {
  const seen = new Set<string>();
  const out: FoldMoment[] = [];
  for (const moment of list) {
    if (seen.has(moment.id)) continue;
    seen.add(moment.id);
    out.push(moment);
  }
  return out;
}

interface Hop {
  to: string;
  weight: number;
}

function adjacency(moments: readonly FoldMoment[]): Map<string, Hop[]> {
  const graph = new Map<string, Hop[]>();
  for (const moment of moments) graph.set(moment.id, []);

  for (let i = 0; i < moments.length; i++) {
    for (let j = i + 1; j < moments.length; j++) {
      const a = moments[i]!;
      const b = moments[j]!;
      const rel = relatedness(a, b);
      if (rel < 0.2) continue;
      const weight = 1 - rel;
      graph.get(a.id)!.push({ to: b.id, weight });
      graph.get(b.id)!.push({ to: a.id, weight });
    }
  }
  return graph;
}

function shortestPath(
  from: string,
  to: string,
  graph: Map<string, Hop[]>,
  byId: Map<string, FoldMoment>,
): string[] | null {
  if (from === to) return [from];

  const dist = new Map<string, number>();
  const prev = new Map<string, string>();
  const queue = new Set<string>(graph.keys());
  for (const id of queue) dist.set(id, Number.POSITIVE_INFINITY);
  dist.set(from, 0);

  const fromTime = byId.get(from)?.publishedAt ?? 0;
  const toTime = byId.get(to)?.publishedAt ?? 0;
  const forward = fromTime <= toTime;

  while (queue.size > 0) {
    let current: string | null = null;
    let best = Number.POSITIVE_INFINITY;
    for (const id of queue) {
      const d = dist.get(id) ?? Number.POSITIVE_INFINITY;
      if (d < best) {
        best = d;
        current = id;
      }
    }
    if (current == null || best === Number.POSITIVE_INFINITY) break;
    queue.delete(current);
    if (current === to) break;

    const here = byId.get(current);
    for (const hop of graph.get(current) ?? []) {
      if (!queue.has(hop.to)) continue;
      const next = byId.get(hop.to);
      if (here && next) {
        // Return paths walk *toward* the target through time, never backwards
        // past the origin. That is the Pantheon constraint: a way back is a
        // history, not a teleport.
        if (forward && next.publishedAt < here.publishedAt) continue;
        if (!forward && next.publishedAt > here.publishedAt) continue;
      }
      const alt = best + hop.weight;
      if (alt < (dist.get(hop.to) ?? Number.POSITIVE_INFINITY)) {
        dist.set(hop.to, alt);
        prev.set(hop.to, current);
      }
    }
  }

  if (!prev.has(to) && from !== to) return null;
  const route = [to];
  let cursor = to;
  while (cursor !== from) {
    const step = prev.get(cursor);
    if (!step) return null;
    route.push(step);
    cursor = step;
  }
  route.reverse();
  return route;
}

function wayBackLabel(origin: FoldMoment, target: FoldMoment): string {
  if (origin.handle === target.handle) return `back through @${target.handle}`;
  const shared = sharedLabels(origin, target);
  if (shared[0]) return `back through the ${shared[0]}`;
  if (origin.archetypeName && origin.archetypeName === target.archetypeName) {
    return `back through ${origin.archetypeName}`;
  }
  return `a way back to @${target.handle}`;
}

/**
 * Ways back to a moment.
 *
 * Given a look, find the histories that can walk here: the wearer's own
 * closet, a piece that showed up earlier on someone else, a vibe that has
 * been living in the lattice. Ranked by how much energy the path is carrying,
 * not by how short it is — a longer, brighter way back is the more honest one.
 */
export function returnPathsFor(lattice: FoldLattice, targetId: string, maxPaths = 3): FoldPath[] {
  const byId = new Map(lattice.moments.map((m) => [m.id, m]));
  const target = byId.get(targetId);
  if (!target) return [];

  const graph = adjacency(lattice.moments);
  const out: FoldPath[] = [];
  const seen = new Set<string>();

  const push = (nodes: string[], label: string, suffix: string) => {
    if (nodes.length < 2) return;
    const fingerprint = nodes.join('>');
    if (seen.has(fingerprint)) return;
    seen.add(fingerprint);
    const members = nodes.map((id) => byId.get(id)).filter((m): m is FoldMoment => Boolean(m));
    out.push({
      id: `return:${targetId}:${suffix}`,
      kind: 'return',
      label,
      nodes,
      energy: pathEnergy(members),
    });
  };

  const closet = lattice.moments
    .filter((m) => m.handle === target.handle && m.publishedAt <= target.publishedAt)
    .sort((a, b) => a.publishedAt - b.publishedAt || a.id.localeCompare(b.id));
  push(
    closet.map((m) => m.id),
    `back through @${target.handle}`,
    'closet',
  );

  const earlier = lattice.moments
    .filter((m) => m.id !== target.id && m.publishedAt <= target.publishedAt)
    .map((m) => ({ m, rel: relatedness(m, target) }))
    .filter((row) => row.rel >= 0.2)
    .sort(
      (a, b) => b.rel - a.rel || a.m.publishedAt - b.m.publishedAt || a.m.id.localeCompare(b.m.id),
    );

  for (const { m } of earlier) {
    if (out.length >= maxPaths) break;
    const route = shortestPath(m.id, target.id, graph, byId) ?? [m.id, target.id];
    push(route, wayBackLabel(m, target), m.id);
  }

  return out.sort((a, b) => b.energy - a.energy || a.id.localeCompare(b.id)).slice(0, maxPaths);
}

export function foldLattice(inputs: readonly FoldMomentInput[]): FoldLattice {
  if (inputs.length === 0) {
    return {
      moments: [],
      paths: [],
      tesseract: { vertices: [...TESSERACT_VERTICES], edges: [...TESSERACT_EDGES] },
    };
  }

  const times = inputs.map((i) => i.publishedAt);
  const tMin = Math.min(...times);
  const tMax = Math.max(...times);
  const maxBlooms = Math.max(0, ...inputs.map((i) => i.bloomCount));
  const handles = [...new Set(inputs.map((i) => i.handle))].sort();

  const moments: FoldMoment[] = [...inputs]
    .sort((a, b) => a.publishedAt - b.publishedAt || a.id.localeCompare(b.id))
    .map((input) => {
      const score = input.score ?? SCORE_FLOOR;
      const dims: FoldDims = {
        time: norm(input.publishedAt, tMin, tMax),
        vibe: vibeScalar(input.archetypeId),
        energy: momentEnergy(score, input.bloomCount, input.items.length, maxBlooms),
        kinship: unitHash(kinshipKey(input.items) || input.id),
        scenario:
          (handles.indexOf(input.handle) + 0.5) / Math.max(handles.length, 1) +
          unitHash(input.id) * 0.06,
      };
      const jitter = (unitHash(input.id) - 0.5) * 0.1;
      return {
        id: input.id,
        slug: input.slug,
        handle: input.handle,
        publishedAt: input.publishedAt,
        score,
        bloomCount: input.bloomCount,
        archetypeId: input.archetypeId,
        archetypeName: input.archetypeId ? (getArchetype(input.archetypeId)?.name ?? null) : null,
        photoPath: input.photoPath,
        caption: input.caption,
        itemCount: input.items.length,
        energy: dims.energy,
        dims,
        p4: place4(dims, jitter),
        items: input.items,
      };
    });

  return {
    moments,
    paths: [...timePaths(moments), ...vibePaths(moments), ...kinshipPaths(moments)],
    tesseract: { vertices: [...TESSERACT_VERTICES], edges: [...TESSERACT_EDGES] },
  };
}

export function projectPoint(p4: Vec4, angles: FoldAngles, distance = PROJECT_DISTANCE): Vec3 {
  return project4to3(rotate4(p4, angles), distance);
}

export function projectLattice(
  lattice: FoldLattice,
  angles: FoldAngles,
  distance = PROJECT_DISTANCE,
): {
  moments: Array<{ id: string; position: Vec3 }>;
  vertices: Vec3[];
} {
  return {
    moments: lattice.moments.map((moment) => ({
      id: moment.id,
      position: projectPoint(moment.p4, angles, distance),
    })),
    vertices: lattice.tesseract.vertices.map((vertex) => projectPoint(vertex, angles, distance)),
  };
}

/** Map a projected point into a 0–1 square for the flat (no-WebGL) view. */
export function toMapPoint(position: Vec3, spread = 2.6): { x: number; y: number; depth: number } {
  return {
    x: clamp01((position[0] + spread) / (spread * 2)),
    y: clamp01((position[1] + spread) / (spread * 2)),
    depth: clamp01((position[2] + spread) / (spread * 2)),
  };
}
