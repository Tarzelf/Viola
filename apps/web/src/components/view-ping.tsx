'use client';

import { useEffect, useRef } from 'react';

/**
 * Records a view once per mount.
 *
 * Client-side rather than during render for two reasons: server components
 * re-run on navigation and would double-count, and a write during render is
 * exactly the kind of side effect that makes caching impossible later.
 *
 * The endpoint dedupes properly on the server anyway; this just avoids the
 * pointless request.
 */
export function ViewPing({
  slug,
  source,
  referrerHandle,
}: {
  slug: string;
  source: string;
  referrerHandle?: string;
}) {
  const sent = useRef(false);

  useEffect(() => {
    if (sent.current) return;
    sent.current = true;

    void fetch(`/api/looks/${slug}/view`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ source, referrerHandle }),
      keepalive: true,
    }).catch(() => {});
  }, [slug, source, referrerHandle]);

  return null;
}
