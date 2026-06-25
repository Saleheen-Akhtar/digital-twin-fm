'use client';

import { createBrowserApiClient } from '@/lib/browser-api-client';
import type { Alert, WorkOrder } from '@digital-twin-fm/types';
import { useCallback, useState, useMemo } from 'react';



function smartShortId(id: string): string {
  if (!id) return '—';
  const hex = id.replace(/-/g, '');
  return '#' + hex.slice(0, 6).toUpperCase();
}

function friendlyAlertMessage(raw: string): string {
  // Parse structured alert messages
  const m = raw.match(/value\s+([\d.]+)\s+(\S+)\s+(below|above)\s+(low|high)\s+threshold\s+([\d.]+)/);
  if (m) {
    const labels: Record<string, string> = { C: 'Temp', '°C': 'Temp', ppm: 'CO₂', '%': 'Humidity', kW: 'Power' };
    const label = labels[m[2]] ?? m[2];
    return `${label} ${m[3]} ${m[4]} — ${m[1]}${m[2]} (target ${m[4] === 'low' ? '≥' : '≤'} ${m[5]}${m[2]})`;
  }
  return raw;
}

function generateWOTitle(alert: Alert): string {
  const friendly = friendlyAlertMessage(alert.message);
  // Truncate if too long for a title
  return friendly.length > 70
    ? `Inspect ${smartShortId(alert.assetId || '')} - ${alert.message.slice(0, 50)}`
    : `Inspect ${smartShortId(alert.assetId || '')} - ${friendly}`;
}

interface Props {
  initialAlerts: Alert[];
  initialWorkOrders: WorkOrder[];
}

