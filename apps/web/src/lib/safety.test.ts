import { eq } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { schema, type DbHandle } from '@viola/db';
import { createTestDb, truncateAll } from '@viola/db/testing';
import {
  blockUser,
  deleteAccount,
  exportAccount,
  hiddenUserIds,
  isBlocked,
  openReports,
  reportContent,
  resolveReport,
  unblockUser,
} from './safety';

let handle: DbHandle;

beforeEach(async () => {
  handle ??= await createTestDb();
  await truncateAll(handle);
});

afterAll(async () => {
  await handle?.close();
});

const db = () => handle.db;

async function makeUser(name = Math.random().toString(36).slice(2, 10)) {
  const [user] = await db()
    .insert(schema.users)
    .values({ email: `${name}@x.com` })
    .returning();
  await db().insert(schema.profiles).values({ userId: user!.id, handle: name });
  return { id: user!.id, handle: name };
}

async function makeLook(userId: string) {
  const [look] = await db()
    .insert(schema.looks)
    .values({
      userId,
      slug: Math.random().toString(36).slice(2, 12).padEnd(10, 'a'),
      photoPath: 'p.jpg',
      status: 'ready',
    })
    .returning();
  return look!;
}

/**
 * App Store guideline 1.2 requires four things of a UGC app. Three of them are
 * exercised here; the fourth (the content filter) is the vision safety gate,
 * covered in the pipeline tests.
 */
describe('guideline 1.2 — reporting', () => {
  it('records a report', async () => {
    const author = await makeUser();
    const reporter = await makeUser();
    const look = await makeLook(author.id);

    await reportContent(db(), {
      reporterId: reporter.id,
      targetType: 'look',
      targetId: look.id,
      reason: 'harassment',
    });

    const reports = await db().select().from(schema.reports);
    expect(reports).toHaveLength(1);
    expect(reports[0]!.status).toBe('open');
  });

  it('accepts a report from a signed-out visitor', async () => {
    // Requiring an account to flag something objectionable means most of it
    // never gets flagged.
    const author = await makeUser();
    const look = await makeLook(author.id);

    await reportContent(db(), {
      reporterId: null,
      targetType: 'look',
      targetId: look.id,
      reason: 'nudity',
    });

    expect(await db().select().from(schema.reports)).toHaveLength(1);
  });

  it('does not let one person take a look down alone', async () => {
    const author = await makeUser();
    const reporter = await makeUser();
    const look = await makeLook(author.id);

    for (let i = 0; i < 5; i++) {
      await reportContent(db(), {
        reporterId: reporter.id,
        targetType: 'look',
        targetId: look.id,
        reason: 'spam',
      });
    }

    const [row] = await db().select().from(schema.looks).where(eq(schema.looks.id, look.id));
    expect(row!.status).toBe('ready');
  });

  it('auto-quarantines after several independent reports', async () => {
    // Leaving flagged material public while a review queue drains is the
    // failure mode that gets an app pulled.
    const author = await makeUser();
    const look = await makeLook(author.id);

    for (let i = 0; i < 3; i++) {
      const reporter = await makeUser();
      await reportContent(db(), {
        reporterId: reporter.id,
        targetType: 'look',
        targetId: look.id,
        reason: 'nudity',
      });
    }

    const [row] = await db().select().from(schema.looks).where(eq(schema.looks.id, look.id));
    expect(row!.status).toBe('quarantined');
  });
});

describe('guideline 1.2 — blocking', () => {
  it('hides the blocked user in both directions', async () => {
    // A one-way block still lets the blocked party watch, which is not what
    // anyone means by blocking.
    const a = await makeUser();
    const b = await makeUser();
    await blockUser(db(), a.id, b.id);

    expect(await hiddenUserIds(db(), a.id)).toContain(b.id);
    expect(await hiddenUserIds(db(), b.id)).toContain(a.id);
    expect(await isBlocked(db(), a.id, b.id)).toBe(true);
    expect(await isBlocked(db(), b.id, a.id)).toBe(true);
  });

  it('severs any follow relationship in both directions', async () => {
    const a = await makeUser();
    const b = await makeUser();
    await db()
      .insert(schema.follows)
      .values([
        { followerId: a.id, followeeId: b.id },
        { followerId: b.id, followeeId: a.id },
      ]);

    await blockUser(db(), a.id, b.id);
    expect(await db().select().from(schema.follows)).toHaveLength(0);
  });

  it('is idempotent', async () => {
    const a = await makeUser();
    const b = await makeUser();
    await blockUser(db(), a.id, b.id);
    await blockUser(db(), a.id, b.id);
    expect(await db().select().from(schema.blocks)).toHaveLength(1);
  });

  it('can be undone', async () => {
    const a = await makeUser();
    const b = await makeUser();
    await blockUser(db(), a.id, b.id);
    await unblockUser(db(), a.id, b.id);
    expect(await hiddenUserIds(db(), a.id)).toHaveLength(0);
  });

  it('refuses self-blocking', async () => {
    const a = await makeUser();
    await expect(blockUser(db(), a.id, a.id)).rejects.toThrow();
  });

  it('returns nothing for a signed-out viewer', async () => {
    expect(await hiddenUserIds(db(), null)).toEqual([]);
  });
});

