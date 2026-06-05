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
    (await cookies()).set('dtfm_token', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 8, // 8 hours
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Login failed';
    return { error: message };
  }

  redirect('/dashboard');
}
