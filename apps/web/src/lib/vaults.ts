import 'server-only';
import { randomBytes } from 'node:crypto';
import { and, desc, eq, sql } from 'drizzle-orm';
import { DEFAULT_VAULT_NAME, ViolaError, notFound } from '@viola/core';
import { schema, type Database } from '@viola/db';
import { assertCanCreateVault, assertCanSaveItem } from './entitlements';

/**
 * Vaults.
 *
 * "Vault" over "closet" or "collection" deliberately: it reads as something
 * private and worth keeping, which is the feeling that justifies paying for it.
 * A closet is where you put laundry.
 *
 * Every account has one undeletable default called Saved. Plus unlocks the rest.
 */

export interface VaultSummary {
  id: string;
  name: string;
  slug: string;
  isDefault: boolean;
  isPublic: boolean;
  itemCount: number;
  coverPath: string | null;
}

function newVaultSlug(): string {
  return `v-${randomBytes(8)
    .toString('base64url')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')}`;
}

export async function listVaults(db: Database, userId: string): Promise<VaultSummary[]> {
  const rows = await db
    .select({
      id: schema.vaults.id,
      name: schema.vaults.name,
      slug: schema.vaults.slug,
      isDefault: schema.vaults.isDefault,
      isPublic: schema.vaults.isPublic,
      itemCount: schema.vaults.itemCount,
      coverPath: schema.looks.photoPath,
    })
    .from(schema.vaults)
    .leftJoin(schema.looks, eq(schema.looks.id, schema.vaults.coverLookId))
    .where(eq(schema.vaults.userId, userId))
    .orderBy(desc(schema.vaults.isDefault), desc(schema.vaults.createdAt));

  return rows;
}

/** Ensures the free vault exists. Older accounts predate it being automatic. */
export async function ensureDefaultVault(db: Database, userId: string): Promise<string> {
  const [existing] = await db
    .select({ id: schema.vaults.id })
    .from(schema.vaults)
    .where(and(eq(schema.vaults.userId, userId), eq(schema.vaults.isDefault, true)))
    .limit(1);

  if (existing) return existing.id;

  const [created] = await db
    .insert(schema.vaults)
    .values({ userId, name: DEFAULT_VAULT_NAME, slug: newVaultSlug(), isDefault: true })
    .returning();

  return created!.id;
}

export async function createVault(
  db: Database,
  userId: string,
  input: { name: string; isPublic?: boolean },
): Promise<VaultSummary> {
  // Throws payment_required with a paywall trigger the client can act on.
  await assertCanCreateVault(db, userId);

  const name = input.name.trim().slice(0, 48);
  if (name.length === 0) {
    throw new ViolaError('validation_failed', 'empty vault name', {
      publicMessage: 'Give your vault a name.',
    });
  }

  const [created] = await db
    .insert(schema.vaults)
    .values({ userId, name, slug: newVaultSlug(), isPublic: input.isPublic ?? false })
    .returning();

  return { ...created!, coverPath: null };
}

export async function deleteVault(db: Database, userId: string, vaultId: string): Promise<void> {
  const [vault] = await db
    .select()
    .from(schema.vaults)
    .where(and(eq(schema.vaults.id, vaultId), eq(schema.vaults.userId, userId)))
    .limit(1);

  if (!vault) throw notFound('vault');

  if (vault.isDefault) {
    throw new ViolaError('forbidden', 'cannot delete the default vault', {
      publicMessage: `${DEFAULT_VAULT_NAME} can't be deleted.`,
    });
  }

  await db.delete(schema.vaults).where(eq(schema.vaults.id, vaultId));
}

export interface SaveInput {
  vaultId?: string;
  lookId?: string;
  lookItemId?: string;
  productId?: string;
}

export interface SaveResult {
  saved: boolean;
  vaultId: string;
  alreadyThere: boolean;
}

/**
 * Saves something into a vault.
 *
 * Defaults to Saved when no vault is named, so the common case is one tap. The
 * limit check runs before the insert so a gated save produces a paywall prompt
 * rather than a silent failure.
 */
