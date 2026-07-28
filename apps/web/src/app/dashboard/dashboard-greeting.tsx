'use client';

import { useEffect, useState } from 'react';
import { createBrowserApiClient } from '@/lib/browser-api-client';
import { greetingForHour } from './dashboard-model';

interface UserProfile {
  id: string;
  email: string;
  role: string;
  displayName: string;
}

export function DashboardGreeting({
  fallbackName,
}: {
  fallbackName: string;
}) {
  const [name, setName] = useState(fallbackName);

  useEffect(() => {
    const api = createBrowserApiClient();

    async function fetchProfile() {
      try {
        const profile = await api.get<UserProfile>('/auth/me');
        if (profile.displayName && profile.displayName !== 'User') {
          setName(profile.displayName);
        }
      } catch {
        // Silent — keep SSR fallback
      }
    }

    // Fetch on mount to get the latest profile
    void fetchProfile();

    // Re-fetch whenever profile is saved from the admin panel
    function onProfileUpdated() {
      void fetchProfile();
    }
    window.addEventListener('profile-updated', onProfileUpdated);
    return () => window.removeEventListener('profile-updated', onProfileUpdated);
  }, [fallbackName]);

  const istTime = new Date(
    new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }),
  );
  const greeting = greetingForHour(istTime.getHours());

  return (
    <h1 className="text-[32px] font-semibold tracking-[-0.04em] text-slate-950">
      {greeting}, {name} <span className="text-[28px]">👋</span>
    </h1>
  );
}
