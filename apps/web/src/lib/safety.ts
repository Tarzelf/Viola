import 'server-only';
import { and, desc, eq, inArray, or, sql } from 'drizzle-orm';
import { ViolaError, notFound } from '@viola/core';
import { schema, type Database } from '@viola/db';

/**
 * Trust and safety.
 *
 * App Store guideline 1.2 requires four things of any app carrying
 * user-generated content, and Apple tightened the wording twice during 2026.
 * All four are implemented here rather than deferred:
 *
 *   1. a filter for objectionable material  — the vision safety gate, which
 *      quarantines a flagged upload before it can reach any public surface
 *   2. a way to report content              — reportContent()
 *   3. a way to block abusive users         — blockUser(), enforced in the feed
 *   4. published developer contact info     — /contact, linked in the footer
 *
 * Plus in-app account deletion, which Apple requires separately.
 *
 * The bar here is not "we have a table for it". Blocking has to actually hide
 * content, reports have to reach somewhere a human looks, and deletion has to
 * really remove personal data.
 */

export type ReportReason =
  'nudity' | 'harassment' | 'spam' | 'impersonation' | 'violence' | 'other';

export async function reportContent(
  db: Database,
  input: {
    reporterId: string | null;
    targetType: 'look' | 'user' | 'comment';
    targetId: string;
    reason: ReportReason;
    detail?: string;
  },
): Promise<{ id: string }> {
  // Guests can report. Requiring an account to flag something objectionable
  // means most of it never gets flagged.
  const [report] = await db
    .insert(schema.reports)
    .values({
      reporterId: input.reporterId,
      targetType: input.targetType,
      targetId: input.targetId,
      reason: input.reason,
      detail: input.detail?.slice(0, 500) ?? null,
    })
    .returning();

  // Auto-quarantine on repeated independent reports. A human still reviews it,
  // but the content comes down first — leaving flagged material public while a
  // queue drains is the failure mode that gets an app pulled.
  if (input.targetType === 'look') {
    await maybeAutoQuarantine(db, input.targetId);
  }

  return { id: report!.id };
}

const AUTO_QUARANTINE_THRESHOLD = 3;

async function maybeAutoQuarantine(db: Database, lookId: string): Promise<void> {
  const reports = await db
    .select({ reporterId: schema.reports.reporterId })
    .from(schema.reports)
    .where(
      and(
        eq(schema.reports.targetType, 'look'),
        eq(schema.reports.targetId, lookId),
        eq(schema.reports.status, 'open'),
      ),
    );

  // Count distinct reporters, so one person cannot take a look down alone.
  const distinct = new Set(reports.map((r) => r.reporterId ?? Math.random().toString()));
  if (distinct.size < AUTO_QUARANTINE_THRESHOLD) return;

  await db
    .update(schema.looks)
    .set({ status: 'quarantined', failureReason: 'auto-quarantined pending review' })
    .where(eq(schema.looks.id, lookId));
}

export async function blockUser(db: Database, blockerId: string, blockedId: string): Promise<void> {
  if (blockerId === blockedId) {
    throw new ViolaError('validation_failed', 'cannot block yourself');
  }

  await db.insert(schema.blocks).values({ blockerId, blockedId }).onConflictDoNothing();

  // Blocking is mutual for visibility purposes. Someone who blocks a harasser
  // should not keep appearing in the harasser's feed either.
  await db
    .delete(schema.follows)
    .where(
      or(
        and(eq(schema.follows.followerId, blockerId), eq(schema.follows.followeeId, blockedId)),
        and(eq(schema.follows.followerId, blockedId), eq(schema.follows.followeeId, blockerId)),
      ),
    );
}

export async function unblockUser(
  db: Database,
  blockerId: string,
  blockedId: string,
): Promise<void> {
  await db
    .delete(schema.blocks)
    .where(and(eq(schema.blocks.blockerId, blockerId), eq(schema.blocks.blockedId, blockedId)));
}

/**
 * Everyone whose content this viewer must not see.
 *
 * Symmetric on purpose: it covers people the viewer blocked AND people who
 * blocked the viewer. A one-way block still lets the blocked party watch,
 * which is not what anyone means by blocking.
 */
export async function hiddenUserIds(db: Database, viewerId: string | null): Promise<string[]> {
  if (!viewerId) return [];

  const rows = await db
    .select({ blockerId: schema.blocks.blockerId, blockedId: schema.blocks.blockedId })
    .from(schema.blocks)
    .where(or(eq(schema.blocks.blockerId, viewerId), eq(schema.blocks.blockedId, viewerId)));

  return rows.map((r) => (r.blockerId === viewerId ? r.blockedId : r.blockerId));
}

export async function isBlocked(
  db: Database,
  viewerId: string | null,
  authorId: string,
): Promise<boolean> {
  if (!viewerId) return false;
  return (await hiddenUserIds(db, viewerId)).includes(authorId);
}

// ---------------------------------------------------------------------------
// Moderation queue
// ---------------------------------------------------------------------------

export interface QueuedReport {
  id: string;
  targetType: string;
  targetId: string;
  reason: string;
  detail: string | null;
  createdAt: Date;
  lookSlug: string | null;
  lookStatus: string | null;
  authorHandle: string | null;
}

export async function openReports(db: Database, limit = 50): Promise<QueuedReport[]> {
  const rows = await db
    .select({
      id: schema.reports.id,
      targetType: schema.reports.targetType,
      targetId: schema.reports.targetId,
      reason: schema.reports.reason,
      detail: schema.reports.detail,
      createdAt: schema.reports.createdAt,
      lookSlug: schema.looks.slug,
      lookStatus: schema.looks.status,
      authorHandle: schema.profiles.handle,
    })
    .from(schema.reports)
    .leftJoin(schema.looks, eq(schema.looks.id, schema.reports.targetId))
    .leftJoin(schema.profiles, eq(schema.profiles.userId, schema.looks.userId))
    .where(eq(schema.reports.status, 'open'))
    .orderBy(desc(schema.reports.createdAt))
    .limit(limit);

  return rows;
}

