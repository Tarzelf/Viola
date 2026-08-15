import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getArchetype } from '@viola/core';
import { AppShell } from '@/components/app-shell';
import { VaultLookbook } from '@/components/vault-lookbook';
import { getViewer } from '@/lib/identity';
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

  const items = contents.items.map((item) => ({
    id: item.id,
    lookItemId: item.lookItemId,
    brand: item.brand,
    title: item.title,
    priceCents: item.priceCents,
    currency: item.currency,
    imagePath: item.imagePath,
    photoPath: item.photoPath,
    merchantUrl: item.merchantUrl,
    lookSlug: item.lookSlug,
    lookHandle: item.lookHandle,
    lookScore: item.lookScore,
    lookArchetype: item.lookArchetypeId
      ? (getArchetype(item.lookArchetypeId)?.name ?? null)
      : null,
  }));

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
        <VaultLookbook vaultName={contents.vault.name} items={items} />
      )}
    </AppShell>
  );
}
