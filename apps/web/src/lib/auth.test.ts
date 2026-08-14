import { and, eq, isNull } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { schema, type DbHandle } from '@viola/db';
import { createTestDb, truncateAll } from '@viola/db/testing';
import {
  claimGuestActivity,
  normaliseEmail,
  requestCode,
  resolveSession,
  revokeAllSessions,
  revokeSession,
  verifyCode,
} from './auth';

let handle: DbHandle;

beforeEach(async () => {
  handle ??= await createTestDb();
  await truncateAll(handle);
});

afterAll(async () => {
  await handle?.close();
});

const db = () => handle.db;

async function signIn(email: string, guestId?: string) {
  const { devCode } = await requestCode(db(), { email, guestId });
  return verifyCode(db(), { email, code: devCode!, guestId });
}

describe('requesting a code', () => {
  it('issues a six-digit code', async () => {
    const { devCode } = await requestCode(db(), { email: 'maya@example.com' });
    expect(devCode).toMatch(/^\d{6}$/);
  });

  it('never stores the code in plain text', async () => {
    // A database leak must not hand anyone a set of working sign-in codes.
    const { devCode } = await requestCode(db(), { email: 'maya@example.com' });
    const [row] = await db().select().from(schema.authCodes);
    expect(row!.codeHash).not.toBe(devCode);
    expect(row!.codeHash).toHaveLength(64);
  });

  it('rejects a malformed email', async () => {
    await expect(requestCode(db(), { email: 'not-an-email' })).rejects.toThrow();
  });

  it('rate limits repeated requests for the same address', async () => {
    for (let i = 0; i < 5; i++) await requestCode(db(), { email: 'spam@example.com' });
    await expect(requestCode(db(), { email: 'spam@example.com' })).rejects.toThrow();
  });

  it('treats addresses case-insensitively', () => {
    expect(normaliseEmail('  Maya@Example.COM ')).toBe('maya@example.com');
  });
});

describe('verifying a code', () => {
  it('creates an account, profile and default vault on first sign-in', async () => {
    const result = await signIn('new@example.com');

    expect(result.isNewAccount).toBe(true);
    expect(result.handle).toBe('new');

    const vaults = await db().select().from(schema.vaults);
    expect(vaults).toHaveLength(1);
    expect(vaults[0]!.isDefault).toBe(true);
    expect(vaults[0]!.name).toBe('Saved');
  });

  it('returns the same account on a second sign-in', async () => {
    const first = await signIn('repeat@example.com');
    const second = await signIn('repeat@example.com');

    expect(second.isNewAccount).toBe(false);
    expect(second.userId).toBe(first.userId);
    expect(await db().select().from(schema.users)).toHaveLength(1);
  });

  it('gives a second person with a clashing name a distinct handle', async () => {
    const a = await signIn('maya@example.com');
    const b = await signIn('maya@other.com');
    expect(a.handle).toBe('maya');
    expect(b.handle).not.toBe('maya');
  });

  it('rejects the wrong code and counts the attempt', async () => {
    await requestCode(db(), { email: 'x@example.com' });
    await expect(verifyCode(db(), { email: 'x@example.com', code: '000000' })).rejects.toThrow();

    const [row] = await db().select().from(schema.authCodes);
    expect(row!.attempts).toBe(1);
  });

  it('burns a code after too many wrong guesses', async () => {
    const { devCode } = await requestCode(db(), { email: 'brute@example.com' });
    for (let i = 0; i < 5; i++) {
      await expect(
        verifyCode(db(), { email: 'brute@example.com', code: '111111' }),
      ).rejects.toThrow();
    }
    // Even the correct code no longer works.
    await expect(
      verifyCode(db(), { email: 'brute@example.com', code: devCode! }),
    ).rejects.toThrow();
  });

  it('cannot reuse a consumed code', async () => {
    const { devCode } = await requestCode(db(), { email: 'once@example.com' });
    await verifyCode(db(), { email: 'once@example.com', code: devCode! });
    await expect(verifyCode(db(), { email: 'once@example.com', code: devCode! })).rejects.toThrow();
  });

  it('rejects an expired code', async () => {
    await requestCode(db(), { email: 'stale@example.com' });
    await db()
      .update(schema.authCodes)
      .set({ expiresAt: new Date(Date.now() - 1000) });

    await expect(
      verifyCode(db(), { email: 'stale@example.com', code: '123456' }),
    ).rejects.toThrow();
  });
});

