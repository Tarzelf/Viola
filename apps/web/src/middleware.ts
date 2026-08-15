import { NextResponse, type NextRequest } from 'next/server';

/**
 * Middleware: CORS for Expo web + optional invite-only soft launch.
 *
 * Share pages (`/l/*`), shop redirects, legal, early-access, and the API stay
 * reachable without an invite — value-before-account is non-negotiable. The
 * rest of the product can be gated with VIOLA_INVITE_ONLY=1.
 */

const DEV_ORIGINS = ['http://localhost:8081', 'http://127.0.0.1:8081', 'http://localhost:19006'];

const PUBLIC_PREFIXES = [
  '/',
  '/l/',
  '/go/',
  '/early',
  '/privacy',
  '/terms',
  '/contact',
  '/plus',
  '/api/',
  '/_next',
  '/fonts',
  '/favicon',
  '/signin',
];

/** Paths that require an invite when soft-launch is on. */
const GATED_PREFIXES = ['/new', '/vaults', '/settings', '/earnings', '/moderation'];

function allowedOrigins(): string[] {
  const configured = (process.env.VIOLA_CORS_ORIGINS ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  return process.env.NODE_ENV === 'production' ? configured : [...DEV_ORIGINS, ...configured];
}

function corsHeaders(origin: string): Record<string, string> {
  return {
    'access-control-allow-origin': origin,
    'access-control-allow-credentials': 'true',
    'access-control-allow-methods': 'GET,POST,PATCH,DELETE,OPTIONS',
    'access-control-allow-headers': 'content-type,authorization',
    'access-control-max-age': '86400',
    vary: 'Origin',
  };
}

function isGatedPath(pathname: string): boolean {
  return GATED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Soft-launch: browse + share stay open; posting / vaults / settings need invite.
  if (
    process.env.VIOLA_INVITE_ONLY === '1' &&
    isGatedPath(pathname) &&
    !request.cookies.get('viola_invite')?.value
  ) {
    const url = request.nextUrl.clone();
    url.pathname = '/early';
    url.search = '';
    return NextResponse.redirect(url);
  }

  const origin = request.headers.get('origin');
  if (!origin || !allowedOrigins().includes(origin)) return NextResponse.next();

  const headers = corsHeaders(origin);

  if (request.method === 'OPTIONS') {
    return new NextResponse(null, { status: 204, headers });
  }

  const response = NextResponse.next();
  for (const [key, value] of Object.entries(headers)) response.headers.set(key, value);
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico)$).*)'],
};
