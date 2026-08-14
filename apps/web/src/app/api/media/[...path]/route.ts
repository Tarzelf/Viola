import { NextResponse } from 'next/server';
import { providers } from '@/lib/providers';

/**
 * Serves stored media.
 *
 * In production Supabase Storage serves these directly and this route is a
 * fallback; in development it is how the local filesystem provider exposes
 * uploads and generated cards to the browser.
 *
 * Node runtime: the storage providers use node:fs and Buffer.
 */
export const runtime = 'nodejs';

const CONTENT_TYPES: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  svg: 'image/svg+xml',
};

export async function GET(_request: Request, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  const key = path.join('/');

  // Path traversal guard. The storage provider also refuses to escape its root,
  // but rejecting here keeps the bad request from reaching it at all.
  if (key.includes('..')) {
    return new NextResponse('Bad request', { status: 400 });
  }

  const data = await providers().storage.get(key);
  if (!data) return new NextResponse('Not found', { status: 404 });

  const extension = key.split('.').pop()?.toLowerCase() ?? '';
  const contentType = CONTENT_TYPES[extension] ?? 'application/octet-stream';

  return new NextResponse(new Uint8Array(data), {
    headers: {
      'content-type': contentType,
      // Content at a given path never changes — new versions get new paths.
      'cache-control': 'public, max-age=31536000, immutable',
    },
  });
}
