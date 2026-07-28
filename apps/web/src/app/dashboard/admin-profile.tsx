'use client';

import { useCallback, useEffect, useState } from 'react';
import { createBrowserApiClient } from '@/lib/browser-api-client';

interface UserProfile {
  id: string;
  email: string;
  role: string;
  displayName: string;
}

interface UpdateProfileResponse extends UserProfile {
  accessToken: string;
}

const MAX_DISPLAY_NAME = 64;

export function AdminProfile() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Fetch profile on mount ──────────────────────────────────────
  useEffect(() => {
    createBrowserApiClient()
      .get<UserProfile>('/auth/me')
      .then((data) => {
        setProfile(data);
        setDraftName(data.displayName ?? '');
      })
      .catch(() => {
        setError('Could not load profile');
      });
  }, []);

  // ── Client-side validation ─────────────────────────────────────
  const validationError =
    draftName.length > MAX_DISPLAY_NAME
      ? `Max ${MAX_DISPLAY_NAME} characters`
      : /[<>{}\\]/.test(draftName)
        ? 'Angle brackets and braces not allowed'
        : null;

  // ── Save handler ────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    if (!profile) return;
    if (validationError) return;
    setSaving(true);
    setError(null);
    try {
      const api = createBrowserApiClient();
      const updated = await api.patch<UpdateProfileResponse>('/auth/me', {
        displayName: draftName.trim() || profile.email.split('@')[0],
      });
      setProfile(updated);
      setDraftName(updated.displayName);
      setEditing(false);
      // Update the httpOnly cookie so the SSR greeting reflects the new name
      fetch('/api/auth/update-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessToken: updated.accessToken }),
      }).catch(() => {/* non-critical */});
    } catch {
      setError('Network error');
    } finally {
      setSaving(false);
    }
  }, [profile, draftName, validationError]);

  // ── Helpers ─────────────────────────────────────────────────────
  const initials = profile
    ? (profile.displayName || profile.email)
        .split(' ')
        .map((s) => s[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : '??';

  const roleLabel = profile?.role === 'admin' ? 'Admin' : profile?.role ?? '';

  // ── Render ──────────────────────────────────────────────────────
  return (
    <div className="group relative px-2 py-2.5">
      {/* Error toast */}
      {error && (
        <div className="absolute -top-1 left-2 right-2 z-10 rounded bg-red-50 px-2 py-1 text-xs text-red-600 shadow-sm">
          {error}
        </div>
      )}

      {!editing ? (
        // ── Display mode ──────────────────────────────────────────
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-xs font-bold text-white shadow-sm">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="truncate text-sm font-semibold text-slate-800">
              {profile?.displayName || profile?.email.split('@')[0] || 'User'}
            </p>
            <p className="truncate text-xs text-slate-500">{profile?.email ?? ''}</p>
          </div>
          <button
            onClick={() => setEditing(true)}
            className="opacity-0 group-hover:opacity-100 rounded-md px-2 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50 transition-all"
            title="Edit profile"
          >
            Edit
          </button>
        </div>
      ) : (
        // ── Edit mode ─────────────────────────────────────────────
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-xs font-bold text-white shadow-sm">
              {initials}
            </div>
            <div className="flex-1">
              <input
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                maxLength={MAX_DISPLAY_NAME + 16}
                className={`w-full rounded-md border px-2 py-1 text-sm font-semibold text-slate-800 outline-none transition-all focus:ring-1 ${
                  validationError
                    ? 'border-red-400 focus:border-red-400 focus:ring-red-300'
                    : 'border-slate-300 focus:border-blue-400 focus:ring-blue-300'
                }`}
                placeholder="Display name"
                autoFocus
              />
              {validationError && (
                <p className="mt-0.5 text-[10px] text-red-500">{validationError}</p>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400">{profile?.email ?? ''}</span>
            {roleLabel && (
              <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-medium uppercase text-blue-700">
                {roleLabel}
              </span>
            )}
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={saving || !!validationError}
              className="flex-1 rounded-md bg-blue-600 px-2 py-1 text-xs font-medium text-white hover:bg-blue-500 disabled:opacity-50 transition-all"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button
              onClick={() => {
                setEditing(false);
                setDraftName(profile?.displayName ?? '');
                setError(null);
              }}
              disabled={saving}
              className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-all"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
