import Link from 'next/link';
import { redirect } from 'next/navigation';
import { formatPrice } from '@viola/core';
import { AppShell } from '@/components/app-shell';
import { NewVaultButton } from '@/components/new-vault-button';
import { getViewer } from '@/lib/identity';
import { mediaUrl } from '@/lib/media';
import { db } from '@/lib/db';
import { listVaults } from '@/lib/vaults';
import { getEntitlements, getVaultUsage } from '@/lib/entitlements';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Vaults' };

export default async function VaultsPage() {
  const viewer = await getViewer();
  if (!viewer.userId) redirect('/signin?next=/vaults');

  const database = await db();
  const [vaults, entitlements, usage] = await Promise.all([
    listVaults(database, viewer.userId),
    getEntitlements(database, viewer.userId),
    getVaultUsage(database, viewer.userId),
  ]);

  const vaultLimit = Number.isFinite(entitlements.maxVaults) ? entitlements.maxVaults : null;
  const saveLimit = Number.isFinite(entitlements.maxSavedItems) ? entitlements.maxSavedItems : null;

  return (
    <AppShell>
      <div className="mb-7 flex items-end justify-between gap-4">
        <div>
          <h1 className="display text-[34px] leading-tight text-white">Vaults</h1>
          <p className="mt-1.5 text-[14px] text-[var(--color-text-secondary)]">
            {saveLimit
              ? `${usage.savedItemCount} of ${saveLimit} pieces saved`
              : `${usage.savedItemCount} pieces saved`}
          </p>
        </div>
        <NewVaultButton
          atLimit={vaultLimit !== null && usage.vaultCount >= vaultLimit}
          limit={vaultLimit}
        />
      </div>

      <div className="grid grid-cols-1 gap-x-5 gap-y-7 sm:grid-cols-2 lg:grid-cols-3">
        {vaults.map((vault) => (
          <Link key={vault.id} href={`/v/${vault.slug}`} className="group">
            <div className="relative aspect-[4/3] w-full overflow-hidden rounded-[var(--radius-xl)] border border-[var(--color-hairline)] bg-[var(--color-surface)]">
              {vault.coverPath ? (
                <img
                  src={mediaUrl(vault.coverPath)}
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                />
              ) : (
                /* An empty vault used to render as a bare dark tile, which
                   reads as a loading failure rather than as "nothing here
                   yet". A wash and a hint make the state legible. */
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-[radial-gradient(120%_120%_at_20%_0%,rgba(124,92,252,0.16),transparent_60%)]">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path
                      d="M6 4h12a1 1 0 0 1 1 1v15l-7-4-7 4V5a1 1 0 0 1 1-1Z"
                      stroke="var(--color-viola-text)"
                      strokeWidth="1.5"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <p className="mt-2 px-4 text-center text-[12px] text-[var(--color-text-tertiary)]">
                    Tap Save on any look to fill this
                  </p>
                </div>
              )}
              <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-b from-transparent to-[rgba(11,10,15,0.9)]" />
              <div className="absolute right-4 bottom-4 left-4">
                <p className="text-[16px] font-semibold text-white">{vault.name}</p>
                <p className="stat mt-0.5 text-[12px] text-[var(--color-text-tertiary)]">
                  {vault.itemCount} {vault.itemCount === 1 ? 'piece' : 'pieces'}
                </p>
              </div>
              {vault.isDefault && (
                <span className="absolute top-3 right-3 rounded-full border border-white/15 bg-black/35 px-2.5 py-1 text-[10px] font-bold tracking-[0.16em] text-white/80 uppercase backdrop-blur-sm">
                  Free
                </span>
              )}
            </div>
          </Link>
        ))}
      </div>

      {entitlements.tier === 'free' && (
        <div className="surface mt-9 flex flex-col items-start gap-3 px-5 py-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[15px] font-semibold text-white">
              One vault, {saveLimit} pieces on the free plan
            </p>
            <p className="mt-1 text-[13px] text-[var(--color-text-secondary)]">
              Viola Plus unlocks unlimited vaults and removes sponsored posts.
            </p>
          </div>
          <Link
            href="/plus"
            className="shrink-0 rounded-full bg-[var(--color-viola)] px-5 py-3 text-[14px] font-semibold text-white transition-transform active:scale-[0.97]"
          >
            {formatPrice(699)}/mo
          </Link>
        </div>
      )}
    </AppShell>
  );
}
