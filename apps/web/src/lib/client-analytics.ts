/**
 * Client-side event emitter.
 *
 * Posts to our own endpoint rather than loading the PostHog browser SDK. Three
 * reasons: no third-party script on the critical path of a share page, no
 * cookie banner implications from an extra vendor, and the server already
 * knows who the viewer is so the client never has to pass identity.
 *
 * Fire and forget, always. Never make someone wait on telemetry.
 */
export function emit(event: string, props: Record<string, unknown> = {}): void {
  if (typeof window === 'undefined') return;

  void fetch('/api/events', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ event, props }),
    keepalive: true,
  }).catch(() => {});
}
