import { sql } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import type { BBox, LookLayout, ScoreBreakdown } from '@viola/core';
import { users } from './identity';

const id = () =>
  uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`);
const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();
const updatedAt = () => timestamp('updated_at', { withTimezone: true }).notNull().defaultNow();

export const looks = pgTable(
  'looks',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** The string that ends up in a group chat: viola.app/l/<slug> */
    slug: text('slug').notNull(),

    photoPath: text('photo_path').notNull(),
    photoWidth: integer('photo_width'),
    photoHeight: integer('photo_height'),
    /** Tiny inline placeholder so the feed never flashes an empty box. */
    photoBlurhash: text('photo_blurhash'),

    /** draft | processing | ready | failed | quarantined */
    status: text('status').notNull().default('processing'),
    failureReason: text('failure_reason'),

    caption: text('caption'),
    /** public | unlisted | private */
    visibility: text('visibility').notNull().default('public'),

    // --- rating -------------------------------------------------------------
    score: integer('score'),
    scoreBreakdown: jsonb('score_breakdown').$type<ScoreBreakdown>(),
    archetypeId: text('archetype_id'),
    styleTags: jsonb('style_tags').$type<string[]>().default([]),

    /** Computed entirely locally — see the layout engine. */
    layout: jsonb('layout').$type<LookLayout>(),

    // --- generated share assets ---------------------------------------------
    storyCardPath: text('story_card_path'),
    ogCardPath: text('og_card_path'),
    squareCardPath: text('square_card_path'),

    // --- public counters: both monotonically positive, by design ------------
    viewCount: integer('view_count').notNull().default(0),
    bloomCount: integer('bloom_count').notNull().default(0),

    publishedAt: timestamp('published_at', { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('looks_slug_key').on(t.slug),
    index('looks_user_created_idx').on(t.userId, t.createdAt.desc()),
    // Feed reads: only ready + public looks, newest first.
    index('looks_feed_idx').on(t.status, t.visibility, t.publishedAt.desc()),
    // Top of the Week.
    index('looks_top_idx').on(t.status, t.visibility, t.bloomCount.desc()),
  ],
);

export const lookItems = pgTable(
  'look_items',
  {
    id: id(),
    lookId: uuid('look_id')
      .notNull()
      .references(() => looks.id, { onDelete: 'cascade' }),
    /** Display order, 0-based. */
    rank: integer('rank').notNull(),
    isPrimary: boolean('is_primary').notNull().default(true),

    category: text('category').notNull(),
    subtype: text('subtype').notNull(),
    /**
     * Null when no logo was visible. The vision prompt demands null over a
     * guess, and nothing downstream may invent one — a wrong brand is the
     * fastest way to lose a user's trust in the whole feature.
     */
    brand: text('brand'),
    title: text('title'),
    description: text('description'),
    colors: jsonb('colors').$type<string[]>().default([]),
    pattern: text('pattern'),
    material: text('material'),

    bbox: jsonb('bbox').$type<BBox>().notNull(),
    confidence: real('confidence').notNull().default(0),

    /** What we sent to the product search provider. */
    searchQuery: text('search_query'),
    /** Null when resolution failed — the item still renders, just without a
     *  buy link. Partial failure must never break a card. */
    productId: uuid('product_id'),

    /** True once a human corrected the match; protects it from re-resolution. */
    isUserCorrected: boolean('is_user_corrected').notNull().default(false),

    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index('look_items_look_rank_idx').on(t.lookId, t.rank),
    index('look_items_product_idx').on(t.productId),
  ],
);

/**
 * Blooms — the only reaction in the product. There is no downvote, and there
 * will not be one.
 *
 * `userId` is nullable on purpose: a share recipient must be able to bloom
 * without an account. Removing that auth wall is the single biggest lever on
 * the viral coefficient, so guests are first-class citizens here and get
 * stitched to a real account on signup via `guestId`.
 */
export const blooms = pgTable(
  'blooms',
  {
    id: id(),
    lookId: uuid('look_id')
      .notNull()
      .references(() => looks.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
    /** Signed device identifier for guests. */
    guestId: text('guest_id'),
    createdAt: createdAt(),
  },
  (t) => [
    // One bloom per account per look.
    uniqueIndex('blooms_look_user_key').on(t.lookId, t.userId),
    // And one per guest device per look.
    uniqueIndex('blooms_look_guest_key').on(t.lookId, t.guestId),
    index('blooms_look_idx').on(t.lookId, t.createdAt.desc()),
    index('blooms_user_idx').on(t.userId),
  ],
);

/**
 * Views. The user explicitly asked to track these, and they are safe to show
 * publicly because they only ever go up.
 *
 * Deduped by a hash of viewer identity within a rolling window rather than
 * counting raw hits, so a number shown to a creator means something.
 */
export const lookViews = pgTable(
  'look_views',
  {
    id: id(),
    lookId: uuid('look_id')
      .notNull()
      .references(() => looks.id, { onDelete: 'cascade' }),
    /** Hash of user id or guest id — never a raw IP. */
    viewerHash: text('viewer_hash').notNull(),
    /** feed | share_link | profile | vault | og_preview */
    source: text('source').notNull().default('feed'),
    /** Handle of whoever shared the link, for referrer context and attribution. */
    referrerHandle: text('referrer_handle'),
    createdAt: createdAt(),
  },
  (t) => [
    index('look_views_look_idx').on(t.lookId, t.createdAt.desc()),
    // Supports the dedupe-window lookup.
    index('look_views_dedupe_idx').on(t.lookId, t.viewerHash, t.createdAt.desc()),
  ],
);
