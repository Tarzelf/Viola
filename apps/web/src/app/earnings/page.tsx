import Link from 'next/link';
import { redirect } from 'next/navigation';
import { formatPrice } from '@viola/core';
import { AppShell } from '@/components/app-shell';
import { getViewer } from '@/lib/identity';
import { db } from '@/lib/db';
import { mediaUrl } from '@/lib/media';
import { formatCount } from '@/lib/format';
import { getEarnings, topEarningLooks } from '@/lib/reconciliation';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Earnings' };

/**
 * Creator earnings.
 *
 * The queries have existed since reconciliation shipped; this is the surface
 * that turns "commission matched to looks" into something a creator can open
 * after they share a fit that sells. Kept calm: confirmed first, pending
 * second, no charts that invite anxiety.
 */
export default async function EarningsPage() {
  const viewer = await getViewer();
  if (!viewer.userId) redirect('/signin?next=/earnings');

  const database = await db();
  const [summary, top] = await Promise.all([
    getEarnings(database, { userId: viewer.userId }),
    topEarningLooks(database, { userId: viewer.userId, limit: 8 }),
  ]);

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-[640px] pt-4">
        <p className="label-caps text-[var(--color-text-tertiary)]">Creator</p>
        <h1 className="display mt-1 text-[34px] leading-tight text-white">Earnings</h1>
        <p className="mt-2 max-w-md text-[14px] leading-relaxed text-[var(--color-text-secondary)]">
          When someone shops a piece from your look, retailers pay a commission.
          It never costs your friends more.
        </p>

        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Stat
            label="Confirmed"
            value={formatPrice(summary.confirmedCents)}
            emphasis
          />
          <Stat label="Pending" value={formatPrice(summary.pendingCents)} />
          <Stat
            label="Clicks"
            value={formatCount(summary.clickCount)}
            className="col-span-2 sm:col-span-1"
          />
        </div>

        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 px-1">
          <span className="stat text-[12px] text-[var(--color-text-tertiary)]">
            EPC {formatPrice(summary.epcCents)} / 100 clicks
          </span>
          {summary.reversedCents > 0 && (
            <span className="stat text-[12px] text-[var(--color-text-tertiary)]">
              Reversed {formatPrice(summary.reversedCents)}
            </span>
          )}
          <span className="stat text-[12px] text-[var(--color-text-tertiary)]">
            {summary.orderCount} orders tracked
          </span>
        </div>

        <section className="mt-10">
          <h2 className="display text-[22px] text-white">Looks that earn</h2>
          <p className="mt-1 text-[13px] text-[var(--color-text-secondary)]">
            Ranked by confirmed + pending commission attributed to your looks.
          </p>

          {top.length === 0 ? (
            <div className="surface mt-5 px-5 py-12 text-center">
              <h2 className="display text-[22px] text-white">Nothing attributed yet</h2>
              <p className="mt-2 text-[14px] text-[var(--color-text-secondary)]">
                Post a look, share it, and commissions land here when friends shop.
              </p>
              <Link
                href="/new"
                className="mt-5 inline-block rounded-full bg-[var(--color-viola)] px-4 py-2.5 text-[13px] font-semibold text-white"
              >
                Post a fit
              </Link>
            </div>
          ) : (
            <ul className="mt-5 divide-y divide-[var(--color-hairline)] overflow-hidden rounded-[var(--radius-xl)] border border-[var(--color-hairline)] bg-[var(--color-surface)]">
              {top.map((row) => (
                <li key={row.lookId ?? row.slug}>
                  <Link
                    href={row.slug ? `/l/${row.slug}` : '#'}
                    className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-white/[0.03]"
                  >
                    <div className="relative h-14 w-11 shrink-0 overflow-hidden rounded-[8px] bg-white/5">
                      {row.photoPath ? (
                        <img
                          src={mediaUrl(row.photoPath)}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14px] font-medium text-white">
                        {row.slug ? `/${row.slug}` : 'Look'}
                      </p>
                      <p className="stat mt-0.5 text-[12px] text-[var(--color-text-tertiary)]">
                        {formatCount(Number(row.clicks))} shop taps
                      </p>
                    </div>
                    <span className="stat text-[14px] text-white">
                      {formatPrice(Number(row.commissionCents))}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <p className="mt-8 text-[12px] leading-relaxed text-[var(--color-text-tertiary)]">
          Pending commissions confirm on the retailer's return window — usually
          30 to 90 days. Numbers here update when the affiliate network reports.
        </p>
      </div>
    </AppShell>
  );
}

function Stat({
  label,
  value,
  emphasis,
  className,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
  className?: string;
}) {
  return (
    <div
      className={[
        'rounded-[var(--radius-xl)] border border-[var(--color-hairline)] px-4 py-4',
        emphasis ? 'bg-[var(--color-viola-soft)]' : 'bg-[var(--color-surface)]',
        className ?? '',
      ].join(' ')}
    >
      <p className="label-caps text-[var(--color-text-tertiary)]">{label}</p>
      <p
        className={[
          'stat mt-2 text-[22px]',
          emphasis ? 'text-[var(--color-viola-text)]' : 'text-white',
        ].join(' ')}
      >
        {value}
      </p>
    </div>
  );
}
