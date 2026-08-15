import { NextResponse } from 'next/server';
import { isViolaError } from '@viola/core';
import { db } from '@/lib/db';
import { attachGuestCookie, getViewer } from '@/lib/identity';
import { reportContent, type ReportReason } from '@/lib/safety';

export const runtime = 'nodejs';

const REASONS = new Set<ReportReason>([
  'nudity',
  'harassment',
  'spam',
  'impersonation',
  'violence',
  'other',
]);

/**
 * Report content. App Store guideline 1.2 requires this.
 *
 * Open to signed-out visitors on purpose: requiring an account to flag
 * something objectionable means most of it never gets flagged.
 */
export async function POST(request: Request) {
  const viewer = await getViewer();
  const body = (await request.json().catch(() => ({}))) as {
    targetType?: string;
    targetId?: string;
    reason?: string;
    detail?: string;
  };

  if (
    !body.targetId ||
    !['look', 'user', 'comment'].includes(body.targetType ?? '') ||
    !REASONS.has(body.reason as ReportReason)
  ) {
    return NextResponse.json({ error: { code: 'validation_failed' } }, { status: 422 });
  }

  try {
    await reportContent(await db(), {
      reporterId: viewer.userId,
      targetType: body.targetType as 'look' | 'user' | 'comment',
      targetId: body.targetId,
      reason: body.reason as ReportReason,
      detail: body.detail,
    });
    return attachGuestCookie(NextResponse.json({ received: true }), viewer);
  } catch (error) {
    if (isViolaError(error)) return NextResponse.json(error.toJSON(), { status: error.status });
    throw error;
  }
}
