import { eq } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { FREE, isViolaError } from '@viola/core';
import { schema, type DbHandle } from '@viola/db';
import { createTestDb, truncateAll } from '@viola/db/testing';
import {
  assertCanCreateVault,
  assertCanSaveItem,
  assertWithinQuota,
  getEntitlements,
  getQuota,
  getTier,
  getVaultUsage,
  isoWeek,
  recordLookTagged,
  showsSponsored,
} from './entitlements';
import {
  createVault,
  deleteVault,
  getVault,
  listVaults,
  removeFromVault,
  saveToVault,
} from './vaults';

let handle: DbHandle;

beforeEach(async () => {
  handle ??= await createTestDb();
  await truncateAll(handle);
});

afterAll(async () => {
  await handle?.close();
});

const db = () => handle.db;

async function makeUser(email = `u${Math.random()}@x.com`) {
  const [user] = await db().insert(schema.users).values({ email }).returning();
  await db()
    .insert(schema.profiles)
    .values({ userId: user!.id, handle: `h${Math.random().toString(36).slice(2, 10)}` });
  await db()
    .insert(schema.vaults)
    .values({
      userId: user!.id,
      name: 'Saved',
      slug: `v${Math.random().toString(36).slice(2, 12)}`,
      isDefault: true,
    });
  return user!.id;
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

async function grantPlus(userId: string, periodEnd = new Date(Date.now() + 86_400_000)) {
  await db().insert(schema.subscriptions).values({
    userId,
    platform: 'stripe',
    tier: 'plus',
    status: 'active',
    currentPeriodEnd: periodEnd,
  });
}

describe('tiers', () => {
  it('defaults to free', async () => {
    expect(await getTier(db(), await makeUser())).toBe('free');
  });

  it('recognises an active subscription', async () => {
    const userId = await makeUser();
    await grantPlus(userId);
    expect(await getTier(db(), userId)).toBe('plus');
  });

  it('drops to free once the paid period has lapsed', async () => {
    const userId = await makeUser();
    await grantPlus(userId, new Date(Date.now() - 86_400_000));
    expect(await getTier(db(), userId)).toBe('free');
  });

  it('shows sponsored posts to free users and signed-out visitors, not to Plus', async () => {
    const free = await makeUser();
    const plus = await makeUser();
    await grantPlus(plus);

    expect(await showsSponsored(db(), null)).toBe(true);
    expect(await showsSponsored(db(), free)).toBe(true);
    expect(await showsSponsored(db(), plus)).toBe(false);
  });
});

describe('vault limits — the paid feature', () => {
  it('gives every new account exactly one free vault', async () => {
    const userId = await makeUser();
    const vaults = await listVaults(db(), userId);
    expect(vaults).toHaveLength(1);
    expect(vaults[0]!.name).toBe('Saved');
    expect(vaults[0]!.isDefault).toBe(true);
  });

  it('refuses a second vault on the free plan', async () => {
    // This is the brief's paid feature verbatim: saving into your own folders
    // is what costs money.
    const userId = await makeUser();
    await expect(assertCanCreateVault(db(), userId)).rejects.toThrow();

    try {
      await createVault(db(), userId, { name: 'Going out' });
      throw new Error('should have been blocked');
    } catch (error) {
      expect(isViolaError(error)).toBe(true);
      if (isViolaError(error)) {
        // 402 rather than 403 so the client knows to show the paywall.
        expect(error.status).toBe(402);
        expect((error.details as { trigger: string }).trigger).toBe('second_vault');
      }
    }
  });

  it('allows unlimited vaults on Plus', async () => {
    const userId = await makeUser();
    await grantPlus(userId);

    for (const name of ['Going out', 'Work', 'Summer']) {
      await createVault(db(), userId, { name });
    }
    expect(await listVaults(db(), userId)).toHaveLength(4);
  });

  it('never deletes the default vault', async () => {
    const userId = await makeUser();
    const [saved] = await listVaults(db(), userId);
    await expect(deleteVault(db(), userId, saved!.id)).rejects.toThrow();
  });

  it('deletes a vault the user owns, and refuses one they do not', async () => {
    const owner = await makeUser();
    const stranger = await makeUser();
    await grantPlus(owner);
    const vault = await createVault(db(), owner, { name: 'Temp' });

    await expect(deleteVault(db(), stranger, vault.id)).rejects.toThrow();
    await deleteVault(db(), owner, vault.id);
    expect(await listVaults(db(), owner)).toHaveLength(1);
  });
});

describe('saving', () => {
  it('saves a look into the default vault with no vault specified', async () => {
    const userId = await makeUser();
    const look = await makeLook(userId);

    const result = await saveToVault(db(), userId, { lookId: look.id });
    expect(result.saved).toBe(true);
    expect(result.alreadyThere).toBe(false);

    const [vault] = await listVaults(db(), userId);
    expect(vault!.itemCount).toBe(1);
  });

  it('is idempotent — re-saving does not double count or consume quota', async () => {
    const userId = await makeUser();
    const look = await makeLook(userId);

    await saveToVault(db(), userId, { lookId: look.id });
    const second = await saveToVault(db(), userId, { lookId: look.id });

    expect(second.alreadyThere).toBe(true);
    const [vault] = await listVaults(db(), userId);
    expect(vault!.itemCount).toBe(1);
  });

  it('enforces the free saved-item ceiling', async () => {
    const userId = await makeUser();
    for (let i = 0; i < FREE.maxSavedItems; i++) {
      const look = await makeLook(userId);
      await saveToVault(db(), userId, { lookId: look.id });
    }

    expect((await getVaultUsage(db(), userId)).savedItemCount).toBe(FREE.maxSavedItems);
    await expect(assertCanSaveItem(db(), userId)).rejects.toThrow();

    const extra = await makeLook(userId);
    await expect(saveToVault(db(), userId, { lookId: extra.id })).rejects.toThrow();
  });

  it('lets a Plus account keep going past the free ceiling', async () => {
    const userId = await makeUser();
    await grantPlus(userId);

    for (let i = 0; i < FREE.maxSavedItems + 3; i++) {
      const look = await makeLook(userId);
      await saveToVault(db(), userId, { lookId: look.id });
    }
    expect((await getVaultUsage(db(), userId)).savedItemCount).toBe(FREE.maxSavedItems + 3);
  });

  it('refuses to save into someone else’s vault', async () => {
    const owner = await makeUser();
    const stranger = await makeUser();
    const [vault] = await listVaults(db(), owner);
    const look = await makeLook(owner);

    await expect(
      saveToVault(db(), stranger, { vaultId: vault!.id, lookId: look.id }),
    ).rejects.toThrow();
  });

  it('uses the first saved look as the cover', async () => {
    const userId = await makeUser();
    const look = await makeLook(userId);
    await saveToVault(db(), userId, { lookId: look.id });

    const [vault] = await db().select().from(schema.vaults).where(eq(schema.vaults.userId, userId));
    expect(vault!.coverLookId).toBe(look.id);
  });

  it('removes a saved item and decrements the count', async () => {
    const userId = await makeUser();
    const look = await makeLook(userId);
    await saveToVault(db(), userId, { lookId: look.id });

    const [item] = await db().select().from(schema.vaultItems);
    await removeFromVault(db(), userId, item!.id);

    const [vault] = await listVaults(db(), userId);
    expect(vault!.itemCount).toBe(0);
  });

  it('rejects a save with nothing to save', async () => {
    const userId = await makeUser();
    await expect(saveToVault(db(), userId, {})).rejects.toThrow();
  });
});

describe('vault visibility', () => {
  it('hides a private vault from everyone but its owner', async () => {
    const owner = await makeUser();
    const stranger = await makeUser();
    const [vault] = await listVaults(db(), owner);

    expect(await getVault(db(), vault!.slug, owner)).not.toBeNull();
    expect(await getVault(db(), vault!.slug, stranger)).toBeNull();
    expect(await getVault(db(), vault!.slug, null)).toBeNull();
  });

  it('shows a public vault to anyone — it is a share surface', async () => {
    const owner = await makeUser();
    await grantPlus(owner);
    const vault = await createVault(db(), owner, { name: 'Lookbook', isPublic: true });

    expect(await getVault(db(), vault.slug, null)).not.toBeNull();
  });
});

describe('weekly tagging quota', () => {
  it('formats an ISO week key', () => {
    expect(isoWeek(new Date('2026-08-14T12:00:00Z'))).toMatch(/^2026-W\d{2}$/);
  });

  it('starts empty and counts up', async () => {
    const userId = await makeUser();
    expect((await getQuota(db(), userId)).used).toBe(0);

    await recordLookTagged(db(), userId);
    await recordLookTagged(db(), userId);

    const quota = await getQuota(db(), userId);
    expect(quota.used).toBe(2);
    expect(quota.remaining).toBe(FREE.weeklyLookQuota - 2);
  });

  it('blocks once the free allowance is spent', async () => {
    // The cost control: each look is a vision call plus a few product searches.
    const userId = await makeUser();
    for (let i = 0; i < FREE.weeklyLookQuota; i++) await recordLookTagged(db(), userId);

    try {
      await assertWithinQuota(db(), userId);
      throw new Error('should have been blocked');
    } catch (error) {
      expect(isViolaError(error)).toBe(true);
      if (isViolaError(error)) expect(error.code).toBe('quota_exceeded');
    }
  });

  it('never blocks a Plus account', async () => {
    const userId = await makeUser();
    await grantPlus(userId);
    for (let i = 0; i < 50; i++) await recordLookTagged(db(), userId);

    const quota = await assertWithinQuota(db(), userId);
    expect(quota.remaining).toBe(Number.POSITIVE_INFINITY);
  });

  it('tracks each account separately', async () => {
    const a = await makeUser();
    const b = await makeUser();
    await recordLookTagged(db(), a);

    expect((await getQuota(db(), a)).used).toBe(1);
    expect((await getQuota(db(), b)).used).toBe(0);
  });
});

describe('entitlement resolution', () => {
  it('maps a free account to the free entitlement set', async () => {
    const entitlements = await getEntitlements(db(), await makeUser());
    expect(entitlements.tier).toBe('free');
    expect(entitlements.maxVaults).toBe(1);
  });

  it('never gates the social loop', async () => {
    // Posting, blooming and sharing must stay free — they are the growth
    // engine, and gating them would throttle acquisition to protect revenue.
    const free = await getEntitlements(db(), await makeUser());
    expect(free).not.toHaveProperty('canBloom');
    expect(free).not.toHaveProperty('canShare');
    expect(free).not.toHaveProperty('canPost');
  });
});
