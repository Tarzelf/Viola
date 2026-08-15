import { sql } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { users } from './identity';
import { lookItems, looks } from './looks';
import { products } from './commerce';

const id = () =>
  uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`);
const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();
const updatedAt = () => timestamp('updated_at', { withTimezone: true }).notNull().defaultNow();

/**
 * Vaults — the paid feature, per the brief: "that capability of saving stuff in
 * their own folders should cost money".
 *
 * Free accounts get exactly one, called "Saved", capped at 20 items. Plus
 * unlocks unlimited named vaults. The paywall sits on *accumulation*, never on
 * posting or sharing, because throttling the social loop would throttle growth.
 */
export const vaults = pgTable(
  'vaults',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    /** Shareable as a lookbook: viola.app/v/<slug> */
    slug: text('slug').notNull(),
    coverLookId: uuid('cover_look_id').references(() => looks.id, { onDelete: 'set null' }),
    /** The single free vault. Cannot be deleted or renamed away. */
    isDefault: boolean('is_default').notNull().default(false),
    isPublic: boolean('is_public').notNull().default(false),
    itemCount: integer('item_count').notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('vaults_slug_key').on(t.slug),
    index('vaults_user_idx').on(t.userId, t.createdAt.desc()),
    // At most one default vault per user.
    uniqueIndex('vaults_one_default_per_user')
      .on(t.userId)
      .where(sql`${t.isDefault}`),
  ],
);

/**
 * A vault can hold a whole look, a single tagged item, or a bare product.
 * Exactly one of the three is set; enforced by a check constraint.
 */
export const vaultItems = pgTable(
  'vault_items',
  {
    id: id(),
    vaultId: uuid('vault_id')
      .notNull()
      .references(() => vaults.id, { onDelete: 'cascade' }),
    lookId: uuid('look_id').references(() => looks.id, { onDelete: 'cascade' }),
    lookItemId: uuid('look_item_id').references(() => lookItems.id, { onDelete: 'cascade' }),
    productId: uuid('product_id').references(() => products.id, { onDelete: 'cascade' }),
    note: text('note'),
    position: integer('position').notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [
    index('vault_items_vault_idx').on(t.vaultId, t.position),
    uniqueIndex('vault_items_unique_look').on(t.vaultId, t.lookId),
    uniqueIndex('vault_items_unique_item').on(t.vaultId, t.lookItemId),
    uniqueIndex('vault_items_unique_product').on(t.vaultId, t.productId),
  ],
);