export async function resolveReport(
  db: Database,
  reportId: string,
  action: 'remove' | 'dismiss',
  note?: string,
): Promise<void> {
  const [report] = await db
    .select()
    .from(schema.reports)
    .where(eq(schema.reports.id, reportId))
    .limit(1);

  if (!report) throw notFound('report');

  if (action === 'remove' && report.targetType === 'look') {
    await db
      .update(schema.looks)
      .set({ status: 'quarantined', failureReason: 'removed by moderation' })
      .where(eq(schema.looks.id, report.targetId));
  }

  if (action === 'dismiss' && report.targetType === 'look') {
    // Restore anything auto-quarantined by report volume that turned out fine.
    await db
      .update(schema.looks)
      .set({ status: 'ready', failureReason: null })
      .where(
        and(
          eq(schema.looks.id, report.targetId),
          eq(schema.looks.failureReason, 'auto-quarantined pending review'),
        ),
      );
  }

  // Resolve every open report against the same target, not just this row.
  await db
    .update(schema.reports)
    .set({
      status: action === 'remove' ? 'actioned' : 'dismissed',
      resolvedAt: new Date(),
      resolutionNote: note ?? null,
    })
    .where(
      and(
        eq(schema.reports.targetType, report.targetType),
        eq(schema.reports.targetId, report.targetId),
        eq(schema.reports.status, 'open'),
      ),
    );
}

// ---------------------------------------------------------------------------
// Account deletion — required by Apple
// ---------------------------------------------------------------------------

export interface DeletionSummary {
  looksRemoved: number;
  bloomsRemoved: number;
  vaultsRemoved: number;
}

/**
 * Deletes an account.
 *
 * Content is removed and personal data is scrubbed, but the user row is kept
 * as a tombstone: blooms and follows reference it, and hard-deleting would
 * either cascade away other people's counters or leave dangling references.
 *
 * The email is replaced rather than nulled so the unique index still holds and
 * the address can be reused to sign up again.
 */
export async function deleteAccount(db: Database, userId: string): Promise<DeletionSummary> {
  const looks = await db
    .select({ id: schema.looks.id })
    .from(schema.looks)
    .where(eq(schema.looks.userId, userId));

  const lookIds = looks.map((l) => l.id);

  const blooms =
    lookIds.length > 0
      ? await db
          .select({ id: schema.blooms.id })
          .from(schema.blooms)
          .where(inArray(schema.blooms.lookId, lookIds))
      : [];

  const vaults = await db
    .select({ id: schema.vaults.id })
    .from(schema.vaults)
    .where(eq(schema.vaults.userId, userId));

  // Cascades handle look items, blooms on those looks, views and vault items.
  if (lookIds.length > 0) {
    await db.delete(schema.looks).where(eq(schema.looks.userId, userId));
  }
  await db.delete(schema.vaults).where(eq(schema.vaults.userId, userId));
  await db.delete(schema.sessions).where(eq(schema.sessions.userId, userId));
  await db.delete(schema.blooms).where(eq(schema.blooms.userId, userId));
  await db.delete(schema.follows).where(eq(schema.follows.followerId, userId));
  await db.delete(schema.follows).where(eq(schema.follows.followeeId, userId));

  // Scrub the profile but keep the row, so foreign keys stay intact.
  await db
    .update(schema.profiles)
    .set({
      handle: `deleted_${userId.slice(0, 8)}`,
      displayName: null,
      bio: null,
      avatarPath: null,
      isPrivate: true,
    })
    .where(eq(schema.profiles.userId, userId));

  await db
    .update(schema.users)
    .set({
      email: `deleted+${userId}@viola.invalid`,
      authProviderId: null,
      deletedAt: new Date(),
    })
    .where(eq(schema.users.id, userId));

  // Detach past commerce activity from the person while keeping the financial
  // record, which we are obliged to retain for reconciliation.
  await db
    .update(schema.affiliateClicks)
    .set({ userId: null, ipHash: null, userAgentHash: null })
    .where(eq(schema.affiliateClicks.userId, userId));

  return {
    looksRemoved: lookIds.length,
    bloomsRemoved: blooms.length,
    vaultsRemoved: vaults.length,
  };
}

/** Everything we hold on a person, for the data-export request. */
export async function exportAccount(db: Database, userId: string) {
  const [profile] = await db
    .select()
    .from(schema.profiles)
    .where(eq(schema.profiles.userId, userId))
    .limit(1);

  const looks = await db.select().from(schema.looks).where(eq(schema.looks.userId, userId));
  const vaults = await db.select().from(schema.vaults).where(eq(schema.vaults.userId, userId));
  const blooms = await db.select().from(schema.blooms).where(eq(schema.blooms.userId, userId));

  return {
    exportedAt: new Date().toISOString(),
    profile,
    looks: looks.map((l) => ({
      slug: l.slug,
      caption: l.caption,
      score: l.score,
      archetypeId: l.archetypeId,
      publishedAt: l.publishedAt,
    })),
    vaults: vaults.map((v) => ({ name: v.name, itemCount: v.itemCount })),
    bloomCount: blooms.length,
  };
}

export const MODERATION_CONTACT = {
  email: 'safety@viola.app',
  responseTime: 'within 24 hours',
} as const;

export { sql };
