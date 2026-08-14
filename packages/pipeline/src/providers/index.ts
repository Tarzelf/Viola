import {
  NoopAffiliateProvider,
  ResilientAffiliateProvider,
  SovrnAffiliateProvider,
} from './affiliate/index.js';
import { MockProductSearchProvider } from './product/mock.js';
import { SerpApiProductSearchProvider } from './product/serpapi.js';
import {
  LocalFsStorageProvider,
  MemoryStorageProvider,
  SupabaseStorageProvider,
} from './storage/index.js';
import { GeminiVisionProvider } from './vision/gemini.js';
import { MockVisionProvider } from './vision/mock.js';
import type { ProviderMode, Providers } from './types.js';

export * from './types.js';
export * from './vision/mock.js';
export * from './vision/gemini.js';
export * from './product/mock.js';
export * from './product/serpapi.js';
export * from './affiliate/index.js';
export * from './storage/index.js';

/**
 * Provider resolution.
 *
 * The default everywhere is `mock`. That is a deliberate choice rather than a
 * testing convenience: it means a fresh clone runs the complete product with no
 * accounts, no keys and no spend, and CI can exercise the whole pipeline for
 * free. Going live is per-provider, so the vision model can be real while
 * product search is still mocked.
 *
 * A live provider whose key is missing falls back to its mock with a warning
 * rather than crashing the process. Half a product beats a boot loop.
 */

export interface ResolveOptions {
  env?: NodeJS.ProcessEnv;
  /** Overrides for tests. */
  overrides?: Partial<Providers>;
}

function modeFor(env: NodeJS.ProcessEnv, key: string): ProviderMode {
  const specific = env[key];
  const global = env.VIOLA_PROVIDERS;
  const value = (specific ?? global ?? 'mock').toLowerCase();
  return value === 'live' ? 'live' : 'mock';
}

function warn(provider: string, missing: string): void {
  console.warn(
    `[viola] ${provider} requested live mode but ${missing} is not set — falling back to mock.`,
  );
}

export function resolveProviders(options: ResolveOptions = {}): Providers {
  const env = options.env ?? process.env;

  // --- vision --------------------------------------------------------------
  let vision: Providers['vision'] = new MockVisionProvider();
  if (modeFor(env, 'VIOLA_VISION_PROVIDER') === 'live') {
    if (env.GEMINI_API_KEY) {
      vision = new GeminiVisionProvider({ apiKey: env.GEMINI_API_KEY });
    } else {
      warn('vision', 'GEMINI_API_KEY');
    }
  }

  // --- product search ------------------------------------------------------
  let products: Providers['products'] = new MockProductSearchProvider();
  if (modeFor(env, 'VIOLA_PRODUCT_PROVIDER') === 'live') {
    if (env.SERPAPI_API_KEY) {
      products = new SerpApiProductSearchProvider({ apiKey: env.SERPAPI_API_KEY });
    } else {
      warn('product search', 'SERPAPI_API_KEY');
    }
  }

  // --- affiliate -----------------------------------------------------------
  // Noop is a legitimate production configuration, not a placeholder: links go
  // direct, clicks are still tracked, and the product is complete before any
  // affiliate account has been approved.
  let affiliate: Providers['affiliate'] = new NoopAffiliateProvider();
  if (modeFor(env, 'VIOLA_AFFILIATE_PROVIDER') === 'live') {
    if (env.SOVRN_API_KEY) {
      affiliate = new ResilientAffiliateProvider(
        new SovrnAffiliateProvider({ apiKey: env.SOVRN_API_KEY }),
      );
    } else {
      warn('affiliate', 'SOVRN_API_KEY');
    }
  }

  // --- storage -------------------------------------------------------------
  let storage: Providers['storage'] = new LocalFsStorageProvider();
  if (modeFor(env, 'VIOLA_STORAGE_PROVIDER') === 'live') {
    const url = env.NEXT_PUBLIC_SUPABASE_URL;
    const key = env.SUPABASE_SERVICE_ROLE_KEY;
    if (url && key) {
      storage = new SupabaseStorageProvider({
        url,
        serviceRoleKey: key,
        bucket: env.SUPABASE_STORAGE_BUCKET ?? 'viola',
      });
    } else {
      warn('storage', 'NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY');
    }
  }

  return { vision, products, affiliate, storage, ...options.overrides };
}

/** Fully in-memory provider set for tests. */
export function mockProviders(overrides: Partial<Providers> = {}): Providers {
  return {
    vision: new MockVisionProvider(),
    products: new MockProductSearchProvider(),
    affiliate: new NoopAffiliateProvider(),
    storage: new MemoryStorageProvider(),
    ...overrides,
  };
}

/** Human-readable summary, logged at boot so the active config is never a mystery. */
export function describeProviders(providers: Providers): string {
  return [
    `vision=${providers.vision.name}`,
    `products=${providers.products.name}`,
    `affiliate=${providers.affiliate.name}`,
    `storage=${providers.storage.name}`,
  ].join(' ');
}
