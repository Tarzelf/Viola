'use client';

import { useEffect, useState } from 'react';
import { emit } from '@/lib/client-analytics';

/**
 * The share row.
 *
 * Two decisions here come straight from the growth research:
 *
 * 1. **Messages gets its own button.** The iOS share sheet is materially higher
 *    friction than Android's, and burying the highest-intent channel behind a
 *    generic sheet costs conversions. `sms:&body=` opens Messages with the text
 *    already written.
 *
 * 2. **Nothing is generated on tap.** The link and the message copy are both
 *    prepared ahead of time. Every step between the impulse and the send costs
 *    15-30% of shares, and a spinner is a step.
 */

interface ShareRowProps {
  slug: string;
  url: string;
  handle: string;
  archetype: string | null;
  score: number | null;
}

export function ShareRow({ slug, url, handle, archetype, score }: ShareRowProps) {
  const [copied, setCopied] = useState(false);

  const absolute = url.startsWith('http')
    ? url
    : typeof window !== 'undefined'
      ? `${window.location.origin}/l/${slug}`
      : `/l/${slug}`;

  const message =
    archetype && score != null
      ? `rate my fit 👀 ${archetype} ${score} — ${absolute}`
      : `rate my fit 👀 ${absolute}`;

  // Step one: the user is now looking at something worth sharing. Emitted on
  // mount because reaching this component IS reaching the trigger.
  useEffect(() => {
    emit('share_trigger_reached', { lookId: slug });
  }, [slug]);

  function track(channel: string) {
    // Two distinct steps: they engaged a share affordance, and a share left
    // the device. Measuring only the second cannot tell a bad CTA from a bad
    // sheet.
    emit('share_opened', { lookId: slug, entry: 'look_page' });

    // Fire and forget: never make the user wait on analytics to share.
    void fetch(`/api/looks/${slug}/share`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ channel }),
    }).catch(() => {});
  }

  async function handleSystemShare() {
    track('system_sheet');
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title: `@${handle} on Viola`, text: message, url: absolute });
        return;
      } catch {
        // User dismissed the sheet; not an error worth surfacing.
        return;
      }
    }
    await handleCopy();
  }

  async function handleCopy() {
    track('copy_link');
    try {
      await navigator.clipboard.writeText(absolute);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard unavailable — the link is visible in the address bar anyway */
    }
  }

  return (
    <div className="mt-5 flex items-center gap-2">
      <a
        href={`sms:&body=${encodeURIComponent(message)}`}
        onClick={() => track('messages')}
        className="flex flex-1 items-center justify-center gap-2 rounded-full bg-white px-4 py-3 text-[14px] font-semibold text-[var(--color-ink)] transition-transform active:scale-[0.97]"
      >
        <MessageIcon />
        Send to a friend
      </a>

      <button
        type="button"
        onClick={handleSystemShare}
        aria-label="Share"
        className="flex h-[46px] w-[46px] items-center justify-center rounded-full border border-[var(--color-hairline)] text-[var(--color-text-secondary)] transition-colors hover:border-[rgba(124,92,252,0.4)] hover:text-white"
      >
        <ShareIcon />
      </button>

      <button
        type="button"
        onClick={handleCopy}
        aria-label="Copy link"
        className="flex h-[46px] min-w-[46px] items-center justify-center rounded-full border border-[var(--color-hairline)] px-3 text-[12px] font-medium text-[var(--color-text-secondary)] transition-colors hover:border-[rgba(124,92,252,0.4)] hover:text-white"
      >
        {copied ? 'Copied' : <LinkIcon />}
      </button>
    </div>
  );
}

function MessageIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 3c5 0 9 3.3 9 7.4 0 4.1-4 7.4-9 7.4a10 10 0 0 1-2.6-.3L5 19.5l.9-3A6.9 6.9 0 0 1 3 10.4C3 6.3 7 3 12 3Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ShareIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 15V4m0 0L8.5 7.5M12 4l3.5 3.5M5 13v5.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V13"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function LinkIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M10 13a3.5 3.5 0 0 0 5 0l3-3a3.5 3.5 0 0 0-5-5l-1.5 1.5M14 11a3.5 3.5 0 0 0-5 0l-3 3a3.5 3.5 0 0 0 5 5l1.5-1.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}
