import 'server-only';
import { createHash, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import { and, desc, eq, gt, isNull, sql } from 'drizzle-orm';
import { DEFAULT_VAULT_NAME, ViolaError, suggestHandle } from '@viola/core';
import { schema, type Database } from '@viola/db';

/**
 * Email one-time-code authentication.
 *
 * No passwords. The audience is on a phone, and a six-digit code is a much
 * shorter path than inventing and remembering a password — it also means we
 * never store one.
 *
 * Codes and session tokens are both stored hashed, so a database leak does not
 * hand anyone a working credential.
 */

const CODE_TTL_MS = 10 * 60 * 1000;
const SESSION_TTL_MS = 365 * 24 * 60 * 60 * 1000;
const MAX_ATTEMPTS = 5;
/** Codes requested per email inside this window before we start refusing. */
const REQUEST_WINDOW_MS = 15 * 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 5;

const hash = (value: string) => createHash('sha256').update(value).digest('hex');

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}

export interface RequestCodeResult {
  /**
   * Only ever populated when no email provider is configured, so the flow is
   * usable in development and in tests. Never returned once real email is set
   * up — see the guard in the route handler.
   */
  devCode?: string;
}

export async function requestCode(
  db: Database,
  input: { email: string; guestId?: string | null },
): Promise<RequestCodeResult> {
  const email = normaliseEmail(input.email);

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    throw new ViolaError('validation_failed', 'invalid email', {
      publicMessage: "That doesn't look like an email address.",
    });
  }

  const since = new Date(Date.now() - REQUEST_WINDOW_MS);
  const recent = await db
    .select({ id: schema.authCodes.id })
    .from(schema.authCodes)
    .where(and(eq(schema.authCodes.email, email), gt(schema.authCodes.createdAt, since)));

  if (recent.length >= MAX_REQUESTS_PER_WINDOW) {
    throw new ViolaError('rate_limited', 'too many code requests');
  }

  const code = String(randomInt(0, 1_000_000)).padStart(6, '0');

  await db.insert(schema.authCodes).values({
    email,
    codeHash: hash(code),
    expiresAt: new Date(Date.now() + CODE_TTL_MS),
    guestId: input.guestId ?? null,
  });

  return { devCode: code };
}

export interface VerifyResult {
  userId: string;
  handle: string;
  token: string;
  isNewAccount: boolean;
  claimed: { blooms: number };
}

export async function verifyCode(
  db: Database,
  input: { email: string; code: string; guestId?: string | null; userAgent?: string | null },
): Promise<VerifyResult> {
  const email = normaliseEmail(input.email);

  const [record] = await db
    .select()
    .from(schema.authCodes)
    .where(and(eq(schema.authCodes.email, email), isNull(schema.authCodes.consumedAt)))
    .orderBy(desc(schema.authCodes.createdAt))
    .limit(1);

  if (!record) {
    throw new ViolaError('unauthorized', 'no pending code', {
      publicMessage: 'Request a new code to continue.',
    });
  }

  if (record.expiresAt < new Date()) {
    throw new ViolaError('unauthorized', 'code expired', {
      publicMessage: 'That code has expired. Request a new one.',
    });
  }

  if (record.attempts >= MAX_ATTEMPTS) {
    throw new ViolaError('rate_limited', 'too many attempts', {
      publicMessage: 'Too many tries. Request a new code.',
    });
  }

  if (!safeEqual(hash(input.code.trim()), record.codeHash)) {
    await db
      .update(schema.authCodes)
      .set({ attempts: sql`${schema.authCodes.attempts} + 1` })
      .where(eq(schema.authCodes.id, record.id));

    throw new ViolaError('unauthorized', 'wrong code', {
      publicMessage: "That code didn't match.",
    });
  }

  await db
    .update(schema.authCodes)
    .set({ consumedAt: new Date() })
    .where(eq(schema.authCodes.id, record.id));

  const { userId, handle, isNewAccount } = await findOrCreateUser(db, email);

  // Claim anything this device did before signing up. Losing a guest's blooms
  // at the moment they commit to an account would be a strange reward for
  // converting, and it is the whole point of letting them act signed-out.
  const guestId = input.guestId ?? record.guestId;
  const claimed = guestId ? await claimGuestActivity(db, guestId, userId) : { blooms: 0 };

  const token = randomBytes(32).toString('base64url');
  await db.insert(schema.sessions).values({
    userId,
    tokenHash: hash(token),
    expiresAt: new Date(Date.now() + SESSION_TTL_MS),
    userAgent: input.userAgent ?? null,
  });

  return { userId, handle, token, isNewAccount, claimed };
}

