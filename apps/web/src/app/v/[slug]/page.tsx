import Link from 'next/link';
import { notFound } from 'next/navigation';
import { formatPrice } from '@viola/core';
import { AppShell } from '@/components/app-shell';
import { getViewer } from '@/lib/identity';
import { mediaUrl } from '@/lib/media';
import { db } from '@/lib/db';
import { getVault } from '@/lib/vaults';

export const dynamic = 'force-dynamic';

/**
 * A vault, viewable as a lookbook.
 *
 * A public vault is a share surface in its own right: a curated set of pieces
 * with prices is exactly the kind of link that gets passed around a group chat,
 * and every item in it carries an affiliate link.
 */
export default async function VaultPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const viewer = await getViewer();
  const contents = await getVault(await db(), slug, viewer.userId);

  if (!contents) notFound();

  return (
    <AppShell>
      <div className="mb-7">
        <Link
          href="/vaults"
          className="text-[13px] text-[var(--color-text-tertiary)] transition-colors hover:text-white"
        >
          ← Vaults
        </Link>
        <h1 className="display mt-2 text-[34px] leading-tight text-white">{contents.vault.name}</h1>
        <p className="mt-1.5 text-[14px] text-[var(--color-text-secondary)]">
          {contents.items.length} {contents.items.length === 1 ? 'piece' : 'pieces'}
        </p>
      </div>

      {contents.items.length === 0 ? (
        <div className="surface px-6 py-16 text-center">
          <h2 className="display text-[24px] text-white">Nothing saved yet</h2>
          <p className="mt-2 text-[14px] text-[var(--color-text-secondary)]">
            Tap Save on any look or piece and it lands here.
          </p>
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {contents.items.map((item) => (
            <li
              key={item.id}
              className="overflow-hidden rounded-[var(--radius-xl)] border border-[var(--color-hairline)] bg-[var(--color-surface)]"
            >
              <div className="relative flex aspect-square items-center justify-center bg-white/[0.03]">
                {item.imagePath ? (
                  <img
                    src={mediaUrl(item.imagePath)}
                    alt=""
                    className="h-[70%] w-[70%] object-contain"
                  />
                ) : item.photoPath ? (
                  <img
                    src={mediaUrl(item.photoPath)}
                    alt=""
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                ) : (
                  <div className="h-3 w-3 rounded-full bg-white/15" />
                )}
              </div>
              <div className="p-3">
                {item.brand && <p className="label-caps truncate text-white">{item.brand}</p>}
                <p className="label-caps-sub truncate">{item.title}</p>
                <div className="mt-2 flex items-center justify-between gap-2">
                  {item.priceCents != null && (
                    <span className="stat text-[13px] text-white">
                      {formatPrice(item.priceCents)}
                    </span>
                  )}
                  {item.lookItemId && item.merchantUrl && (
                    <a
                      href={`/go/${item.lookItemId}`}
                      target="_blank"
                      rel="noopener noreferrer nofollow sponsored"
                      className="rounded-full bg-white px-3 py-1.5 text-[12px] font-semibold text-[var(--color-ink)]"
                    >
                      Shop
                    </a>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </AppShell>
  );
}
