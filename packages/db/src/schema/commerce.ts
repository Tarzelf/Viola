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
import { users } from './identity.js';
import { lookItems, looks } from './looks.js';

const id = () =>
  uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`);
const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();
const updatedAt = () => timestamp('updated_at', { withTimezone: true }).notNull().defaultNow();

/**
 * The global product cache.
 *
 * This table is the main cost control in the whole system. Product search runs
 * about $0.005 a query, and popular items recur constantly — a thousand people
 * post the same viral sneaker. Keying on a normalised query hash means that
 * sneaker is resolved once for everyone, not once per look.
 *
 * Not scoped to a user. That is the point.
 */
export const products = pgTable(
  'products',
  {
    id: id(),
    /** sha256 of the normalised search query. The cache key. */
    queryHash: text('query_hash').notNull(),
    normalisedQuery: text('normalised_query').notNull(),

    brand: text('brand'),
    title: text('title').notNull(),
    description: text('description'),

    /**
     * Re-hosted in our own storage. Search providers return hotlinked CDN
     * thumbnails that expire and block cross-origin reads, which would break
     * both the share card and the OG image.
     */
    imagePath: text('image_path'),
    imageSourceUrl: text('image_source_url'),
    /** True once the white catalogue background has been trimmed. */
    imageTrimmed: boolean('image_trimmed').notNull().default(false),

    /** Retailer name as reported by the search provider. */
    source: text('source'),
    merchantUrl: text('merchant_url').notNull(),
    priceCents: integer('price_cents'),
    currency: text('currency').notNull().default('USD'),
    rating: real('rating'),
    reviewCount: integer('review_count'),

    /** Cheap staleness check — prices move. */
    refreshedAt: timestamp('refreshed_at', { withTimezone: true }).notNull().defaultNow(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('products_query_hash_key').on(t.queryHash),
    index('products_brand_idx').on(t.brand),
    index('products_refreshed_idx').on(t.refreshedAt),
  ],
);

/**
 * Alternate places to buy the same thing.
 *
 * 75% of the target audience say sustainability matters more than brand name
 * and roughly half of younger shoppers' apparel spend goes to resale. So
 * secondhand and cheaper equivalents are modelled as first-class offers, not
 * bolted on later.
 */
export const productOffers = pgTable(
  'product_offers',
  {
    id: id(),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    retailer: text('retailer').notNull(),
    url: text('url').notNull(),
    priceCents: integer('price_cents'),
    currency: text('currency').notNull().default('USD'),
    imagePath: text('image_path'),
    isSecondhand: boolean('is_secondhand').notNull().default(false),
    /** Set when this is a cheaper equivalent rather than the same item. */
    isDupe: boolean('is_dupe').notNull().default(false),
    rank: integer('rank').notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [index('product_offers_product_idx').on(t.productId, t.rank)],
);

/**
 * Every outbound tap lands here first, then redirects.
 *
 * Routing through our own `/go/:id` rather than linking straight out means the
 * affiliate network is a swappable implementation detail, we own the click
 * analytics regardless of provider, and attribution survives iOS stripping
 * client-side URL parameters.
 */
export const affiliateClicks = pgTable(
  'affiliate_clicks',
  {
    id: id(),
    lookItemId: uuid('look_item_id').references(() => lookItems.id, { onDelete: 'set null' }),
    lookId: uuid('look_id').references(() => looks.id, { onDelete: 'set null' }),
    productId: uuid('product_id').references(() => products.id, { onDelete: 'set null' }),
    /** Null for guests — a share recipient can shop without an account. */
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    guestId: text('guest_id'),

    /** noop | sovrn | skimlinks */
    provider: text('provider').notNull(),
    /** Where we actually sent them, after any affiliate wrapping. */
    targetUrl: text('target_url').notNull(),
    /** Bare merchant URL, before wrapping. */
    merchantUrl: text('merchant_url').notNull(),
    /** Our tracking id, echoed back by the network on conversion. */
    trackingId: text('tracking_id').notNull(),

    /** Hashed, never raw — these are only for abuse detection. */
    ipHash: text('ip_hash'),
    userAgentHash: text('user_agent_hash'),

    clickedAt: timestamp('clicked_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('affiliate_clicks_tracking_id_key').on(t.trackingId),
    index('affiliate_clicks_look_idx').on(t.lookId, t.clickedAt.desc()),
    index('affiliate_clicks_user_idx').on(t.userId, t.clickedAt.desc()),
  ],
);

/** Revenue events reconciled back from the affiliate network. */
export const affiliateTransactions = pgTable(
  'affiliate_transactions',
  {
    id: id(),
    provider: text('provider').notNull(),
    providerTransactionId: text('provider_transaction_id').notNull(),
    /** Matched via our tracking id, so commission attributes to a real look. */
    clickId: uuid('click_id').references(() => affiliateClicks.id, { onDelete: 'set null' }),
    merchant: text('merchant'),
    orderValueCents: integer('order_value_cents'),
    commissionCents: integer('commission_cents'),
    currency: text('currency').notNull().default('USD'),
    /** pending | confirmed | reversed */
    status: text('status').notNull().default('pending'),
    occurredAt: timestamp('occurred_at', { withTimezone: true }),
    raw: jsonb('raw'),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex('affiliate_txn_provider_key').on(t.provider, t.providerTransactionId),
    index('affiliate_txn_click_idx').on(t.clickId),
  ],
);

/**
 * Sponsored placements.
 *
 * The brief asked for ads that look "incredibly clean, very premium". No
 * third-party ad SDK can deliver that — the creative is out of our control, and
 * it drags in an ATT prompt and a privacy manifest. So the ad unit is a real
 * look card, served from our own table, marked Sponsored, shown to free users
 * only.
 */
export const sponsoredPlacements = pgTable(
  'sponsored_placements',
  {
    id: id(),
    brandName: text('brand_name').notNull(),
    headline: text('headline').notNull(),
    body: text('body'),
    imagePath: text('image_path').notNull(),
    ctaLabel: text('cta_label').notNull().default('Shop'),
    targetUrl: text('target_url').notNull(),

    /** Position in the feed: shown after every Nth organic card. */
    frequency: integer('frequency').notNull().default(7),
    isActive: boolean('is_active').notNull().default(true),
    startsAt: timestamp('starts_at', { withTimezone: true }),
    endsAt: timestamp('ends_at', { withTimezone: true }),

    impressionCount: integer('impression_count').notNull().default(0),
    clickCount: integer('click_count').notNull().default(0),

    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('sponsored_active_idx').on(t.isActive, t.startsAt, t.endsAt)],
);
