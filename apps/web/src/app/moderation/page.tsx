import { notFound } from 'next/navigation';
import Link from 'next/link';
import { AppShell } from '@/components/app-shell';
import { ModerationActions } from '@/components/moderation-actions';
import { getViewer } from '@/lib/identity';
import { db } from '@/lib/db';
import { openReports } from '@/lib/safety';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Moderation' };

/**
 * The internal review queue.
 *
 * Guideline 1.2 wants reports to reach somewhere a human looks, so there has to
 * be a place they land. Access is restricted to addresses listed in
 * VIOLA_MODERATOR_EMAILS; with none configured the page 404s rather than being
 * open, because a moderation console that fails open is worse than none.
 */
export default async function ModerationPage() {
  const viewer = await getViewer();
  if (!viewer.userId) notFound();

  const database = await db();
  const { schema } = await import('@viola/db');
  const { eq } = await import('drizzle-orm');

  const [user] = await database
    .select({ email: schema.users.email })
    .from(schema.users)
    .where(eq(schema.users.id, viewer.userId))
    .limit(1);

  const moderators = (process.env.VIOLA_MODERATOR_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  if (moderators.length === 0 || !user || !moderators.includes(user.email.toLowerCase())) {
    notFound();
  }

  const reports = await openReports(database);

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-[720px] pt-4">
        <h1 className="display text-[34px] leading-tight text-white">Moderation</h1>
        <p className="mt-1.5 text-[14px] text-[var(--color-text-secondary)]">
          {reports.length} open {reports.length === 1 ? 'report' : 'reports'}
        </p>

        {reports.length === 0 ? (
          <div className="surface mt-6 px-6 py-14 text-center">
            <p className="text-[15px] text-[var(--color-text-secondary)]">Queue is clear.</p>
          </div>
        ) : (
          <ul className="mt-6 flex flex-col gap-3">
            {reports.map((report) => (
              <li
                key={report.id}
                className="rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-surface)] p-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="label-caps text-[var(--color-danger)]">{report.reason}</p>
                    <p className="mt-1.5 text-[14px] text-white">
                      {report.targetType} by @{report.authorHandle ?? 'unknown'}
                      {report.lookStatus === 'quarantined' && (
                        <span className="ml-2 rounded-full bg-[rgba(242,112,127,0.16)] px-2 py-0.5 text-[11px] text-[var(--color-danger)]">
                          held
                        </span>
                      )}
                    </p>
                    {report.detail && (
                      <p className="mt-1 text-[13px] text-[var(--color-text-secondary)]">
                        {report.detail}
                      </p>
                    )}
                    {report.lookSlug && (
                      <Link
                        href={`/l/${report.lookSlug}`}
                        className="mt-1.5 inline-block text-[12px] text-[var(--color-viola)] hover:underline"
                      >
                        View look
                      </Link>
                    )}
                  </div>
                  <ModerationActions reportId={report.id} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AppShell>
  );
}
