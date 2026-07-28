'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { createBrowserApiClient } from '@/lib/browser-api-client';
import { notifyBrowser } from '@/lib/browser-notification';

const SCENARIOS = [
  { id: 'normal', label: 'Normal', icon: '✅' },
  { id: 'chiller_failure', label: 'Chiller Failure', icon: '❄️🔴' },
  { id: 'power_surge_floor_3', label: 'Power Surge', icon: '⚡' },
  { id: 'severe_temp_breach', label: 'Temp Breach', icon: '🌡️🔥' },
] as const;

type ScenarioId = (typeof SCENARIOS)[number]['id'];

export function DemoControls() {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<string | null>(null);
  const [status, setStatus] = useState<{ text: string; ok: boolean } | null>(null);
  const [mounted, setMounted] = useState(false);
  const [notifPerm, setNotifPerm] = useState<NotificationPermission | 'unavailable'>('default');
  const api = createBrowserApiClient();

  useEffect(() => {
    setMounted(true);
    // Read current notification permission on mount
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setNotifPerm(Notification.permission);
    } else {
      setNotifPerm('unavailable');
    }
  }, []);

  async function requestNotificationPermission() {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      setNotifPerm('unavailable');
      return;
    }
    const perm = await Notification.requestPermission();
    setNotifPerm(perm);
  }

  function showStatus(text: string, ok: boolean) {
    console.log('[Demo]', text);
    setStatus({ text, ok });
    setTimeout(() => setStatus(null), 4000);
  }

  async function handleScenario(scenario: ScenarioId) {
    setActive(`scenario:${scenario}`);
    try {
      const res = await api.post<{ success: boolean; scenario: string }>(
        '/demo/scenario',
        { scenario },
      );
      if (res.success) {
        showStatus(`✓ ${res.scenario}`, true);
      }
    } catch (err) {
      showStatus('✗ Scenario failed', false);
      console.error('[Demo] Scenario failed:', err);
    } finally {
      setActive(null);
    }
  }

  async function handleInjectAnomaly() {
    setActive('inject');
    try {
      // Inject a temperature reading of 48°C to trigger threshold breach
      const sensorId = 'anomaly-demo-test';
      const res = await api.post<{ success: boolean }>(
        '/demo/inject-reading',
        {
          sensorId,
          assetId: sensorId,
          value: 48,
          unit: 'C',
          quality: 'bad',
        },
      );
      if (res.success) {
        showStatus('✓ 48°C anomaly injected', true);
      }
    } catch (err) {
      showStatus('✗ Inject failed', false);
      console.error('[Demo] Inject failed:', err);
    } finally {
      setActive(null);
    }
  }

  return (
    <>
      {/* Portal toast — renders at <body>, immune to parent stacking context */}
      {mounted && status && createPortal(
        <div className={`fixed bottom-32 left-1/2 z-[9999] -translate-x-1/2 rounded-xl px-4 py-2.5 text-[14px] font-semibold shadow-2xl animate-in fade-in slide-in-from-bottom-2 duration-300 ${
          status.ok
            ? 'bg-emerald-600 text-white'
            : 'bg-red-600 text-white'
        }`}>
          <span className="mr-2">{status.ok ? '✓' : '✗'}</span>
          {status.text}
        </div>,
        document.body,
      )}

      {/* Floating toggle button */}
      <button
        onClick={() => setOpen(!open)}
        className="fixed bottom-6 right-6 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-slate-900 text-white shadow-lg hover:bg-slate-700 transition-all"
        title="Demo Controls"
      >
        <span className="text-lg">{open ? '✕' : '🎛️'}</span>
      </button>

      {/* Demo panel */}
      {open && (
        <div className="fixed bottom-20 right-6 z-50 w-72 rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl">
          <h3 className="mb-1 text-[13px] font-semibold text-slate-500 uppercase tracking-wider">
            Demo Controls
          </h3>
          <p className="mb-3 text-[11px] text-slate-400">
            Trigger scenarios and anomalies for live demos.
          </p>

          {/* Status feedback */}
          {status && (
            <div className={`mb-3 rounded-lg px-3 py-2 text-[12px] font-medium ${
              status.ok
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                : 'bg-red-50 text-red-700 border border-red-200'
            }`}>
              {status.text}
            </div>
          )}

          {/* Notification permission */}
          {notifPerm !== 'granted' && notifPerm !== 'unavailable' && (
            <button
              onClick={requestNotificationPermission}
              className="mb-3 w-full rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-[12px] font-medium text-sky-700 transition-all hover:bg-sky-100"
            >
              🔔 Enable Chrome Notifications
            </button>
          )}
          {notifPerm === 'granted' && (
            <p className="mb-3 text-[11px] font-medium text-emerald-600">
              🔔 Notifications enabled
            </p>
          )}

          {/* Scenario buttons */}
          <div className="mb-3 space-y-1.5">
            <p className="text-[11px] font-medium text-slate-400">Simulator Scenarios</p>
            {SCENARIOS.map((s) => (
              <button
                key={s.id}
                onClick={() => handleScenario(s.id)}
                disabled={active === `scenario:${s.id}`}
                className={`w-full rounded-xl border px-3 py-2 text-left text-[13px] transition-all ${
                  s.id === 'normal'
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                    : 'border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100'
                } disabled:opacity-50`}
              >
                {active === `scenario:${s.id}` ? (
                  <span className="inline-block w-4">⏳</span>
                ) : (
                  <span className="inline-block w-4">{s.icon}</span>
                )}
                <span className="ml-2">{s.label}</span>
              </button>
            ))}
          </div>

          {/* Inject anomaly */}
          <button
            onClick={handleInjectAnomaly}
            disabled={active === 'inject'}
            className="w-full rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-left text-[13px] text-red-800 transition-all hover:bg-red-100 disabled:opacity-50"
          >
            {active === 'inject' ? '⏳' : '🚨'}{' '}
            <span className="ml-1">Inject Anomaly Reading (48°C)</span>
          </button>

          <button
            onClick={async () => {
              setActive('alert');
              try {
                const res = await api.post<{ success: boolean }>(
                  '/demo/inject-alert',
                  {
                    assetId: 'demo-asset-001',
                    message: 'Simulated 23rd Critical Alert from Demo Controls',
                    severity: 'critical',
                  },
                );
                showStatus(
                  res?.success
                    ? '✓ Critical alert injected'
                    : '✗ Alert injection returned error',
                  !!res?.success,
                );
                if (res?.success) {
                  notifyBrowser('🚨 Critical Alert — Digital Twin FM', {
                    body: 'Asset: demo-asset-001\nSeverity: critical\nSimulated 23rd Critical Alert from Demo Controls',
                    tag: 'demo-alert',
                    onClickUrl: '/dashboard/alerts',
                  });
                }
              } catch (e) {
                console.error('[Demo] Alert inject failed:', e);
                showStatus('✗ Alert injection failed', false);
              } finally {
                setActive(null);
              }
            }}
            disabled={active === 'alert'}
            className="mt-1.5 w-full rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-left text-[13px] text-rose-800 transition-all hover:bg-rose-100 disabled:opacity-50"
          >
            {active === 'alert' ? '⏳' : '🔔'}{' '}
            <span className="ml-1">Simulate 23rd Alert</span>
          </button>

          <p className="mt-3 text-[10px] text-slate-400 leading-tight">
            Scenarios require the simulator to be running. Injected readings
            flow through the full pipeline (Redis → WebSocket → dashboard).
          </p>
        </div>
      )}
    </>
  );
}
