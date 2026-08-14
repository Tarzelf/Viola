import { sql } from 'drizzle-orm';
import { index, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { users } from './identity';

const id = () =>
  uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`);
const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();

/**
 * Email sign-in codes.
 *
 * One-time codes rather than passwords: the audience is on a phone, and a
 * six-digit code from an email is a far shorter path than inventing and
 * remembering yet another password. It also means we never store one.
 *
 * The code itself is stored hashed. A leaked database should not hand someone
 * a working set of live sign-in codes.
 */
export const authCodes = pgTable(
  'auth_codes',
  {
    id: id(),
    email: text('email').notNull(),
    codeHash: text('code_hash').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    consumedAt: timestamp('consumed_at', { withTimezone: true }),
    /** Brute-force guard: a code is burned after too many wrong guesses. */
    attempts: integer('attempts').notNull().default(0),
    /**
     * The device that requested the code. On successful sign-in, anything this
     * guest did — blooms especially — is claimed onto the new account rather
     * than discarded.
     */
    guestId: text('guest_id'),
    createdAt: createdAt(),
  },
  (t) => [
    index('auth_codes_email_idx').on(t.email, t.createdAt.desc()),
    index('auth_codes_expiry_idx').on(t.expiresAt),
  ],
);

/**
 * Sessions.
 *
 * Stored rather than purely cookie-signed so sign-out actually revokes, and so
 * account deletion can terminate every device immediately — both of which
 * Apple expects and neither of which a stateless token gives you.
 */
export const sessions = pgTable(
  'sessions',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
    userAgent: text('user_agent'),
    createdAt: createdAt(),
  },
  (t) => [index('sessions_token_idx').on(t.tokenHash), index('sessions_user_idx').on(t.userId)],
);
