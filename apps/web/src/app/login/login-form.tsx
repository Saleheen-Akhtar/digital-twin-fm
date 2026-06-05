'use client';

import { useActionState } from 'react';
import { loginAction, type LoginState } from './actions';

const initial: LoginState = { error: null };

export function LoginForm() {
  const [state, formAction, pending] = useActionState(loginAction, initial);

  return (
    <form action={formAction} className="flex flex-col gap-4 max-w-sm w-full">
      {state.error && (
        <div role="alert" className="text-red-400 text-sm">
          {state.error}
        </div>
      )}
      <label className="flex flex-col gap-1">
        <span className="text-sm">Email</span>
        <input
          name="email"
          type="email"
          required
          autoComplete="username"
          className="border border-neutral-700 rounded px-3 py-2 bg-neutral-900"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-sm">Password</span>
        <input
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="border border-neutral-700 rounded px-3 py-2 bg-neutral-900"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded px-3 py-2 font-medium"
      >
        {pending ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  );
}
