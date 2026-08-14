import { NextResponse } from 'next/server';
import { isViolaError } from '@viola/core';
import { db } from '@/lib/db';
import { getViewer } from '@/lib/identity';
import { removeFromVault, saveToVault } from '@/lib/vaults';

export const runtime = 'nodejs';

/**
 * Save into a vault.
 *
 * 401 for signed-out visitors rather than a silent no-op: saving is the one
 * thing that genuinely needs an account, and the client turns this into a
 * sign-in prompt. A gated save returns 402 with a paywall trigger.
 */
export async function POST(request: Request) {
  const viewer = await getViewer();
  if (!viewer.userId) {
    return NextResponse.json(
      { error: { code: 'unauthorized', message: 'Sign in to save this.' } },
      { status: 401 },
    );
  }

  const body = (await request.json().catch(() => ({}))) as {
    vaultId?: string;
    lookId?: string;
    lookItemId?: string;
    productId?: string;
  };

  try {
    const result = await saveToVault(await db(), viewer.userId, body);
    return NextResponse.json(result);
  } catch (error) {
    if (isViolaError(error)) return NextResponse.json(error.toJSON(), { status: error.status });
    throw error;
  }
}

export async function DELETE(request: Request) {
  const viewer = await getViewer();
  if (!viewer.userId)
    return NextResponse.json({ error: { code: 'unauthorized' } }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: { code: 'validation_failed' } }, { status: 422 });

  try {
    await removeFromVault(await db(), viewer.userId, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (isViolaError(error)) return NextResponse.json(error.toJSON(), { status: error.status });
    throw error;
  }
}
