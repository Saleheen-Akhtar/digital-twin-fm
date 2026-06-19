/**
 * Returns the current WebSocket JWT for the realtime connection.
 *
 * The browser cannot read the httpOnly `dtfm_token` cookie, but it needs
 * the raw JWT to authenticate the Socket.IO connection to the api-gateway's
 * WebSocket gateway (which expects `Authorization: Bearer <token>` or
 * `?token=<token>`). This Route Handler reads the cookie server-side
 * (via `getSession()`) and returns the token as JSON so `useRealtime`
 * can forward it to the gateway.
 *
 * Security:
 *   - The endpoint is same-origin only (GET, no state change), so the
 *     browser's CSRF protections are sufficient.
 *   - Returns 401 if the session is invalid, identical to the proxy route.
 *   - Never sets or exposes the token in any non-standard way.
 */
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';

export async function GET(): Promise<Response> {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return NextResponse.json({ token: session.accessToken });
}
