'use client';

import Link from 'next/link';
import type { FoldMode, FoldMoment, FoldPath } from '@viola/core';

const MODES: Array<{ id: FoldMode; label: string }> = [
  { id: 'moments', label: 'Moments' },
  { id: 'scenarios', label: 'Scenarios' },
  { id: 'return', label: 'Return' },
];

interface FoldHudProps {
  mode: FoldMode;
  onModeChange: (mode: FoldMode) => void;
  selected: FoldMoment | null;
  returns: FoldPath[];
  momentCount: number;
  pathCount: number;
  reduced: boolean;
}

export function FoldHud({
  mode,
  onModeChange,
  selected,
  returns,
  momentCount,
  pathCount,
  reduced,
}: FoldHudProps) {
  return (
    <div data-fold-ui className="pointer-events-none absolute inset-0 z-10">
      <div className="pointer-events-none absolute inset-x-0 top-[4.6rem] px-4 sm:px-6">
        <p className="label-caps text-[var(--color-text-tertiary)]">All at once</p>
        <h1 className="display mt-1 max-w-xl text-[34px] leading-[1.05] text-white sm:text-[44px]">
          Every look exists at the same time.
        </h1>
        <p className="mt-2 max-w-md text-[13px] leading-relaxed text-[var(--color-text-secondary)]">
          They folded the extra dimensions so you could walk them. Energy finds the way back.
        </p>
      </div>

      <div className="pointer-events-auto absolute top-[4.55rem] right-4 flex flex-col items-end gap-1.5 sm:right-6">
        {MODES.map((item) => {
          const active = mode === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onModeChange(item.id)}
              className={[
                'rounded-full px-3.5 py-1.5 text-[12px] font-medium transition-colors',
                active
                  ? 'bg-white text-[var(--color-ink)]'
                  : 'border border-[var(--color-hairline)] bg-[rgba(11,10,15,0.55)] text-[var(--color-text-secondary)] hover:text-white',
              ].join(' ')}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-[rgba(11,10,15,0.92)] via-[rgba(11,10,15,0.45)] to-transparent px-4 pt-24 pb-5 sm:px-6">
        <div className="pointer-events-auto mx-auto flex w-full max-w-[720px] flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          {selected ? (
            <SelectedCard moment={selected} returns={returns} mode={mode} />
          ) : (
            <p className="text-[13px] text-[var(--color-text-secondary)]">
              {reduced
                ? 'Tap a room. The map is the same lattice, flattened.'
                : 'Drag to turn the room. Click a look to stand in it.'}
            </p>
          )}
          <p className="stat shrink-0 text-[11px] text-[var(--color-text-tertiary)]">
            {momentCount} moments · {pathCount} paths
          </p>
        </div>
      </div>
    </div>
  );
}

function SelectedCard({
  moment,
  returns,
  mode,
}: {
  moment: FoldMoment;
  returns: FoldPath[];
  mode: FoldMode;
}) {
  return (
    <div className="min-w-0 flex-1 rounded-[var(--radius-xl)] border border-[var(--color-hairline)] bg-[rgba(20,18,32,0.86)] px-4 py-3.5 backdrop-blur-xl">
      <div className="flex flex-wrap items-baseline gap-2">
        {moment.archetypeName && (
          <span className="display text-[22px] text-white">{moment.archetypeName}</span>
        )}
        <span className="stat text-[14px] text-white/60">{moment.score}</span>
      </div>
      <p className="mt-0.5 text-[13px] text-[var(--color-text-secondary)]">
        <Link href={`/@${moment.handle}`} className="font-medium text-white hover:underline">
          @{moment.handle}
        </Link>
        {moment.caption ? ` · ${moment.caption}` : ''}
      </p>
      <p className="mt-1 text-[12px] text-[var(--color-text-tertiary)]">
        {moment.itemCount} {moment.itemCount === 1 ? 'piece' : 'pieces'}
        {mode === 'return' && returns.length > 0
          ? ` · ${returns.length} ${returns.length === 1 ? 'way' : 'ways'} back`
          : ''}
      </p>
      {mode === 'return' && returns.length > 0 && (
        <ul className="mt-2 flex flex-col gap-1">
          {returns.map((path) => (
            <li key={path.id} className="text-[12px] text-[var(--color-text-secondary)]">
              {path.label}
            </li>
          ))}
        </ul>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <Link
          href={`/l/${moment.slug}`}
          className="rounded-full bg-[var(--color-viola)] px-4 py-2 text-[13px] font-semibold text-white transition-transform active:scale-[0.97]"
        >
          Enter this moment
        </Link>
        <Link
          href={`/@${moment.handle}`}
          className="rounded-full border border-[var(--color-hairline)] px-4 py-2 text-[13px] font-medium text-[var(--color-text-secondary)] hover:text-white"
        >
          @{moment.handle}
        </Link>
      </div>
    </div>
  );
}
