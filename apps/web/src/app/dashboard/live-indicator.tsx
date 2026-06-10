'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';

interface LiveIndicatorProps {
  /** ISO-8601 string of when the page was server-rendered */
  serverTimestamp: string;
}

export function LiveIndicator({ serverTimestamp }: LiveIndicatorProps) {
  const router = useRouter();
  const [countdown, setCountdown] = useState(30);
  const [clientTs, setClientTs] = useState<string | null>(null);
  const refreshRef = useRef(false);

  const refresh = useCallback(() => {
    router.refresh();
    setCountdown(30);
  }, [router]);

  useEffect(() => {
    setClientTs(new Date().toLocaleString('en-SG', {
      hour: '2-digit', minute: '2-digit',
      day: 'numeric', month: 'short',
    }));
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          refreshRef.current = true;
          return 30;
        }
        return c - 1;
      });
      // Trigger refresh outside the state updater to avoid
      // "Cannot update a component while rendering a different component"
      if (refreshRef.current) {
        refreshRef.current = false;
        router.refresh();
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [router]);

  const serverDate = new Date(serverTimestamp);
  const serverStr = serverDate.toLocaleString('en-SG', {
    hour: '2-digit', minute: '2-digit',
    day: 'numeric', month: 'short',
  });

  return (
    <div className="flex items-center justify-center gap-3 text-[12px] text-slate-400">
      <span className="inline-flex items-center gap-1.5">
        <span className={`inline-block h-1.5 w-1.5 rounded-full ${countdown > 10 ? 'bg-emerald-400' : countdown > 5 ? 'bg-amber-400' : 'bg-red-400'}`} />
        Refreshing in {countdown}s
      </span>
      <span>·</span>
      <span>Data from {serverStr}</span>
      <span>·</span>
      <button
        onClick={refresh}
        className="underline hover:text-slate-600 transition-colors"
      >
        Refresh now
      </button>
      {clientTs && (
        <>
          <span>·</span>
          <span className="text-slate-300">Loaded {clientTs}</span>
        </>
      )}
    </div>
  );
}
