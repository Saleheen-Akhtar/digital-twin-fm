'use client';

import { useActionState } from 'react';
import { loginAction, type LoginState } from './actions';

const initial: LoginState = { error: null };

export function LoginForm() {
  const [state, formAction, pending] = useActionState(loginAction, initial);

  return (
    <form action={formAction} className="flex flex-col gap-6 w-full">
      {state.error && (
        <div role="alert" className="text-white bg-red-600 brutalist-border p-3 text-sm font-bold uppercase tracking-widest text-center shadow-[4px_4px_0px_#111]">
          {state.error}
        </div>
      )}
      <label className="flex flex-col gap-2">
        <span className="text-sm font-black uppercase tracking-widest text-black">Email</span>
        <input
          name="email"
          type="email"
          required
          autoComplete="username"
          className="brutalist-border px-4 py-3 bg-white text-black focus:outline-none focus:ring-4 focus:ring-gray-200 transition-all font-medium"
        />
      </label>
      <label className="flex flex-col gap-2">
        <span className="text-sm font-black uppercase tracking-widest text-black">Password</span>
        <input
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="brutalist-border px-4 py-3 bg-white text-black focus:outline-none focus:ring-4 focus:ring-gray-200 transition-all font-medium"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="btn-brutalist w-full py-4 text-base mt-2"
      >
        {pending ? 'Signing in…' : 'Sign in'}
      </button>

      {/* Demo helper */}
      <div className="mt-4 pt-6 brutalist-border-t border-dashed text-center">
        <p className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">Demo Credentials</p>
        <p className="text-sm font-mono font-medium text-black">admin@demo.com / admin</p>
      </div>
    </form>
  );
}
