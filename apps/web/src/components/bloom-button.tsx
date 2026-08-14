'use client';

import { useState, useTransition } from 'react';

import { formatCount } from '@/lib/format';

/**
 * The Bloom button.
 *
 * The only reaction in the product. There is no downvote and there will not be
 * one: 59% of the target audience report feeling worse after using social
 * media, and a public negative signal is the mechanism that does it. Blooms and
 * views are the only counters we show, and both only ever go up.
 *
 * Works for signed-out visitors. That is deliberate and load-bearing — a share
 * recipient hitting an auth wall is the single most expensive step you can put
 * in a viral loop.
 */

interface BloomButtonProps {
  slug: string;
  initialCount: number;
  initialBloomed: boolean;
  size?: 'sm' | 'lg';
}

export function BloomButton({ slug, initialCount, initialBloomed, size = 'sm' }: BloomButtonProps) {
  const [bloomed, setBloomed] = useState(initialBloomed);
  const [count, setCount] = useState(initialCount);
  const [burst, setBurst] = useState(0);
  const [pending, startTransition] = useTransition();

  const large = size === 'lg';

  function handleClick() {
    if (bloomed || pending) return;

    // Optimistic: the burst has to land on the tap, not after a round trip.
    setBloomed(true);
    setCount((c) => c + 1);
    setBurst((b) => b + 1);

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
        // Roll back rather than leaving a lie on screen.
        setBloomed(false);
        setCount((c) => Math.max(0, c - 1));
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
      className={[
        'group relative inline-flex items-center gap-2 rounded-full transition-all',
        'border border-[var(--color-hairline)]',
        large ? 'px-5 py-3 text-[15px]' : 'px-3.5 py-2 text-[13px]',
        bloomed
          ? 'border-transparent bg-[var(--color-viola)] text-white'
          : 'bg-[rgba(255,255,255,0.04)] text-[var(--color-text-secondary)] hover:border-[rgba(124,92,252,0.4)] hover:bg-[rgba(124,92,252,0.14)] hover:text-white',
        'active:scale-[0.96]',
      ].join(' ')}
    >
      <span className="relative flex items-center justify-center">
        <PetalIcon filled={bloomed} size={large ? 18 : 15} />
        {burst > 0 && <PetalBurst key={burst} />}
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

/** The little violet burst. The one moment of pure delight in the interface. */
function PetalBurst() {
  const petals = [0, 60, 120, 180, 240, 300];
  return (
    <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
      {petals.map((angle, i) => (
        <span
          key={angle}
          className="absolute h-1.5 w-1.5 rounded-full"
          style={{
            background: i % 2 === 0 ? 'var(--color-orchid)' : 'var(--color-blush)',
            transform: `rotate(${angle}deg) translateY(-8px)`,
            animation: `viola-petal 620ms var(--ease-bouncy) ${i * 24}ms both`,
          }}
        />
      ))}
    </span>
  );
}
