/**
 * Media URLs.
 *
 * Storage paths are logical, so the same path resolves whether the bytes live
 * on the local filesystem in development or in Supabase Storage in production.
 * Client components import this, so it must stay free of server-only imports.
 */
export function mediaUrl(path: string | null | undefined): string {
  if (!path) return '/placeholder.svg';
  if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('data:')) {
    return path;
  }
  return `/api/media/${path.replace(/^\/+/, '')}`;
}
