'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import {
  REST_ANGLES,
  returnPathsFor,
  type FoldAngles,
  type FoldLattice,
  type FoldMode,
} from '@viola/core';
import { Wordmark } from '@/components/app-shell';
import { emit } from '@/lib/client-analytics';
import { FoldHud } from './fold-hud';
import { FoldMap } from './fold-map';

const FoldCanvas = dynamic(() => import('./fold-canvas').then((m) => m.FoldCanvas), {
  ssr: false,
  loading: () => <div className="absolute inset-0 bg-[var(--color-ink)]" />,
});

interface FoldExperienceProps {
  lattice: FoldLattice;
  focusSlug: string | null;
}

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function hasWebGL(): boolean {
  if (typeof document === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    return Boolean(canvas.getContext('webgl2') || canvas.getContext('webgl'));
  } catch {
    return false;
  }
}

export function FoldExperience({ lattice, focusSlug }: FoldExperienceProps) {
  const focus = lattice.moments.find((m) => m.slug === focusSlug) ?? null;
  const [mode, setMode] = useState<FoldMode>(focus ? 'return' : 'moments');
  const [selectedId, setSelectedId] = useState<string | null>(focus?.id ?? null);
  const [angles, setAngles] = useState<FoldAngles>(REST_ANGLES);
  const [reduced, setReduced] = useState(false);
  const [webgl, setWebgl] = useState(true);
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const userTurned = useRef(false);

  useEffect(() => {
    setReduced(prefersReducedMotion());
    setWebgl(hasWebGL());
  }, []);

  useEffect(() => {
    if (reduced || dragging || selectedId) return;
    let frame = 0;
    const tick = () => {
      if (!userTurned.current) {
        setAngles((prev) => ({ ...prev, xw: prev.xw + 0.0022, xy: prev.xy + 0.0006 }));
      }
      frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [reduced, dragging, selectedId]);

  const returns = useMemo(
    () => (selectedId ? returnPathsFor(lattice, selectedId) : []),
    [lattice, selectedId],
  );

  const selected = lattice.moments.find((m) => m.id === selectedId) ?? null;

  useEffect(() => {
    if (!selected) return;
    emit('fold_moment_selected', { lookId: selected.id, mode });
    if (mode === 'return') {
      emit('fold_return_traced', { lookId: selected.id, pathCount: returns.length });
    }
  }, [selected, mode, returns.length]);

  const use3d = webgl && !reduced;
  const empty = lattice.moments.length === 0;

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest('[data-fold-ui]')) return;
    drag.current = { x: event.clientX, y: event.clientY, moved: false };
    setDragging(true);
    (event.currentTarget as HTMLDivElement).setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    const dx = event.clientX - drag.current.x;
    const dy = event.clientY - drag.current.y;
    if (Math.hypot(dx, dy) > 3) drag.current.moved = true;
    drag.current.x = event.clientX;
    drag.current.y = event.clientY;
    userTurned.current = true;
    setAngles((prev) => ({
      ...prev,
      xw: prev.xw + dx * 0.007,
      yw: prev.yw + dy * 0.005,
    }));
  };

  const onPointerUp = () => {
    drag.current = null;
    setDragging(false);
  };

  return (
    <div
      className="fixed inset-0 z-[var(--z-modal)] bg-[var(--color-ink)]"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <header
        data-fold-ui
        className="pointer-events-auto absolute inset-x-0 top-0 z-20 flex items-center justify-between px-4 py-3.5 sm:px-6"
      >
        <Link href="/" aria-label="Viola home">
          <Wordmark size={20} />
        </Link>
        <Link
          href="/"
          className="rounded-full border border-[var(--color-hairline)] px-3.5 py-1.5 text-[12px] font-medium text-[var(--color-text-secondary)] transition-colors hover:text-white"
        >
          Close
        </Link>
      </header>

      {empty ? (
        <EmptyFold />
      ) : use3d ? (
        <FoldCanvas
          lattice={lattice}
          angles={angles}
          mode={mode}
          selectedId={selectedId}
          returns={returns}
          onSelect={setSelectedId}
        />
      ) : (
        <FoldMap
          lattice={lattice}
          angles={angles}
          mode={mode}
          selectedId={selectedId}
          returns={returns}
          onSelect={setSelectedId}
        />
      )}

      <FoldHud
        mode={mode}
        onModeChange={setMode}
        selected={selected}
        returns={returns}
        momentCount={lattice.moments.length}
        pathCount={lattice.paths.length}
        reduced={!use3d}
      />
    </div>
  );
}

function EmptyFold() {
  return (
    <div className="flex h-full flex-col items-center justify-center px-6 text-center">
      <p className="label-caps text-[var(--color-text-tertiary)]">The fold</p>
      <h1 className="display mt-3 text-[36px] text-white">Nothing to fold yet</h1>
      <p className="mt-2 max-w-sm text-[14px] text-[var(--color-text-secondary)]">
        Post a fit. Once there are looks in the room, every moment and every path will be here at
        once.
      </p>
      <Link
        href="/new"
        className="mt-6 rounded-full bg-[var(--color-viola)] px-5 py-3 text-[14px] font-semibold text-white"
      >
        Post a look
      </Link>
    </div>
  );
}