export async function saveToVault(
  db: Database,
  userId: string,
  input: SaveInput,
): Promise<SaveResult> {
  if (!input.lookId && !input.lookItemId && !input.productId) {
    throw new ViolaError('validation_failed', 'nothing to save');
  }

  const vaultId = input.vaultId ?? (await ensureDefaultVault(db, userId));

  const [vault] = await db
    .select({ id: schema.vaults.id })
    .from(schema.vaults)
    .where(and(eq(schema.vaults.id, vaultId), eq(schema.vaults.userId, userId)))
    .limit(1);

  if (!vault) throw notFound('vault');

  // Re-saving something already in the vault must not consume quota or trip
  // the paywall, so the duplicate check comes first.
  const existing = await db
    .select({ id: schema.vaultItems.id })
    .from(schema.vaultItems)
    .where(
      and(
        eq(schema.vaultItems.vaultId, vaultId),
        input.lookId
          ? eq(schema.vaultItems.lookId, input.lookId)
          : input.lookItemId
            ? eq(schema.vaultItems.lookItemId, input.lookItemId)
            : eq(schema.vaultItems.productId, input.productId!),
      ),
    )
    .limit(1);

  if (existing.length > 0) {
    return { saved: true, vaultId, alreadyThere: true };
  }

  await assertCanSaveItem(db, userId);

  await db.insert(schema.vaultItems).values({
    vaultId,
    lookId: input.lookId ?? null,
    lookItemId: input.lookItemId ?? null,
    productId: input.productId ?? null,
  });

  await db
    .update(schema.vaults)
    .set({
      itemCount: sql`${schema.vaults.itemCount} + 1`,
      // First saved look becomes the cover, so a vault is never a blank tile.
      ...(input.lookId
        ? { coverLookId: sql`coalesce(${schema.vaults.coverLookId}, ${input.lookId})` }
        : {}),
      updatedAt: new Date(),
    })
    .where(eq(schema.vaults.id, vaultId));

  return { saved: true, vaultId, alreadyThere: false };
}

export async function removeFromVault(
  db: Database,
  userId: string,
  vaultItemId: string,
): Promise<void> {
  const [row] = await db
    .select({ id: schema.vaultItems.id, vaultId: schema.vaultItems.vaultId })
    .from(schema.vaultItems)
    .innerJoin(schema.vaults, eq(schema.vaults.id, schema.vaultItems.vaultId))
    .where(and(eq(schema.vaultItems.id, vaultItemId), eq(schema.vaults.userId, userId)))
    .limit(1);

  if (!row) throw notFound('saved item');

  await db.delete(schema.vaultItems).where(eq(schema.vaultItems.id, vaultItemId));
  await db
    .update(schema.vaults)
    .set({ itemCount: sql`greatest(0, ${schema.vaults.itemCount} - 1)`, updatedAt: new Date() })
    .where(eq(schema.vaults.id, row.vaultId));
}

export interface VaultContents {
  vault: VaultSummary;
  items: Array<{
    id: string;
    lookSlug: string | null;
    photoPath: string | null;
    brand: string | null;
    title: string | null;
    priceCents: number | null;
    currency: string | null;
    imagePath: string | null;
    merchantUrl: string | null;
    lookItemId: string | null;
    lookHandle: string | null;
    lookScore: number | null;
    lookArchetypeId: string | null;
  }>;
}

export async function getVault(
  db: Database,
  slug: string,
  viewerUserId: string | null,
): Promise<VaultContents | null> {
  const [vault] = await db
    .select()
    .from(schema.vaults)
    .where(eq(schema.vaults.slug, slug))
    .limit(1);

  if (!vault) return null;
  // A private vault is visible only to its owner.
  if (!vault.isPublic && vault.userId !== viewerUserId) return null;

  const items = await db
    .select({
      id: schema.vaultItems.id,
      lookSlug: schema.looks.slug,
      photoPath: schema.looks.photoPath,
      lookScore: schema.looks.score,
      lookArchetypeId: schema.looks.archetypeId,
      lookHandle: schema.profiles.handle,
      brand: schema.lookItems.brand,
      itemTitle: schema.lookItems.title,
      subtype: schema.lookItems.subtype,
      lookItemId: schema.lookItems.id,
      productTitle: schema.products.title,
      productBrand: schema.products.brand,
      priceCents: schema.products.priceCents,
      currency: schema.products.currency,
      imagePath: schema.products.imagePath,
      merchantUrl: schema.products.merchantUrl,
    })
    .from(schema.vaultItems)
    .leftJoin(schema.looks, eq(schema.looks.id, schema.vaultItems.lookId))
    .leftJoin(schema.profiles, eq(schema.profiles.userId, schema.looks.userId))
    .leftJoin(schema.lookItems, eq(schema.lookItems.id, schema.vaultItems.lookItemId))
    .leftJoin(
      schema.products,
      sql`${schema.products.id} = coalesce(${schema.vaultItems.productId}, ${schema.lookItems.productId})`,
    )
    .where(eq(schema.vaultItems.vaultId, vault.id))
    .orderBy(desc(schema.vaultItems.createdAt));

  return {
    vault: { ...vault, coverPath: null },
    items: items.map((i) => ({
      id: i.id,
      lookSlug: i.lookSlug,
      photoPath: i.photoPath,
      brand: i.brand ?? i.productBrand,
      title: i.itemTitle ?? i.productTitle ?? i.subtype,
      priceCents: i.priceCents,
      currency: i.currency,
      imagePath: i.imagePath,
      merchantUrl: i.merchantUrl,
      lookItemId: i.lookItemId,
      lookHandle: i.lookHandle,
      lookScore: i.lookScore,
      lookArchetypeId: i.lookArchetypeId,
    })),
  };
}
