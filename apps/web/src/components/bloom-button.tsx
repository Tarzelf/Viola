'use client';

import { useEffect, useRef, useState, useTransition, type CSSProperties } from 'react';

import { formatCount } from '@/lib/format';

/**
 * The Bloom button.
 *
 * The only reaction in the product. There is no downvote and there will not be
 * one: 59% of the target audience report feeling worse after using social
 * media, and a public negative signal is the mechanism that does it. Blooms and
 * views are the only counters we show, and both only ever go up.
 *
 * Motion: transitions.dev **like-button** recipe, recolored to Viola violet.
 * Pop scale lives on an HTML wrapper around the SVG (Chromium otherwise
 * rasterises the SVG during transform). Particles fire only on the way in.
 */

interface BloomButtonProps {
  slug: string;
  initialCount: number;
  initialBloomed: boolean;
  size?: 'sm' | 'lg';
}

const PARTICLE_VECTORS = [
  { px: '-18px', py: '-16px', psize: 1.1 },
  { px: '16px', py: '-18px', psize: 0.9 },
  { px: '-20px', py: '4px', psize: 1 },
  { px: '20px', py: '2px', psize: 1.15 },
  { px: '-10px', py: '18px', psize: 0.85 },
  { px: '12px', py: '16px', psize: 1 },
  { px: '0px', py: '-22px', psize: 0.95 },
  { px: '4px', py: '20px', psize: 1.05 },
];

export function BloomButton({ slug, initialCount, initialBloomed, size = 'sm' }: BloomButtonProps) {
  const [bloomed, setBloomed] = useState(initialBloomed);
  const [count, setCount] = useState(initialCount);
  const [bursting, setBursting] = useState(false);
  const [pending, startTransition] = useTransition();
  const burstTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (burstTimer.current) clearTimeout(burstTimer.current);
    };
  }, []);

  const large = size === 'lg';

  function handleClick() {
    if (bloomed || pending) return;

    setBloomed(true);
    setCount((c) => c + 1);
    setBursting(true);
    if (burstTimer.current) clearTimeout(burstTimer.current);
    burstTimer.current = setTimeout(() => setBursting(false), 650);

    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate?.(8);
    }

    startTransition(async () => {
      try {
        const response = await fetch(`/api/looks/${slug}/bloom`, { method: 'POST' });
        if (!response.ok) throw new Error(String(response.status));
        const data = (await response.json()) as { bloomCount: number };
        setCount(data.bloomCount);
      } catch {
        setBloomed(false);
        setCount((c) => Math.max(0, c - 1));
        setBursting(false);
      }
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={bloomed}
      aria-pressed={bloomed}
      aria-label={bloomed ? `Bloomed. ${count} blooms` : `Give this look a bloom. ${count} blooms`}
      data-liked={bloomed ? 'true' : 'false'}
      className={[
        't-like group relative inline-flex items-center gap-2 rounded-full transition-all',
        'border border-[var(--color-hairline)]',
        large ? 'px-5 py-3 text-[15px]' : 'px-3.5 py-2 text-[13px]',
        bloomed
          ? 'border-transparent bg-[var(--color-viola)] text-white'
          : 'bg-[rgba(255,255,255,0.04)] text-[var(--color-text-secondary)] hover:border-[rgba(124,92,252,0.4)] hover:bg-[rgba(124,92,252,0.14)] hover:text-white',
        'active:scale-[0.96]',
        bursting ? 'is-bursting' : '',
      ].join(' ')}
    >
      <span className="relative flex items-center justify-center">
        <span className="t-like-icon">
          <PetalIcon filled={bloomed} size={large ? 18 : 15} />
        </span>
        <span className="t-like-particles" aria-hidden="true">
          {PARTICLE_VECTORS.map((p, i) => (
            <i
              key={i}
              style={
                {
                  '--px': p.px,
                  '--py': p.py,
                  '--psize': p.psize,
                  '--pdelay': `${i * 18}ms`,
                  '--p-end-scale': i % 2 === 0 ? 0.55 : 0.7,
                } as CSSProperties
              }
            />
          ))}
        </span>
      </span>
      <span className="stat tabular-nums">{formatCount(count)}</span>
    </button>
  );
}

function PetalIcon({ filled, size }: { filled: boolean; size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path
        d="M10 17.5s-6.7-4.2-6.7-9A3.9 3.9 0 0 1 10 6.2a3.9 3.9 0 0 1 6.7 2.3c0 4.8-6.7 9-6.7 9Z"
        fill={filled ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}
