'use client';

import {
  projectLattice,
  toMapPoint,
  type FoldAngles,
  type FoldLattice,
  type FoldMode,
  type FoldPath,
} from '@viola/core';
import { color } from '@viola/design';
import { mediaUrl } from '@/lib/media';

interface FoldMapProps {
  lattice: FoldLattice;
  angles: FoldAngles;
  mode: FoldMode;
  selectedId: string | null;
  returns: FoldPath[];
  onSelect: (id: string | null) => void;
}

/**
 * The same lattice, flattened.
 *
 * Used when the visitor has asked for less motion, or when the machine cannot
 * draw a WebGL room. It is not a lesser view — it is the Fold with the fourth
 * wall already opened.
 */
export function FoldMap({ lattice, angles, mode, selectedId, returns, onSelect }: FoldMapProps) {
  const projected = projectLattice(lattice, angles);
  const byId = new Map(projected.moments.map((m) => [m.id, m]));
  const activePaths = mode === 'return' ? returns : lattice.paths;
  const emphasize = new Set(activePaths.flatMap((path) => path.nodes));

  return (
    <div className="absolute inset-0 overflow-hidden">
      <svg className="absolute inset-0 h-full w-full" aria-hidden="true">
        {activePaths.map((path) => {
          const d = path.nodes
            .map((id) => {
              const node = byId.get(id);
              if (!node) return null;
              const p = toMapPoint(node.position);
              return `${p.x * 100},${(1 - p.y) * 100}`;
            })
            .filter(Boolean)
            .join(' L ');
          if (!d.includes('L')) return null;
          return (
            <path
              key={path.id}
              d={`M ${d}`}
              fill="none"
              stroke={path.kind === 'return' ? color.orchid : color.viola}
              strokeOpacity={mode === 'moments' ? 0.22 : 0.55}
              strokeWidth="1.2"
            />
          );
        })}
      </svg>

      {lattice.moments.map((moment) => {
        const node = byId.get(moment.id);
        if (!node) return null;
        const point = toMapPoint(node.position);
        const selected = moment.id === selectedId;
        const dimmed =
          (mode === 'return' || mode === 'scenarios') && selectedId
            ? !emphasize.has(moment.id) && moment.id !== selectedId
            : false;
        const size = selected ? 92 : 68;

        return (
          <button
            key={moment.id}
            type="button"
            onClick={() => onSelect(selected ? null : moment.id)}
            className="absolute overflow-hidden rounded-[14px] border border-white/15 bg-[var(--color-surface)] shadow-[var(--shadow-soft)] transition-transform"
            style={{
              width: size,
              height: size * 1.25,
              left: `calc(${point.x * 100}% - ${size / 2}px)`,
              top: `calc(${(1 - point.y) * 100}% - ${(size * 1.25) / 2}px)`,
              opacity: dimmed ? 0.28 : 1,
              zIndex: selected ? 5 : 1,
              transform: selected ? 'scale(1.04)' : undefined,
            }}
            aria-label={moment.archetypeName ?? `Look by @${moment.handle}`}
          >
            <img
              src={mediaUrl(moment.photoPath)}
              alt=""
              className="h-full w-full object-cover"
              loading="lazy"
            />
          </button>
        );
      })}
    </div>
  );
}