export function DashboardAlertActions({ initialAlerts, initialWorkOrders }: Props) {
  const [alerts, setAlerts] = useState(initialAlerts);
  const [workOrders, setWorkOrders] = useState(initialWorkOrders);
  const [loadingWO, setLoadingWO] = useState<string | null>(null);
  const [dismissing, setDismissing] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<{ id: string; text: string } | null>(null);
  const [editForm, setEditForm] = useState<{ open: boolean; alert: Alert | null; title: string; priority: string }>({
    open: false, alert: null, title: '', priority: 'medium',
  });
  const api = createBrowserApiClient();

  // Alerts that don't have a linked work order yet (pending approval)
  const pending = useMemo(() => {
    const woAlertIds = new Set(workOrders.filter((wo) => wo.alertId).map((wo) => wo.alertId));
    return alerts.filter(
      (a) => a.status !== 'cancelled' && a.status !== 'resolved' && a.status !== 'closed'
        && !woAlertIds.has(a.id)
    );
  }, [alerts, workOrders]);

  const handleApprove = useCallback(async (alert: Alert) => {
    setLoadingWO(alert.id);
    try {
      // Auto-generate work order + acknowledge alert in parallel
      const title = generateWOTitle(alert);
      const priority = alert.severity === 'critical' || alert.severity === 'high' ? 'high' : 'medium';
      await Promise.all([
        api.post('/work-orders', {
          title,
          assetId: alert.assetId || '',
          alertId: alert.id,
          priority,
          description: `Auto-generated from alert: ${alert.message}`,
        }),
        api.patch('/alerts/' + alert.id, { status: 'acknowledged' }),
      ]);
      setActionMsg({ id: alert.id, text: '✅ Work order created' });
      // Refresh alerts and work orders
      const [freshAlerts, freshWOs] = await Promise.all([
        api.get<Alert[]>('/alerts'),
        api.get<WorkOrder[]>('/work-orders'),
      ]);
      setAlerts(Array.isArray(freshAlerts) ? freshAlerts.filter((a) => a.status !== 'cancelled' && a.status !== 'resolved' && a.status !== 'closed') : []);
      setWorkOrders(Array.isArray(freshWOs) ? freshWOs : []);
    } catch (err) {
      console.error('Approve failed', err);
      setActionMsg({ id: alert.id, text: '❌ Failed' });
    } finally {
      setLoadingWO(null);
    }
  }, [api]);

  const handleDismiss = useCallback(async (alert: Alert) => {
    setDismissing(alert.id);
    try {
      await api.patch('/alerts/' + alert.id, { status: 'acknowledged' });
      setActionMsg({ id: alert.id, text: '✅ Dismissed' });
      setAlerts((prev) => prev.filter((a) => a.id !== alert.id));
    } catch (err) {
      console.error('Dismiss failed', err);
      setActionMsg({ id: alert.id, text: '❌ Failed' });
    } finally {
      setDismissing(null);
    }
  }, [api]);

  const handleEditSave = useCallback(async () => {
    if (!editForm.alert) return;
    setLoadingWO(editForm.alert.id);
    try {
      await Promise.all([
        api.post('/work-orders', {
          title: editForm.title,
          assetId: editForm.alert.assetId || '',
          alertId: editForm.alert.id,
          priority: editForm.priority,
          description: `Custom work order from alert: ${editForm.alert.message}`,
        }),
        api.patch('/alerts/' + editForm.alert.id, { status: 'acknowledged' }),
      ]);
      setActionMsg({ id: editForm.alert.id, text: '✅ Work order created' });
      const [freshAlerts, freshWOs] = await Promise.all([
        api.get<Alert[]>('/alerts'),
        api.get<WorkOrder[]>('/work-orders'),
      ]);
      setAlerts(Array.isArray(freshAlerts) ? freshAlerts.filter((a) => a.status !== 'cancelled' && a.status !== 'resolved' && a.status !== 'closed') : []);
      setWorkOrders(Array.isArray(freshWOs) ? freshWOs : []);
      setEditForm({ open: false, alert: null, title: '', priority: 'medium' });
    } catch (err) {
      console.error('Edit save failed', err);
      setActionMsg({ id: editForm.alert.id || '', text: '❌ Failed' });
    } finally {
      setLoadingWO(null);
    }
  }, [editForm, api]);

  if (alerts.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_8px_20px_rgba(15,23,42,0.04)]">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[16px] font-medium text-slate-900">Recent Alerts</h2>
          <a href="/dashboard/alerts" className="text-[13px] font-medium text-blue-600 hover:text-blue-700">View all →</a>
        </div>
        <p className="py-6 text-center text-[14px] text-slate-400">No open alerts — all clear!</p>
      </div>
    );
  }

  return (
    <>
      {/* Pending Approvals summary */}
      {pending.length > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-500 text-[13px] font-bold text-white">
              {pending.length}
            </span>
            <span className="text-[14px] font-medium text-amber-900">
              {pending.length === 1 ? '1 alert' : `${pending.length} alerts`} need work order approval
            </span>
          </div>
          <p className="mt-1 text-[13px] text-amber-700">
            Review and approve suggested work orders below, or dismiss alerts that don&apos;t need action.
          </p>
        </div>
      )}

      {/* Recent Alerts table with actions */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_8px_20px_rgba(15,23,42,0.04)]">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[16px] font-medium text-slate-900">Recent Alerts</h2>
          <a href="/dashboard/alerts" className="text-[13px] font-medium text-blue-600 hover:text-blue-700">View all →</a>
        </div>
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-slate-100 text-[12px] text-slate-500">
              <th className="pb-2 pr-3 font-medium" />
              <th className="pb-2 pr-3 font-medium">Alert</th>
              <th className="pb-2 pr-3 font-medium">Actions</th>
              <th className="pb-2 pr-3 font-medium">Time</th>
              <th className="pb-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {alerts.slice(0, 10).map((alert) => {
              const isPending = pending.some((p) => p.id === alert.id);
              return (
                <tr key={alert.id} className="border-b border-slate-50 text-[13px] last:border-0">
                  <td className="py-2.5 pr-3">
                    <span className={`inline-block h-2 w-2 rounded-full ${
                      alert.severity === 'critical' ? 'bg-red-500' :
                      alert.severity === 'high' ? 'bg-orange-500' :
                      alert.severity === 'medium' ? 'bg-amber-400' : 'bg-slate-300'
                    }`} />
                  </td>
                  <td className="py-2.5 pr-3 text-slate-900 max-w-[280px]">
                    <div className="truncate">{friendlyAlertMessage(alert.message)}</div>
                    {alert.assetId && (
                      <div className="mt-0.5 text-[11px] font-mono text-slate-400">
                        {smartShortId(alert.assetId)}
                      </div>
                    )}
                  </td>
                  <td className="py-2.5 pr-3">
                    {loadingWO === alert.id ? (
                      <span className="text-[12px] text-slate-400">Creating...</span>
                    ) : dismissing === alert.id ? (
                      <span className="text-[12px] text-slate-400">Dismissing...</span>
                    ) : actionMsg?.id === alert.id ? (
                      <span className={`text-[12px] ${actionMsg.text.startsWith('✅') ? 'text-emerald-600' : 'text-red-600'}`}>
                        {actionMsg.text}
                      </span>
                    ) : isPending ? (
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleApprove(alert)}
                          className="rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-emerald-700 transition-colors"
                        >
                          ✓ Approve
                        </button>
                        <button
                          onClick={() => {
                            setEditForm({
                              open: true,
                              alert,
                              title: generateWOTitle(alert),
                              priority: alert.severity === 'critical' || alert.severity === 'high' ? 'high' : 'medium',
                            });
                          }}
                          className="rounded-lg bg-white border border-slate-300 px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDismiss(alert)}
                          className="rounded-lg px-2.5 py-1 text-[11px] font-medium text-slate-400 hover:text-red-600 transition-colors"
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <span className="text-[12px] text-slate-400">WO created</span>
                    )}
                  </td>
                  <td className="py-2.5 pr-3 text-slate-500 whitespace-nowrap">
                    {alert.createdAt
                      ? new Date(alert.createdAt).toLocaleString('en-SG', {
                          month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                        })
                      : '—'}
                  </td>
                  <td className="py-2.5">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${
                      alert.status === 'open' ? 'bg-red-100 text-red-700' :
                      alert.status === 'acknowledged' ? 'bg-amber-100 text-amber-700' :
                      'bg-blue-100 text-blue-700'
                    }`}>
                      {alert.status}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Edit Modal */}
      {editForm.open && editForm.alert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-[18px] font-semibold text-slate-900">Edit Work Order</h3>
            <p className="mt-1 text-[13px] text-slate-500">
              From alert {smartShortId(editForm.alert.id)}
            </p>
            <div className="mt-4 flex flex-col gap-3">
              <div>
                <label className="text-[13px] font-medium text-slate-700">Title</label>
                <input
                  value={editForm.title}
                  onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-[14px] outline-none focus:border-blue-400"
                />
              </div>
              <div>
                <label className="text-[13px] font-medium text-slate-700">Priority</label>
                <select
                  value={editForm.priority}
                  onChange={(e) => setEditForm((f) => ({ ...f, priority: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-[14px] outline-none focus:border-blue-400"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setEditForm({ open: false, alert: null, title: '', priority: 'medium' })}
                className="rounded-xl border border-slate-200 px-4 py-2 text-[13px] font-medium text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleEditSave}
                disabled={!editForm.title.trim()}
                className="rounded-xl bg-blue-600 px-4 py-2 text-[13px] font-medium text-white hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {loadingWO ? 'Creating...' : 'Create WO'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
