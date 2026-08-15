import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { DangerZone } from '@/components/danger-zone';
import { getViewer } from '@/lib/identity';
import { db } from '@/lib/db';
import { getEntitlements, getQuota } from '@/lib/entitlements';
import { getProfileForUser } from '@/lib/queries';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Settings' };

export default async function SettingsPage() {
  const viewer = await getViewer();
  if (!viewer.userId) redirect('/signin?next=/settings');

  const database = await db();
  const [profile, entitlements, quota] = await Promise.all([
    getProfileForUser(viewer.userId),
    getEntitlements(database, viewer.userId),
    getQuota(database, viewer.userId),
  ]);

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-[520px] pt-4">
        <h1 className="display text-[34px] leading-tight text-white">Settings</h1>

        <section className="surface mt-6 px-5 py-5">
          <p className="label-caps text-[var(--color-text-tertiary)]">Account</p>
          <p className="mt-2 text-[16px] font-semibold text-white">@{profile?.handle}</p>
          <p className="mt-1 text-[13px] text-[var(--color-text-secondary)]">
            {entitlements.tier === 'plus' ? 'Viola Plus' : 'Free plan'}
            {Number.isFinite(quota.limit) &&
              ` · ${quota.remaining} of ${quota.limit} looks left this week`}
          </p>
          {entitlements.tier === 'free' && (
            <Link
              href="/plus"
              className="mt-4 inline-block rounded-full bg-[var(--color-viola)] px-4 py-2.5 text-[13px] font-semibold text-white"
            >
              Get Viola Plus
            </Link>
          )}
        </section>

        <section className="surface mt-4 px-5 py-5">
          <p className="label-caps text-[var(--color-text-tertiary)]">Creator</p>
          <Link
            href="/earnings"
            className="mt-2 block text-[14px] text-[var(--color-viola-text)] hover:underline"
          >
            Earnings dashboard
          </Link>
        </section>

        <section className="surface mt-4 px-5 py-5">
          <p className="label-caps text-[var(--color-text-tertiary)]">Your data</p>
          <p className="mt-2 text-[13px] leading-relaxed text-[var(--color-text-secondary)]">
            Location data is stripped from every photo before it is stored. We never keep raw IP
            addresses.
          </p>
          <a
            href="/api/account"
            className="mt-4 inline-block rounded-full border border-[var(--color-hairline)] px-4 py-2.5 text-[13px] font-medium text-white transition-colors hover:border-[rgba(124,92,252,0.4)]"
          >
            Download my data
          </a>
        </section>

        <section className="surface mt-4 px-5 py-5">
          <p className="label-caps text-[var(--color-text-tertiary)]">Help</p>
          <Link
            href="/contact"
            className="mt-2 block text-[14px] text-[var(--color-viola-text)] hover:underline"
          >
            Contact us
          </Link>
        </section>

        <DangerZone />
      </div>
    </AppShell>
  );
}
