/**
 * POST /api/auth/update-token
 *
 * Updates the `dtfm_token` httpOnly cookie with a new JWT.
 * Called from the client after a profile update (PATCH /auth/me)
 * so the server-rendered greeting reflects the latest displayName.
 *
 * Body: { "accessToken": "<new-jwt>" }
 */
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

const COOKIE_NAME = 'dtfm_token';

export async function POST(request: Request) {
  try {
    const { accessToken } = await request.json();
    if (!accessToken || typeof accessToken !== 'string') {
      return NextResponse.json(
        { error: 'accessToken is required' },
        { status: 400 },
      );
    }

    const cookieStore = await cookies();
    cookieStore.set(COOKIE_NAME, accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      // Keep the same max-age as the login action (7 days)
      maxAge: 7 * 24 * 60 * 60,
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: 'Invalid request' },
      { status: 400 },
    );
  }
}
