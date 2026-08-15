/**
 * Typed application errors, so route handlers can translate a domain failure
 * into the right status code without a pile of string matching.
 */

export type ViolaErrorCode =
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'validation_failed'
  | 'rate_limited'
  | 'quota_exceeded'
  | 'payment_required'
  | 'conflict'
  | 'provider_failed'
  | 'spend_cap_reached'
  | 'content_quarantined'
  | 'internal';

const STATUS: Record<ViolaErrorCode, number> = {
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  validation_failed: 422,
  rate_limited: 429,
  quota_exceeded: 429,
  payment_required: 402,
  conflict: 409,
  provider_failed: 502,
  spend_cap_reached: 503,
  content_quarantined: 451,
  internal: 500,
};

export class ViolaError extends Error {
  readonly code: ViolaErrorCode;
  readonly status: number;
  readonly details?: unknown;
  /** Safe to show a user verbatim. Everything else stays in the logs. */
  readonly publicMessage: string;

  constructor(
    code: ViolaErrorCode,
    message: string,
    options?: { publicMessage?: string; details?: unknown; cause?: unknown },
  ) {
    super(message, options?.cause ? { cause: options.cause } : undefined);
    this.name = 'ViolaError';
    this.code = code;
    this.status = STATUS[code];
    this.details = options?.details;
    this.publicMessage = options?.publicMessage ?? DEFAULT_PUBLIC_MESSAGE[code];
  }

  toJSON() {
    return { error: { code: this.code, message: this.publicMessage, details: this.details } };
  }
}

/**
 * User-facing copy. Written in the product's voice — short, human, never
 * blaming the user for something the system did.
 */
const DEFAULT_PUBLIC_MESSAGE: Record<ViolaErrorCode, string> = {
  unauthorized: 'Sign in to continue.',
  forbidden: "You don't have access to that.",
  not_found: "We couldn't find that.",
  validation_failed: "Something in that request didn't look right.",
  rate_limited: 'Slow down a second — try again shortly.',
  quota_exceeded: "You've used all your looks this week.",
  payment_required: 'That one needs Viola Plus.',
  conflict: 'That already exists.',
  provider_failed: "We couldn't reach one of our services. Try again in a moment.",
  spend_cap_reached: "We're at capacity right now. Back shortly.",
  content_quarantined: "That upload didn't pass our content check.",
  internal: 'Something went wrong on our side.',
};

export const unauthorized = (m = 'unauthorized') => new ViolaError('unauthorized', m);
export const forbidden = (m = 'forbidden') => new ViolaError('forbidden', m);
export const notFound = (m = 'not found') => new ViolaError('not_found', m);
export const conflict = (m = 'conflict') => new ViolaError('conflict', m);

export function isViolaError(e: unknown): e is ViolaError {
  return e instanceof ViolaError;
}
