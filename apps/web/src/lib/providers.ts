import 'server-only';
import { describeProviders, resolveProviders, type Providers } from '@viola/pipeline';

/**
 * Provider singleton.
 *
 * Logged once at boot so the active configuration is never a mystery — the
 * most confusing possible failure mode is not knowing whether you are looking
 * at mock data or live data.
 */

const globalForProviders = globalThis as unknown as { violaProviders?: Providers };

export function providers(): Providers {
  if (!globalForProviders.violaProviders) {
    globalForProviders.violaProviders = resolveProviders();
    console.info(`[viola] providers: ${describeProviders(globalForProviders.violaProviders)}`);
  }
  return globalForProviders.violaProviders;
}
