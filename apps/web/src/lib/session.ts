/**
 * Server-only session helper.
 *
 * Verifies the `dtfm_token` cookie using the SAME secret/aud/iss that the
 * api-gateway uses to mint it. Returns a Session object on success, or
 * `null` if the cookie is missing, malformed, expired, or has the wrong
 * audience/issuer/signature.
 *
 * Why server-only: this calls `cookies()` from next/headers, which is only
 * valid inside a Server Component, Route Handler, or Server Action. The
 * `'server-only'` import would throw at build time if a client component
 * tries to import it.
 */
import 'server-only';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { jwtVerify, type JWTPayload } from 'jose';

/**
 * Role enum is duplicated here (not imported from api-gateway) because the
 * api-gateway has no package exports yet. Keep in sync with
 * apps/api-gateway/src/auth/jwt.strategy.ts (AppRole union).
 */
export type AppRole = 'admin' | 'facility_manager' | 'technician' | 'viewer';

export interface Session {
  userId: string;
  email: string;
  role: AppRole;
  /**
   * The raw JWT that was in the cookie. Use this to call the api-gateway
   * (the api-gateway verifies the same signature/aud/iss independently).
   * NEVER send this to the browser.
   */
  accessToken: string;
}

const ISSUER = 'digital-twin-fm.api-gateway';
const AUDIENCE = 'digital-twin-fm.web';
const COOKIE_NAME = 'dtfm_token';

function jwtSecret(): Uint8Array {
  const s = process.env.JWT_ACCESS_SECRET;
  if (!s) {
    throw new Error(
      'JWT_ACCESS_SECRET is not set on the web app. ' +
        'Set it in .env (must match the api-gateway value) so the cookie can be verified.',
    );
  }
  return new TextEncoder().encode(s);
}

interface TokenPayload extends JWTPayload {
  sub: string;
  email: string;
  role: AppRole;
}

export async function getSession(): Promise<Session | null> {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify<TokenPayload>(token, jwtSecret(), {
      audience: AUDIENCE,
      issuer: ISSUER,
      algorithms: ['HS256'],
    });
    if (!payload.sub || !payload.email || !payload.role) return null;
    return {
      userId: String(payload.sub),
      email: payload.email,
      role: payload.role,
      accessToken: token,
    };
  } catch {
    return null;
  }
}

/**
 * Like getSession, but redirects to /login if the cookie is missing/invalid.
 * Use this at the top of every protected server page.
 */
export async function requireSession(): Promise<Session> {
  const s = await getSession();
  if (!s) {
    redirect('/login');
  }
  return s;
}