describe('moderation queue', () => {
  it('lists open reports with context', async () => {
    const author = await makeUser('reported_author');
    const reporter = await makeUser();
    const look = await makeLook(author.id);

    await reportContent(db(), {
      reporterId: reporter.id,
      targetType: 'look',
      targetId: look.id,
      reason: 'spam',
      detail: 'posting the same thing repeatedly',
    });

    const queue = await openReports(db());
    expect(queue).toHaveLength(1);
    expect(queue[0]!.authorHandle).toBe('reported_author');
    expect(queue[0]!.lookSlug).toBe(look.slug);
  });

  it('removing a look quarantines it and closes every report against it', async () => {
    const author = await makeUser();
    const look = await makeLook(author.id);

    const reports = await Promise.all(
      [1, 2].map(async () => {
        const reporter = await makeUser();
        return reportContent(db(), {
          reporterId: reporter.id,
          targetType: 'look',
          targetId: look.id,
          reason: 'harassment',
        });
      }),
    );

    await resolveReport(db(), reports[0]!.id, 'remove', 'clear violation');

    const [row] = await db().select().from(schema.looks).where(eq(schema.looks.id, look.id));
    expect(row!.status).toBe('quarantined');
    expect(await openReports(db())).toHaveLength(0);
  });

  it('dismissing restores something auto-quarantined by report volume', async () => {
    const author = await makeUser();
    const look = await makeLook(author.id);

    let lastId = '';
    for (let i = 0; i < 3; i++) {
      const reporter = await makeUser();
      const report = await reportContent(db(), {
        reporterId: reporter.id,
        targetType: 'look',
        targetId: look.id,
        reason: 'spam',
      });
      lastId = report.id;
    }

    await resolveReport(db(), lastId, 'dismiss', 'brigading, content is fine');

    const [row] = await db().select().from(schema.looks).where(eq(schema.looks.id, look.id));
    expect(row!.status).toBe('ready');
    expect(row!.failureReason).toBeNull();
  });
});

describe('account deletion', () => {
  it('removes content and scrubs personal data', async () => {
    // Apple requires in-app deletion, and it has to actually delete.
    const user = await makeUser('leaving');
    const look = await makeLook(user.id);
    await db()
      .insert(schema.vaults)
      .values({ userId: user.id, name: 'Saved', slug: 'v-leaving', isDefault: true });
    await db()
      .insert(schema.lookItems)
      .values({
        lookId: look.id,
        rank: 0,
        category: 'top',
        subtype: 'tee',
        bbox: [0.1, 0.1, 0.3, 0.3],
      });

    const summary = await deleteAccount(db(), user.id);

    expect(summary.looksRemoved).toBe(1);
    expect(await db().select().from(schema.looks)).toHaveLength(0);
    // Cascade reached the child rows.
    expect(await db().select().from(schema.lookItems)).toHaveLength(0);
    expect(await db().select().from(schema.vaults)).toHaveLength(0);

    const [profile] = await db()
      .select()
      .from(schema.profiles)
      .where(eq(schema.profiles.userId, user.id));
    expect(profile!.handle).not.toBe('leaving');
    expect(profile!.displayName).toBeNull();
    expect(profile!.bio).toBeNull();
  });

  it('leaves no trace of the original email', async () => {
    const user = await makeUser('scrubme');
    await deleteAccount(db(), user.id);

    const [row] = await db().select().from(schema.users).where(eq(schema.users.id, user.id));
    expect(row!.email).not.toContain('scrubme@x.com');
    expect(row!.deletedAt).not.toBeNull();
  });

  it('frees the handle and the email for reuse', async () => {
    const user = await makeUser('reusable');
    await deleteAccount(db(), user.id);

    // The unique indexes must not block someone signing up again.
    await expect(makeUser('reusable')).resolves.toBeDefined();
  });

  it('terminates every session', async () => {
    const user = await makeUser();
    await db()
      .insert(schema.sessions)
      .values({
        userId: user.id,
        tokenHash: 'abc',
        expiresAt: new Date(Date.now() + 86_400_000),
      });

    await deleteAccount(db(), user.id);
    expect(await db().select().from(schema.sessions)).toHaveLength(0);
  });

  it('keeps the financial record but detaches it from the person', async () => {
    const user = await makeUser();
    const look = await makeLook(user.id);
    await db()
      .insert(schema.affiliateClicks)
      .values({
        lookId: look.id,
        userId: user.id,
        provider: 'noop',
        targetUrl: 'https://x.com',
        merchantUrl: 'https://x.com',
        trackingId: `t-${Math.random()}`,
        ipHash: 'somehash',
      });

    await deleteAccount(db(), user.id);

    const [click] = await db().select().from(schema.affiliateClicks);
    expect(click).toBeDefined();
    expect(click!.userId).toBeNull();
    expect(click!.ipHash).toBeNull();
  });

  it('does not disturb other accounts', async () => {
    const leaving = await makeUser();
    const staying = await makeUser();
    await makeLook(staying.id);

    await deleteAccount(db(), leaving.id);

    expect(await db().select().from(schema.looks)).toHaveLength(1);
  });
});

describe('data export', () => {
  it('returns the account’s own data', async () => {
    const user = await makeUser('exporter');
    await makeLook(user.id);

    const data = await exportAccount(db(), user.id);
    expect(data.profile?.handle).toBe('exporter');
    expect(data.looks).toHaveLength(1);
    expect(data.exportedAt).toBeTruthy();
  });
});
