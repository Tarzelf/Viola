import { NextResponse, type NextRequest } from 'next/server';

/**
 * CORS for the API.
 *
 * A real iOS build does not need this — native fetch has no origin and is not
 * subject to CORS at all. But the Expo *web* target is how the mobile app gets
 * verified on a machine without Xcode, and that runs on a different port, so
 * without this the app renders perfectly and then fails every request.
 *
 * The allowlist is explicit rather than a wildcard. Credentials are involved
 * (the guest cookie), and `Access-Control-Allow-Origin: *` cannot be combined
 * with credentials anyway — browsers reject it. Extra origins can be added via
 * VIOLA_CORS_ORIGINS for a deployed Expo web build.
 */

const DEV_ORIGINS = ['http://localhost:8081', 'http://127.0.0.1:8081', 'http://localhost:19006'];

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
    // Responses differ per origin, so caches must not share them.
    vary: 'Origin',
  };
}

export function middleware(request: NextRequest) {
  const origin = request.headers.get('origin');
  if (!origin || !allowedOrigins().includes(origin)) return NextResponse.next();

  const headers = corsHeaders(origin);

  // Preflight has to be answered before the route handler runs.
  if (request.method === 'OPTIONS') {
    return new NextResponse(null, { status: 204, headers });
  }

  const response = NextResponse.next();
  for (const [key, value] of Object.entries(headers)) response.headers.set(key, value);
  return response;
}

export const config = {
  matcher: '/api/:path*',
};
