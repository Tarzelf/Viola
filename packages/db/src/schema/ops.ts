import { sql } from 'drizzle-orm';
import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  boolean,
} from 'drizzle-orm/pg-core';
import { users } from './identity.js';
import { looks } from './looks.js';

const id = () =>
  uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`);
const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();
const updatedAt = () => timestamp('updated_at', { withTimezone: true }).notNull().defaultNow();

/**
 * Subscriptions.
 *
 * Two platforms, one entitlement. Apple requires in-app digital features to be
 * sold through StoreKit, so iOS goes through RevenueCat and the web goes
 * through Stripe; both write here and `resolveTier` in core decides access.
 */
export const subscriptions = pgTable(
  'subscriptions',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** stripe | apple */
    platform: text('platform').notNull(),
    /** free | plus */
    tier: text('tier').notNull().default('free'),
    /** active | trialing | past_due | canceled | expired */
    status: text('status').notNull(),
    plan: text('plan'),

    externalCustomerId: text('external_customer_id'),
    externalSubscriptionId: text('external_subscription_id'),

    currentPeriodEnd: timestamp('current_period_end', { withTimezone: true }),
    cancelAtPeriodEnd: boolean('cancel_at_period_end').notNull().default(false),

    raw: jsonb('raw'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('subscriptions_user_platform_key').on(t.userId, t.platform),
    index('subscriptions_external_idx').on(t.externalSubscriptionId),
  ],
);

/**
 * Per-user usage, bucketed by ISO week.
 *
 * The free tier allows a handful of AI taggings a week. Each look costs roughly
 * one vision call plus a few product searches, so without a quota a single
 * enthusiastic user can run up real money. Bucketing by week rather than by
 * rolling window keeps the reset legible: "you get 5 a week".
 */
export const usageQuota = pgTable(
  'usage_quota',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** ISO week key, e.g. 2026-W33. */
    period: text('period').notNull(),
    looksTagged: integer('looks_tagged').notNull().default(0),
    searchesUsed: integer('searches_used').notNull().default(0),
    /** Rough attributed spend, for the global cap. */
    estimatedCostCents: integer('estimated_cost_cents').notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex('usage_quota_user_period_key').on(t.userId, t.period)],
);

/** Global daily spend, so a bug or an abuse spike cannot run up an unbounded bill. */
export const spendLedger = pgTable(
  'spend_ledger',
  {
    id: id(),
    /** YYYY-MM-DD, UTC. */
    day: text('day').notNull(),
    provider: text('provider').notNull(),
    calls: integer('calls').notNull().default(0),
    costCents: integer('cost_cents').notNull().default(0),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex('spend_ledger_day_provider_key').on(t.day, t.provider)],
);

/**
 * The pipeline job queue.
 *
 * Postgres-backed rather than an external queue: it keeps local dev and CI
 * dependency-free, gives transactional enqueue alongside the look row, and is
 * more than fast enough at this scale. Every stage is independently retryable
 * and idempotent, so a partial failure still publishes a usable look.
 */
export const jobs = pgTable(
  'jobs',
  {
    id: id(),
    lookId: uuid('look_id')
      .notNull()
      .references(() => looks.id, { onDelete: 'cascade' }),
    stage: text('stage').notNull(),
    /** pending | running | done | failed */
    status: text('status').notNull().default('pending'),
    attempts: integer('attempts').notNull().default(0),
    maxAttempts: integer('max_attempts').notNull().default(4),
    /** Drives exponential backoff on retry. */
    nextRunAt: timestamp('next_run_at', { withTimezone: true }).notNull().defaultNow(),
    startedAt: timestamp('started_at', { withTimezone: true }),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
    lastError: text('last_error'),
    payload: jsonb('payload'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    // The claim query: pending work that is due, oldest first.
    index('jobs_claim_idx').on(t.status, t.nextRunAt),
    index('jobs_look_idx').on(t.lookId),
    uniqueIndex('jobs_look_stage_key').on(t.lookId, t.stage),
  ],
);
