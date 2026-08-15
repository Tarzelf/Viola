import { after, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { attachGuestCookie, getViewer } from '@/lib/identity';
import { createLook, processLook } from '@/lib/create-look';
import { assertWithinQuota, recordLookTagged } from '@/lib/entitlements';
import { isViolaError } from '@viola/core';

export const runtime = 'nodejs';
/** Vision plus product resolution can take a while on live providers. */
export const maxDuration = 120;

const MAX_BYTES = 12 * 1024 * 1024;
const ACCEPTED = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']);

/**
 * Create a look.
 *
 * Returns as soon as the row exists so the client can navigate straight to the
 * reveal and watch pieces appear. The pipeline runs after the response via
 * `after()`, writing results as each stage completes.
 */
export async function POST(request: Request) {
  const viewer = await getViewer();
  const database = await db();

  const form = await request.formData().catch(() => null);
  const file = form?.get('photo');

  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: { code: 'validation_failed', message: 'Add a photo to get started.' } },
      { status: 422 },
    );
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: { code: 'validation_failed', message: 'That image is a bit too large.' } },
      { status: 422 },
    );
  }

  if (file.type && !ACCEPTED.has(file.type)) {
    return NextResponse.json(
      { error: { code: 'validation_failed', message: "That file type isn't supported." } },
      { status: 422 },
    );
  }

  if (!viewer.userId) {
    return NextResponse.json(
      { error: { code: 'unauthorized', message: 'Sign in to post a look.' } },
      { status: 401 },
    );
  }
  const userId = viewer.userId;

  // Checked before anything paid runs. Each look is roughly one vision call
  // plus a few product searches, so an unbounded free tier is an unbounded bill.
  try {
    await assertWithinQuota(database, userId);
  } catch (error) {
    if (isViolaError(error)) return NextResponse.json(error.toJSON(), { status: error.status });
    throw error;
  }

  const caption =
    typeof form?.get('caption') === 'string' ? String(form.get('caption')) : undefined;
  const { lookId, slug } = await createLook(database, { userId, caption });
  await recordLookTagged(database, userId);

  const buffer = Buffer.from(await file.arrayBuffer());
  const mimeType = file.type || 'image/jpeg';

  after(async () => {
    await processLook(database, lookId, buffer, mimeType);
  });

  return attachGuestCookie(NextResponse.json({ lookId, slug, status: 'processing' }), viewer);
}
