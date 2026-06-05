/**
 * Next.js middleware — runs on every request (except _next/static, favicon).
 *
 * For protected routes: verifies the dtfm_token cookie has a valid JWT
 * signature, issuer, and audience. If not, redirects to /login.
 *
 * Public routes: /login, /api/* (Server Actions + healthchecks), /_next/*,
 * static files.
 *
 * Why edge-safe: uses `jose` (works on Node + Edge), no Node-only APIs.
 *
 * Security notes:
 * - The middleware uses the SAME JWT_ACCESS_SECRET as the api-gateway. If
 *   the secrets diverge, the cookie fails verification and the user is
 *   redirected to /login.
 * - The middleware does NOT hit the database; it's a stateless check.
 * - The middleware does NOT trust the cookie's unverified payload — it
 *   verifies the signature first via `jwtVerify`.
 */
import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const ISSUER = 'digital-twin-fm.api-gateway';
const AUDIENCE = 'digital-twin-fm.web';
const COOKIE_NAME = 'dtfm_token';

// Routes that don't require auth
const PUBLIC_PREFIXES = [
  '/login',
  '/_next',
  '/favicon',
  '/api/health',
];

// Static file extensions (always public)
const STATIC_FILE = /\.(svg|png|jpg|jpeg|gif|webp|ico|woff2?|ttf|eot|css|js|map)$/;

function isPublic(pathname: string): boolean {
  if (STATIC_FILE.test(pathname)) return true;
  return PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + '/'));
}

function getSecret(): Uint8Array | null {
  const s = process.env.JWT_ACCESS_SECRET;
  if (!s) {
    // No secret configured → fail closed (everything requires auth).
    return null;
  }
  return new TextEncoder().encode(s);
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (isPublic(pathname)) {
    return NextResponse.next();
  }

  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) {
    const loginUrl = new URL('/login', req.url);
    return NextResponse.redirect(loginUrl);
  }

  const secret = getSecret();
  if (!secret) {
    // Misconfigured server — fail closed.
    return NextResponse.redirect(new URL('/login', req.url));
  }

  try {
    await jwtVerify(token, secret, {
      audience: AUDIENCE,
      issuer: ISSUER,
      algorithms: ['HS256'],
    });
    return NextResponse.next();
  } catch {
    const loginUrl = new URL('/login', req.url);
    return NextResponse.redirect(loginUrl);
  }
}

// Run on every page except Next's own static assets
export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - /_next/static
     * - /_next/image
     * - /favicon.ico
     * - any file with an extension (svg, png, jpg, etc.)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)',
  ],
};
