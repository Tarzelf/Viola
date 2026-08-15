import type { ProductCandidate, VisionResult } from '@viola/core';

/**
 * Provider interfaces.
 *
 * Every external dependency in the pipeline sits behind one of these, and every
 * one ships a mock implementation backed by committed fixtures. That is what
 * lets the whole app build, run and test with zero API keys — which in turn is
 * what makes it verifiable in CI and on a fresh clone.
 *
 * It also means the affiliate network, the product search vendor and the vision
 * model are all swappable without touching the orchestrator. Given the brief's
 * uncertainty about which affiliate programme to sign up for, that matters.
 */

export interface ProviderMeta {
  /** Identifier recorded on rows we persist, e.g. 'mock' | 'gemini'. */
  readonly name: string;
  /** Rough per-call cost, used by the spend cap. Zero for mocks. */
  readonly costCents: number;
}

// ---------------------------------------------------------------------------
// Vision — the one thing that genuinely cannot be done locally
// ---------------------------------------------------------------------------

export interface VisionRequest {
  image: Buffer;
  mimeType: string;
  /** Hint from the client, e.g. 'mirror selfie'. Optional. */
  hint?: string;
}

export interface VisionProvider extends ProviderMeta {
  analyse(request: VisionRequest): Promise<VisionResult>;
}

// ---------------------------------------------------------------------------
// Product search — "where to buy"
// ---------------------------------------------------------------------------

export interface ProductSearchRequest {
  query: string;
  /** Narrows the search when a logo was legible. */
  brand?: string | null;
  limit?: number;
}

export interface ProductSearchProvider extends ProviderMeta {
  search(request: ProductSearchRequest): Promise<ProductCandidate[]>;
}

// ---------------------------------------------------------------------------
// Affiliate
// ---------------------------------------------------------------------------

export interface AffiliateWrapRequest {
  merchantUrl: string;
  /** Our own id, echoed back by the network on conversion so commission can be
   *  attributed to a specific look and item. */
  trackingId: string;
}

export interface AffiliateProvider extends ProviderMeta {
  /**
   * Returns the URL to send the shopper to. Implementations that cannot
   * monetise a given merchant must return the original URL rather than throw —
   * a broken shop link is far worse than an unmonetised one.
   */
  wrap(request: AffiliateWrapRequest): Promise<string>;
}

// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------

export interface StorageProvider extends ProviderMeta {
  put(path: string, data: Buffer, contentType: string): Promise<string>;
  get(path: string): Promise<Buffer | null>;
  /** A URL the browser can load. May be signed. */
  publicUrl(path: string): string;
  exists(path: string): Promise<boolean>;
  remove(path: string): Promise<void>;
}

// ---------------------------------------------------------------------------
// Bundle
// ---------------------------------------------------------------------------

export interface Providers {
  vision: VisionProvider;
  products: ProductSearchProvider;
  affiliate: AffiliateProvider;
  storage: StorageProvider;
}

export type ProviderMode = 'mock' | 'live';
