'use client';

import { useCallback, useEffect, useState } from 'react';
import { createBrowserApiClient } from '@/lib/browser-api-client';

interface UserProfile {
  id: string;
  email: string;
  role: string;
  displayName: string;
}

export function AdminProfile() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    createBrowserApiClient()
      .get<UserProfile>('/auth/me')
      .then((data) => {
        setProfile(data);
        setDraftName(data.displayName ?? '');
      })
      .catch(() => {});
  }, []);

  const handleSave = useCallback(async () => {
    if (!profile) return;
    setSaving(true);
    setError(null);
    try {
      const api = createBrowserApiClient();
      const updated = await api.patch<UserProfile>('/auth/me', { displayName: draftName.trim() || profile.email.split('@')[0] });
      setProfile(updated);
      setDraftName(updated.displayName);
      setEditing(false);
    } catch {
      setError('Network error');
    } finally {
      setSaving(false);
    }
  }, [profile, draftName]);

  const initials = profile
    ? (profile.displayName || profile.email)
        .split(' ')
        .map((s) => s[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : '??';

  const roleLabel = profile?.role === 'admin' ? 'Admin' : profile?.role ?? '';

  return (
    <div className="group relative px-2 py-2.5">
      {error && (
        <div className="absolute -top-1 left-2 right-2 rounded bg-red-50 px-2 py-1 text-xs text-red-600 shadow-sm">
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
                className="w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-sm font-semibold text-slate-800 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-300"
                placeholder="Display name"
                autoFocus
              />
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
              disabled={saving}
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