async function findOrCreateUser(
  db: Database,
  email: string,
): Promise<{ userId: string; handle: string; isNewAccount: boolean }> {
  const [existing] = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.email, email))
    .limit(1);

  if (existing) {
    const [profile] = await db
      .select({ handle: schema.profiles.handle })
      .from(schema.profiles)
      .where(eq(schema.profiles.userId, existing.id))
      .limit(1);

    // Reactivate a soft-deleted account on sign-in rather than stranding it.
    await db
      .update(schema.users)
      .set({ deletedAt: null, emailVerifiedAt: new Date() })
      .where(eq(schema.users.id, existing.id));

    return { userId: existing.id, handle: profile?.handle ?? 'viola_user', isNewAccount: false };
  }

  const [user] = await db
    .insert(schema.users)
    .values({ email, emailVerifiedAt: new Date() })
    .returning();

  const handle = await uniqueHandle(db, suggestHandle(email.split('@')[0] ?? 'viola'));

  await db.insert(schema.profiles).values({ userId: user!.id, handle });

  // Everyone gets the single free vault. Named, undeletable, and the thing the
  // paywall later extends rather than unlocks.
  await db.insert(schema.vaults).values({
    userId: user!.id,
    name: DEFAULT_VAULT_NAME,
    slug: `v-${randomBytes(8).toString('base64url').toLowerCase()}`,
    isDefault: true,
  });

  return { userId: user!.id, handle, isNewAccount: true };
}

async function uniqueHandle(db: Database, base: string): Promise<string> {
  for (let attempt = 0; attempt < 25; attempt++) {
    const candidate = attempt === 0 ? base : `${base}${attempt + 1}`;
    const [taken] = await db
      .select({ id: schema.profiles.id })
      .from(schema.profiles)
      .where(eq(schema.profiles.handle, candidate))
      .limit(1);
    if (!taken) return candidate;
  }
  return `${base}_${randomBytes(3).toString('hex')}`;
}

/**
 * Moves a guest's activity onto their new account.
 *
 * A guest may already have bloomed a look that the account they are creating
 * has also bloomed — unlikely, but the unique index makes it fatal rather than
 * merely odd — so conflicting rows are dropped instead of upserted.
 */
export async function claimGuestActivity(
  db: Database,
  guestId: string,
  userId: string,
): Promise<{ blooms: number }> {
  const guestBlooms = await db
    .select({ id: schema.blooms.id, lookId: schema.blooms.lookId })
    .from(schema.blooms)
    .where(and(eq(schema.blooms.guestId, guestId), isNull(schema.blooms.userId)));

  let claimed = 0;

  for (const bloom of guestBlooms) {
    const [alreadyOwned] = await db
      .select({ id: schema.blooms.id })
      .from(schema.blooms)
      .where(and(eq(schema.blooms.lookId, bloom.lookId), eq(schema.blooms.userId, userId)))
      .limit(1);

    if (alreadyOwned) {
      // The account already bloomed this look. Drop the duplicate and leave the
      // counter alone — it was already counted once.
      await db.delete(schema.blooms).where(eq(schema.blooms.id, bloom.id));
      continue;
    }

    await db
      .update(schema.blooms)
      .set({ userId, guestId: null })
      .where(eq(schema.blooms.id, bloom.id));
    claimed++;
  }

  await db
    .update(schema.affiliateClicks)
    .set({ userId, guestId: null })
    .where(and(eq(schema.affiliateClicks.guestId, guestId), isNull(schema.affiliateClicks.userId)));

  return { blooms: claimed };
}

export async function resolveSession(
  db: Database,
  token: string | null,
): Promise<{ userId: string } | null> {
  if (!token) return null;

  const [session] = await db
    .select({
      id: schema.sessions.id,
      userId: schema.sessions.userId,
      expiresAt: schema.sessions.expiresAt,
    })
    .from(schema.sessions)
    .where(eq(schema.sessions.tokenHash, hash(token)))
    .limit(1);

  if (!session || session.expiresAt < new Date()) return null;

  const [user] = await db
    .select({ deletedAt: schema.users.deletedAt })
    .from(schema.users)
    .where(eq(schema.users.id, session.userId))
    .limit(1);

  if (!user || user.deletedAt) return null;

  return { userId: session.userId };
}

export async function revokeSession(db: Database, token: string): Promise<void> {
  await db.delete(schema.sessions).where(eq(schema.sessions.tokenHash, hash(token)));
}

/** Terminates every device. Used by sign-out-everywhere and account deletion. */
export async function revokeAllSessions(db: Database, userId: string): Promise<void> {
  await db.delete(schema.sessions).where(eq(schema.sessions.userId, userId));
}
