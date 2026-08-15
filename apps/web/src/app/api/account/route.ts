import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { clearSessionCookie, getViewer } from '@/lib/identity';
import { deleteAccount, exportAccount } from '@/lib/safety';

export const runtime = 'nodejs';

/** Data export. */
export async function GET() {
  const viewer = await getViewer();
  if (!viewer.userId)
    return NextResponse.json({ error: { code: 'unauthorized' } }, { status: 401 });

  const data = await exportAccount(await db(), viewer.userId);

  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      'content-type': 'application/json',
      'content-disposition': 'attachment; filename="viola-export.json"',
    },
  });
}

/**
 * Delete the account. Apple requires this to be available in-app.
 *
 * Requires the literal word DELETE in the body so a stray request cannot
 * destroy someone's account.
 */
export async function DELETE(request: Request) {
  const viewer = await getViewer();
  if (!viewer.userId)
    return NextResponse.json({ error: { code: 'unauthorized' } }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as { confirm?: string };
  if (body.confirm !== 'DELETE') {
    return NextResponse.json(
      { error: { code: 'validation_failed', message: 'Type DELETE to confirm.' } },
      { status: 422 },
    );
  }

  const summary = await deleteAccount(await db(), viewer.userId);

  const response = NextResponse.json({ deleted: true, ...summary });
  const cookie = clearSessionCookie();
  response.cookies.set(cookie.name, '', {
    httpOnly: cookie.httpOnly,
    sameSite: cookie.sameSite,
    path: cookie.path,
    secure: cookie.secure,
    maxAge: 0,
  });
  return response;
}