describe('claiming guest activity', () => {
  async function seedLook() {
    const [user] = await db()
      .insert(schema.users)
      .values({ email: `a${Math.random()}@x.com` })
      .returning();
    await db()
      .insert(schema.profiles)
      .values({ userId: user!.id, handle: `h${Math.random().toString(36).slice(2, 9)}` });
    const [look] = await db()
      .insert(schema.looks)
      .values({
        userId: user!.id,
        slug: Math.random().toString(36).slice(2, 12).padEnd(10, 'a'),
        photoPath: 'p.jpg',
        status: 'ready',
      })
      .returning();
    return look!;
  }

  it('moves a guest bloom onto the new account', async () => {
    // Losing someone's blooms at the exact moment they commit to an account
    // would be a strange reward for converting, and it undermines the whole
    // reason guests are allowed to act at all.
    const look = await seedLook();
    await db().insert(schema.blooms).values({ lookId: look.id, guestId: 'guest-1' });

    const result = await signIn('claimer@example.com', 'guest-1');
    expect(result.claimed.blooms).toBe(1);

    const [bloom] = await db().select().from(schema.blooms);
    expect(bloom!.userId).toBe(result.userId);
    expect(bloom!.guestId).toBeNull();
  });

  it('claims several blooms at once', async () => {
    const a = await seedLook();
    const b = await seedLook();
    await db()
      .insert(schema.blooms)
      .values([
        { lookId: a.id, guestId: 'guest-2' },
        { lookId: b.id, guestId: 'guest-2' },
      ]);

    const result = await signIn('many@example.com', 'guest-2');
    expect(result.claimed.blooms).toBe(2);
  });

  it('drops a duplicate rather than violating the one-per-account index', async () => {
    // The account already bloomed this look on another device. Upserting would
    // hit the unique index and fail the whole sign-in.
    const look = await seedLook();
    const existing = await signIn('dup@example.com');
    await db().insert(schema.blooms).values({ lookId: look.id, userId: existing.userId });
    await db().insert(schema.blooms).values({ lookId: look.id, guestId: 'guest-3' });

    const claimed = await claimGuestActivity(db(), 'guest-3', existing.userId);

    expect(claimed.blooms).toBe(0);
    const rows = await db().select().from(schema.blooms);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.userId).toBe(existing.userId);
  });

  it('leaves other guests alone', async () => {
    const look = await seedLook();
    await db()
      .insert(schema.blooms)
      .values([
        { lookId: look.id, guestId: 'mine' },
        { lookId: look.id, guestId: 'someone-else' },
      ]);

    await signIn('me@example.com', 'mine');

    const orphaned = await db()
      .select()
      .from(schema.blooms)
      .where(and(eq(schema.blooms.guestId, 'someone-else'), isNull(schema.blooms.userId)));
    expect(orphaned).toHaveLength(1);
  });

  it('claims prior affiliate clicks too', async () => {
    const look = await seedLook();
    await db().insert(schema.affiliateClicks).values({
      lookId: look.id,
      guestId: 'shopper',
      provider: 'noop',
      targetUrl: 'https://x.com',
      merchantUrl: 'https://x.com',
      trackingId: 't-1',
    });

    const result = await signIn('shopper@example.com', 'shopper');
    const [click] = await db().select().from(schema.affiliateClicks);
    expect(click!.userId).toBe(result.userId);
  });
});

describe('sessions', () => {
  it('resolves a valid token', async () => {
    const result = await signIn('session@example.com');
    expect(await resolveSession(db(), result.token)).toEqual({ userId: result.userId });
  });

  it('rejects an unknown or missing token', async () => {
    expect(await resolveSession(db(), null)).toBeNull();
    expect(await resolveSession(db(), 'made-up')).toBeNull();
  });

  it('never stores the token in plain text', async () => {
    const result = await signIn('hashed@example.com');
    const [row] = await db().select().from(schema.sessions);
    expect(row!.tokenHash).not.toBe(result.token);
  });

  it('actually revokes on sign-out', async () => {
    // The reason sessions live in the database rather than in a self-describing
    // cookie: a stateless token cannot be withdrawn.
    const result = await signIn('out@example.com');
    await revokeSession(db(), result.token);
    expect(await resolveSession(db(), result.token)).toBeNull();
  });

  it('can terminate every device at once', async () => {
    const first = await signIn('multi@example.com');
    const second = await signIn('multi@example.com');

    await revokeAllSessions(db(), first.userId);

    expect(await resolveSession(db(), first.token)).toBeNull();
    expect(await resolveSession(db(), second.token)).toBeNull();
  });

  it('refuses a session belonging to a deleted account', async () => {
    const result = await signIn('gone@example.com');
    await db()
      .update(schema.users)
      .set({ deletedAt: new Date() })
      .where(eq(schema.users.id, result.userId));

    expect(await resolveSession(db(), result.token)).toBeNull();
  });

  it('rejects an expired session', async () => {
    const result = await signIn('expired@example.com');
    await db()
      .update(schema.sessions)
      .set({ expiresAt: new Date(Date.now() - 1000) });

    expect(await resolveSession(db(), result.token)).toBeNull();
  });
});
