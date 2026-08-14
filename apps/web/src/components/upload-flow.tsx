'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Upload and the Voilà.
 *
 * The reveal is the product. Everything here exists to make the twenty seconds
 * between picking a photo and seeing the finished card feel like something is
 * being uncovered rather than something is loading.
 *
 * Two decisions worth keeping:
 *
 * - Pieces appear one at a time as the pipeline resolves them, not all at once
 *   at the end. A progress bar and then a finished card wastes the only
 *   genuinely delightful moment the product has.
 * - The photo is downscaled in the browser before upload. A modern phone photo
 *   is 4-8MB; sending that over a mobile connection adds seconds to the slowest
 *   step in the flow for zero quality benefit at our render sizes.
 */

type Phase = 'idle' | 'preparing' | 'processing' | 'done' | 'error';

const STAGE_COPY: Record<string, string> = {
  'stage:ingest': 'Reading your photo',
  'stage:vision': 'Finding the pieces',
  'stage:resolve': 'Looking up where to buy',
  'stage:layout': 'Laying out your card',
};

const MAX_EDGE = 1600;

export function UploadFlow() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [phase, setPhase] = useState<Phase>('idle');
  const [preview, setPreview] = useState<string | null>(null);
  const [slug, setSlug] = useState<string | null>(null);
  const [stage, setStage] = useState<string | null>(null);
  const [found, setFound] = useState<Array<{ id: string; label: string }>>([]);
  const [score, setScore] = useState<{ value: number; archetype: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => () => void (pollRef.current && clearInterval(pollRef.current)), []);

  const handleFile = useCallback(
    async (file: File) => {
      setError(null);
      setPhase('preparing');
      setPreview(URL.createObjectURL(file));

      try {
        const prepared = await downscale(file);

        const form = new FormData();
        form.append('photo', prepared, 'look.jpg');

        const response = await fetch('/api/looks', { method: 'POST', body: form });
        if (!response.ok) {
          const body = (await response.json().catch(() => null)) as {
            error?: { message?: string };
          } | null;
          throw new Error(body?.error?.message ?? 'Upload failed');
        }

        const { slug: newSlug } = (await response.json()) as { slug: string };
        setSlug(newSlug);
        setPhase('processing');
        startPolling(newSlug);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Something went wrong');
        setPhase('error');
      }
    },
    // startPolling and router are stable for the lifetime of this component.
    [],
  );

  function startPolling(lookSlug: string) {
    pollRef.current = setInterval(async () => {
      try {
        const response = await fetch(`/api/looks/${lookSlug}/status`);
        if (!response.ok) return;

        const data = (await response.json()) as {
          status: string;
          stage: string | null;
          score: number | null;
          archetype: string | null;
          items: Array<{ id: string; brand: string | null; title: string | null; subtype: string }>;
          ready: boolean;
          failed: boolean;
          quarantined: boolean;
        };

        setStage(data.stage);
        setFound(
          data.items.map((i) => ({
            id: i.id,
            label: [i.brand, i.title ?? i.subtype].filter(Boolean).join(' '),
          })),
        );

        if (data.ready) {
          if (data.score !== null && data.archetype) {
            setScore({ value: data.score, archetype: data.archetype });
          }
          stopPolling();
          setPhase('done');
          // Let the score land before navigating; the beat is the payoff.
          setTimeout(() => router.push(`/l/${lookSlug}`), 1500);
        } else if (data.failed) {
          stopPolling();
          setError("We couldn't read that one. Try a clearer photo?");
          setPhase('error');
        } else if (data.quarantined) {
          stopPolling();
          setError("That upload didn't pass our content check.");
          setPhase('error');
        }
      } catch {
        /* transient; the next tick will retry */
      }
    }, 700);
  }

  function stopPolling() {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = null;
  }

  function reset() {
    stopPolling();
    setPhase('idle');
    setPreview(null);
    setSlug(null);
    setStage(null);
    setFound([]);
    setScore(null);
    setError(null);
  }

  if (phase === 'idle') {
    return (
      <div>
        <h1 className="display text-[34px] leading-tight text-white">Post a fit</h1>
        <p className="mt-2 text-[15px] text-[var(--color-text-secondary)]">
          Viola names every piece, scores the look, and finds where to buy it.
        </p>

        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="group mt-7 flex w-full flex-col items-center justify-center rounded-[var(--radius-xl)] border border-dashed border-[var(--color-hairline-strong)] bg-[var(--color-surface)] px-6 py-16 transition-colors hover:border-[rgba(124,92,252,0.5)] hover:bg-[rgba(124,92,252,0.05)]"
        >
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-viola-soft)] transition-transform group-hover:scale-105">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M12 16V5m0 0L7.5 9.5M12 5l4.5 4.5M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"
                stroke="var(--color-viola)"
                strokeWidth="1.9"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <span className="mt-4 text-[15px] font-semibold text-white">Choose a photo</span>
          <span className="mt-1 text-[13px] text-[var(--color-text-tertiary)]">
            A mirror selfie works best
          </span>
        </button>

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleFile(file);
          }}
        />

        <p className="mt-4 text-center text-[12px] leading-relaxed text-[var(--color-text-tertiary)]">
          Location data is stripped from every upload before it is stored.
        </p>
      </div>
    );
  }

  if (phase === 'error') {
    return (
      <div className="surface px-6 py-12 text-center">
        <p className="display text-[24px] text-white">That didn&rsquo;t work</p>
        <p className="mt-2 text-[14px] text-[var(--color-text-secondary)]">{error}</p>
        <button
          type="button"
          onClick={reset}
          className="mt-6 rounded-full bg-[var(--color-viola)] px-5 py-3 text-[14px] font-semibold text-white"
        >
          Try another photo
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="relative aspect-[4/5] w-full overflow-hidden rounded-[var(--radius-xl)] bg-[var(--color-surface)]">
        {preview && (
          <img src={preview} alt="" className="absolute inset-0 h-full w-full object-cover" />
        )}
        <div className="absolute inset-0 bg-[rgba(11,10,15,0.45)] backdrop-blur-[2px]" />

        {/* A slow sweep across the photo. Reads as "being examined", which is
            what is actually happening, rather than as a generic spinner. */}
        {phase === 'processing' && (
          <div
            className="pointer-events-none absolute inset-x-0 h-[36%] bg-gradient-to-b from-transparent via-[rgba(124,92,252,0.22)] to-transparent"
            style={{ animation: 'viola-scan 2.4s cubic-bezier(0.4, 0, 0.6, 1) infinite' }}
          />
        )}

        <div className="absolute inset-0 flex flex-col items-center justify-center px-6">
          {score ? (
            <div className="animate-pop flex items-baseline gap-3 rounded-full bg-[var(--color-viola)] px-6 py-3 shadow-[var(--shadow-glow)]">
              <span className="display text-[24px] leading-none text-white">{score.archetype}</span>
              <span className="stat text-[20px] leading-none text-white/75">{score.value}</span>
            </div>
          ) : (
            <>
              <p className="display text-[26px] text-white">
                {phase === 'preparing' ? 'Getting your photo ready' : 'Voilà, almost'}
              </p>
              <p className="mt-2 h-5 text-[13px] text-white/70">
                {stage ? (STAGE_COPY[stage] ?? 'Working on it') : 'Getting started'}
              </p>
            </>
          )}
        </div>
      </div>

      {/* Pieces appear as they resolve. This list filling in is the whole
          reason the wait feels like a reveal instead of a delay. */}
      <ul className="mt-5 flex flex-col gap-2">
        {found.map((item, index) => (
          <li
            key={item.id}
            className="flex items-center gap-3 rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-surface)] px-4 py-3"
            style={{ animation: `viola-rise 380ms var(--ease-gentle) ${index * 70}ms both` }}
          >
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--color-viola-soft)]">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M5 12.5 10 17.5 19 7"
                  stroke="var(--color-viola)"
                  strokeWidth="2.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            <span className="label-caps truncate text-white">{item.label}</span>
          </li>
        ))}
      </ul>

      {slug && phase === 'done' && (
        <p className="mt-5 text-center text-[13px] text-[var(--color-text-tertiary)]">
          Taking you to your look…
        </p>
      )}
    </div>
  );
}

/**
 * Downscales in the browser before upload.
 *
 * The server re-processes anyway, but a phone photo is several megabytes and
 * uploading it whole is the slowest part of the flow on a mobile connection.
 */
async function downscale(file: File): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size < 2_000_000) return file;

    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);

    const context = canvas.getContext('2d');
    if (!context) return file;
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', 0.88),
    );
    return blob ?? file;
  } catch {
    // Any failure here just means we upload the original.
    return file;
  }
}
