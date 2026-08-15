import { NextResponse } from 'next/server';
import { isViolaError } from '@viola/core';
import { db } from '@/lib/db';
import { getViewer } from '@/lib/identity';
import { deleteVault } from '@/lib/vaults';

export const runtime = 'nodejs';

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const viewer = await getViewer();
  if (!viewer.userId)
    return NextResponse.json({ error: { code: 'unauthorized' } }, { status: 401 });

  const { id } = await context.params;

  try {
    await deleteVault(await db(), viewer.userId, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (isViolaError(error)) return NextResponse.json(error.toJSON(), { status: error.status });
    throw error;
  }
}
