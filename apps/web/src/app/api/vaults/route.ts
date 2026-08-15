import { NextResponse } from 'next/server';
import { isViolaError } from '@viola/core';
import { db } from '@/lib/db';
import { getViewer } from '@/lib/identity';
import { createVault, listVaults } from '@/lib/vaults';
import { getEntitlements, getVaultUsage } from '@/lib/entitlements';

export const runtime = 'nodejs';

export async function GET() {
  const viewer = await getViewer();
  if (!viewer.userId)
    return NextResponse.json({ error: { code: 'unauthorized' } }, { status: 401 });

  const database = await db();
  const [vaults, entitlements, usage] = await Promise.all([
    listVaults(database, viewer.userId),
    getEntitlements(database, viewer.userId),
    getVaultUsage(database, viewer.userId),
  ]);

  return NextResponse.json({
    vaults,
    tier: entitlements.tier,
    limits: {
      maxVaults: Number.isFinite(entitlements.maxVaults) ? entitlements.maxVaults : null,
      maxSavedItems: Number.isFinite(entitlements.maxSavedItems)
        ? entitlements.maxSavedItems
        : null,
    },
    usage,
  });
}

export async function POST(request: Request) {
  const viewer = await getViewer();
  if (!viewer.userId)
    return NextResponse.json({ error: { code: 'unauthorized' } }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as { name?: string; isPublic?: boolean };

  try {
    const vault = await createVault(await db(), viewer.userId, {
      name: body.name ?? '',
      isPublic: body.isPublic,
    });
    return NextResponse.json({ vault });
  } catch (error) {
    if (isViolaError(error)) return NextResponse.json(error.toJSON(), { status: error.status });
    throw error;
  }
}
