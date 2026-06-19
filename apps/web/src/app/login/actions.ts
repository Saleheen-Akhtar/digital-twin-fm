'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getServerEnv } from '@/env';
import { createApiClient } from '@/lib/api-client';

export interface LoginState {
  error: string | null;
}

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get('email') ?? '');
  const password = String(formData.get('password') ?? '');

  if (!email || !password) {
    return { error: 'Email and password are required.' };
  }

  const { apiGatewayUrl } = getServerEnv();
  const api = createApiClient({ baseUrl: apiGatewayUrl });

  try {
    const accessToken = await api.login({ email, password });
    // Per Finding 10 (High): the access token TTL is 15m. The cookie TTL
    // must match — otherwise the cookie outlives the JWT it carries and
    // the user is silently "logged in" with a token that the api-gateway
    // will reject on the next request.
    //
    // Per Finding 18 (Medium): `secure` must be on in any non-dev
    // environment, not just `production`. The pre-existing code used
    // `process.env.NODE_ENV === 'production'`, which would leak the
    // access token in cleartext over HTTP on any staging/preview env.
    const isDev = process.env.NODE_ENV === 'development';
    (await cookies()).set('dtfm_token', accessToken, {
      httpOnly: true,
      secure: !isDev,
      sameSite: 'lax',
      path: '/',
      maxAge: 15 * 60, // 15 minutes — match the access token TTL
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Login failed';
    return { error: message };
  }

  redirect('/dashboard');
}
