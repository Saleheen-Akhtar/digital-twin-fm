'use client';

import { useState, type FormEvent } from 'react';

export function LoginForm({ error }: { error: string | null }) {
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    const fd = new FormData(e.currentTarget);
    const body = new URLSearchParams();
    body.set('email', String(fd.get('email') ?? ''));
    body.set('password', String(fd.get('password') ?? ''));
    const res = await fetch('/login', { method: 'POST', body });
    if (res.redirected) {
      window.location.href = res.url;
      return;
    }
    setPending(false);
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4 max-w-sm w-full">
      {error && (
        <div role="alert" className="text-red-400 text-sm">
          {error}
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
