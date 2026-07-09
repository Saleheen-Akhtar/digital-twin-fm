'use server';

import { cookies, headers } from 'next/headers';
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
    // Per Finding 18 (Medium): `secure` should only be set when the
    // actual connection is HTTPS. `process.env.NODE_ENV === 'production'`
    // is wrong for Docker deployments behind HTTP localhost.
    const secure = (await headers()).get('x-forwarded-proto') === 'https';
    (await cookies()).set('dtfm_token', accessToken, {
      httpOnly: true,
      secure,
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
