import { sql } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

/**
 * NOTE ON UUID DEFAULTS
 *
 * We use `gen_random_uuid()`, which is built into Postgres 13+ core. We
 * deliberately do NOT `create extension pgcrypto` anywhere: PGlite (our local
 * and CI database) has no pgcrypto, and requiring it would mean dev and CI
 * could not run without Docker. Verified during planning.
 */
const id = () =>
  uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`);

const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();
const updatedAt = () => timestamp('updated_at', { withTimezone: true }).notNull().defaultNow();

export const users = pgTable(
  'users',
  {
    id: id(),
    email: text('email').notNull(),
    /** Mirrors the Supabase Auth user id when auth is wired up. */
    authProviderId: text('auth_provider_id'),
    emailVerifiedAt: timestamp('email_verified_at', { withTimezone: true }),
    /** Set on account deletion. PII is scrubbed; rows are retained so that
     *  counters and foreign keys stay intact. Apple requires in-app deletion. */
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('users_email_key').on(t.email),
    uniqueIndex('users_auth_provider_id_key').on(t.authProviderId),
  ],
);

export const profiles = pgTable(
  'profiles',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    handle: text('handle').notNull(),
    displayName: text('display_name'),
    avatarPath: text('avatar_path'),
    bio: text('bio'),
    /**
     * Denormalised counters. Follower count is deliberately NOT surfaced on the
     * profile header — it is kept for ranking and for the creator's own
     * dashboard only. Public follower counts are a primary driver of the
     * comparison harm the ICP research warns about, and this product has no
     * need for them.
     */
    followerCount: integer('follower_count').notNull().default(0),
    lookCount: integer('look_count').notNull().default(0),
    /** Public and monotonically positive — safe to show. */
    totalBloomsReceived: integer('total_blooms_received').notNull().default(0),
    isPrivate: boolean('is_private').notNull().default(false),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('profiles_handle_key').on(t.handle),
    uniqueIndex('profiles_user_id_key').on(t.userId),
  ],
);

export const follows = pgTable(
  'follows',
  {
    followerId: uuid('follower_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    followeeId: uuid('followee_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: createdAt(),
  },
  (t) => [
    primaryKey({ columns: [t.followerId, t.followeeId] }),
    index('follows_followee_idx').on(t.followeeId),
  ],
);

/**
 * Blocking. Required by App Store guideline 1.2 for any app carrying
 * user-generated content — alongside a content filter, reporting, and published
 * contact info. Not optional, and not a phase-two nicety.
 */
export const blocks = pgTable(
  'blocks',
  {
    blockerId: uuid('blocker_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    blockedId: uuid('blocked_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: createdAt(),
  },
  (t) => [
    primaryKey({ columns: [t.blockerId, t.blockedId] }),
    index('blocks_blocked_idx').on(t.blockedId),
  ],
);

export const reports = pgTable(
  'reports',
  {
    id: id(),
    reporterId: uuid('reporter_id').references(() => users.id, { onDelete: 'set null' }),
    targetType: text('target_type').notNull(),
    targetId: uuid('target_id').notNull(),
    reason: text('reason').notNull(),
    detail: text('detail'),
    /** open | actioned | dismissed */
    status: text('status').notNull().default('open'),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    resolutionNote: text('resolution_note'),
    metadata: jsonb('metadata'),
    createdAt: createdAt(),
  },
  (t) => [
    index('reports_status_idx').on(t.status, t.createdAt),
    index('reports_target_idx').on(t.targetType, t.targetId),
  ],
);
