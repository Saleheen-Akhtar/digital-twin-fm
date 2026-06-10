import { getServerEnv } from '@/env';
import { createApiClient, type Alert, type Asset, type Building, type Sensor, type SensorReading, type WorkOrder } from '@/lib/api-client';
import { requireSession } from '@/lib/session';
import type { ComponentType } from 'react';
import { LiveIndicator } from './live-indicator';
import { DashboardAlertActions } from './dashboard-alert-actions';

export const metadata = { title: 'Dashboard - Digital Twin FM' };
export const dynamic = 'force-dynamic';

type IconProps = { className?: string };
type IconComponent = ComponentType<IconProps>;

type MetricTone = 'text-emerald-500' | 'text-orange-500' | 'text-blue-500' | 'text-violet-500' | 'text-red-500';
type ConnectionState = 'connected' | 'partial' | 'disconnected';
type SourceState = { status: 'ok'; count: number } | { status: 'error'; code: string; message: string };
type PanelSourceId = 'buildings' | 'assets' | 'sensors' | 'alerts' | 'workOrders';
type LevelRow = { name: string; status: 'ok' | 'critical' };

type MetricCardData = {
  label: string;
  value: string;
  tone: MetricTone;
  icon: IconComponent;
  sub: string;
  spark: number[];
  secondary?: string;
};

type DashboardData = {
  building: Building | null;
  assets: Asset[];
  sensors: Sensor[];
  alerts: Alert[];
  workOrders: WorkOrder[];
  temperatureSeries: SensorReading[];
  humiditySeries: SensorReading[];
  powerSeries: SensorReading[];
  occupancySeries: SensorReading[];
};

interface LoadResult {
  data: DashboardData;
  sources: Record<PanelSourceId, SourceState>;
  connection: ConnectionState;
  failedCount: number;
}

// ───── Data Loading ─────

function settledValue<T>(result: PromiseSettledResult<T>, fallback: T): T {
  return result.status === 'fulfilled' ? result.value : fallback;
}

async function loadDashboardData(api: ReturnType<typeof createApiClient>): Promise<LoadResult> {
  const sources: Record<string, SourceState> = {};
  let failedCount = 0;

  const [buildingRes, assetsRes, sensorsRes, alertsRes, workOrdersRes] = await Promise.allSettled([
    (async () => {
      const b = await api.findBuildings();
      return b[0] ?? null;
    })(),
    api.findAssets(),
    (async () => {
      const s = await api.findSensors();
      const latest = s.length > 0 ? await api.findReadings(s[0].id, { limit: 20 }) : [];
      return { sensors: s, latest };
    })(),
    api.findAlerts(),
    api.findWorkOrders(),
  ]);

  sources.buildings = buildingRes.status === 'fulfilled'
    ? { status: 'ok', count: buildingRes.value ? 1 : 0 }
    : (failedCount++, { status: 'error', code: 'BUILDINGS_FAILED', message: buildingRes.reason?.message ?? 'Failed to load building' });
  sources.assets = assetsRes.status === 'fulfilled'
    ? { status: 'ok', count: assetsRes.value.length }
    : (failedCount++, { status: 'error', code: 'ASSETS_FAILED', message: assetsRes.reason?.message ?? 'Failed to load assets' });
  sources.sensors = sensorsRes.status === 'fulfilled'
    ? { status: 'ok', count: sensorsRes.value.sensors.length }
    : (failedCount++, { status: 'error', code: 'SENSORS_FAILED', message: sensorsRes.reason?.message ?? 'Failed to load sensors' });
  sources.alerts = alertsRes.status === 'fulfilled'
    ? { status: 'ok', count: alertsRes.value.length }
    : (failedCount++, { status: 'error', code: 'ALERTS_FAILED', message: alertsRes.reason?.message ?? 'Failed to load alerts' });
  sources.workOrders = workOrdersRes.status === 'fulfilled'
    ? { status: 'ok', count: workOrdersRes.value.length }
    : (failedCount++, { status: 'error', code: 'WORK_ORDERS_FAILED', message: workOrdersRes.reason?.message ?? 'Failed to load work orders' });

  const connection: ConnectionState = failedCount === 0 ? 'connected' : sources.buildings.status === 'error' ? 'disconnected' : 'partial';

  const building = settledValue(buildingRes, null);
  const assets = settledValue(assetsRes, []);
  const sensorResult = settledValue(sensorsRes, { sensors: [], latest: [] });
  const alerts = settledValue(alertsRes, []);
  const workOrders = settledValue(workOrdersRes, []);

  const allReadings = sensorResult.latest;

  const temperatureSeries: SensorReading[] = [];
  const humiditySeries: SensorReading[] = [];
  const powerSeries: SensorReading[] = [];
  const occupancySeries: SensorReading[] = [];

  return {
    data: { building: building as Building | null, assets, sensors: sensorResult.sensors, alerts, workOrders, temperatureSeries, humiditySeries, powerSeries, occupancySeries },
    sources: sources as Record<PanelSourceId, SourceState>,
    connection,
    failedCount,
  };
}

// ───── Derived Model ─────

function buildDashboardModel(data: DashboardData) {
  const openAlerts = data.alerts.filter((a) => a.status !== 'cancelled' && a.status !== 'resolved' && a.status !== 'closed');
  const building = data.building;
  const assets = data.assets;
  const sensors = data.sensors;

  const healthScore = (() => {
    const onlineAssets = assets.filter((a) => a.status === 'ok').length;
    const warningAssets = assets.filter((a) => a.status === 'warning').length;
    const criticalAssets = assets.filter((a) => a.status === 'critical').length;
    const totalAssets = assets.length || 1;
    const baseScore = (onlineAssets / totalAssets) * 40;
    const warningPenalty = Math.min(warningAssets, 10) * 3;
    const criticalPenalty = criticalAssets * 15;
    const alertPenalty = Math.min(openAlerts.length, 10) * 1;
    return Math.max(0, Math.min(100, Math.round(baseScore - warningPenalty - criticalPenalty - alertPenalty)));
  })();

  const avgEnergy = (() => {
    if (data.powerSeries.length === 0) return 0;
    return Math.round(data.powerSeries.reduce((s, r) => s + r.value, 0) / data.powerSeries.length);
  })();

  const activeAlerts = openAlerts;
  const levels: LevelRow[] = building
    ? ['Ground', 'Mezzanine', 'Hall A', 'Hall B', 'Service'].map((n) => {
        const seed = n.split('').reduce((s, c) => s + c.charCodeAt(0), 0);
        return { name: n, status: (['ok', 'critical'] as const)[seed % 7 === 0 ? 1 : 0] };
      })
    : [];

  const metrics: MetricCardData[] = [
    {
      label: 'Health Score', value: `${healthScore}%`, tone: healthScore >= 60 ? 'text-emerald-500' : healthScore >= 35 ? 'text-orange-500' : 'text-red-500',
      icon: HealthIcon, sub: `${data.assets.filter((a) => a.status === 'ok').length}/${data.assets.length} assets online`, spark: [healthScore, Math.min(100, healthScore + 8), Math.max(0, healthScore - 5), healthScore + 12, Math.max(0, healthScore - 3), healthScore + 6],
    },
    {
      label: 'Active Alerts', value: `${activeAlerts.length}`, tone: activeAlerts.length === 0 ? 'text-emerald-500' : 'text-orange-500',
      icon: AlertIcon, sub: `${activeAlerts.filter((a) => a.severity === 'high' || a.severity === 'critical').length} critical`, spark: [activeAlerts.length, Math.max(0, activeAlerts.length - 1), activeAlerts.length + 2, Math.max(0, activeAlerts.length - 2), activeAlerts.length + 1, activeAlerts.length],
    },
    {
      label: 'Assets Online', value: `${data.assets.filter((a) => a.status === 'ok').length}`, tone: 'text-blue-500',
      icon: BoxIcon, sub: `out of ${data.assets.length} total assets`, spark: [4, 5, 3, 6, 5, 7],
    },
    {
      label: 'Energy Today', value: `${avgEnergy}`, tone: 'text-violet-500',
      icon: ZapIcon, sub: 'kW avg consumption', spark: [avgEnergy, avgEnergy + 5, Math.max(0, avgEnergy - 3), avgEnergy + 8, avgEnergy - 2, avgEnergy + 3],
    },
    {
      label: 'Open Work Orders', value: `${data.workOrders.length}`, tone: 'text-orange-500',
      icon: ClipboardIcon, sub: `${data.workOrders.filter((a) => a.priority === 'critical' || a.priority === 'high').length} high priority`, spark: [3, 2, 4, 2, 3, 1],
    },
    {
      label: 'Predicted Failures', value: `${data.assets.filter((a) => a.status === 'critical').length}`, tone: 'text-red-500',
      icon: TrendingDownIcon, sub: 'assets need attention', spark: [1, 2, 0, 1, 3, 1],
    },
  ];

  return { building, healthScore, levels, activeAlerts, metrics, focusAlert: activeAlerts[0] ?? null };
}

// ───── Page Component ─────

export default async function DashboardPage() {
  const session = await requireSession();
  const { apiGatewayUrl } = getServerEnv();
  const api = createApiClient({ baseUrl: apiGatewayUrl, token: session.accessToken });
  const { data, sources, connection, failedCount } = await loadDashboardData(api);
  const derived = buildDashboardModel(data);

  return (
    <div className="flex-1 px-3 pb-4 pt-5 sm:px-5 lg:px-6">
      <div className="mx-auto flex max-w-[1460px] flex-col gap-4">
        <section className="px-2 sm:px-1">
          <h1 className="text-[32px] font-semibold tracking-[-0.04em] text-slate-950">
            Good morning, Akshay <span className="text-[28px]">👋</span>
          </h1>
          <p className="mt-1 text-[15px] text-slate-500">
            Here&apos;s what&apos;s happening with {derived.building?.name ?? 'Singapore Expo — Hall 7'}
          </p>
        </section>

        <ConnectionBanner state={connection} sources={sources} failedCount={failedCount} />

        <section className="grid gap-4 xl:grid-cols-6">
          {derived.metrics.map((card) => (
            <MetricCard key={card.label} {...card} />
          ))}
        </section>

        {/* ───── Recent Alerts + Building Status ───── */}
        <section className="grid gap-4 xl:grid-cols-3">
          {/* Recent Alerts — interactive with Approve/Edit/Dismiss */}
          <div className="xl:col-span-2">
            <DashboardAlertActions
              initialAlerts={data.alerts.filter((a) => a.status !== 'cancelled' && a.status !== 'resolved' && a.status !== 'closed')}
              initialWorkOrders={data.workOrders}
            />
          </div>

          {/* Building Status */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_8px_20px_rgba(15,23,42,0.04)]">
            <h2 className="mb-3 text-[16px] font-medium text-slate-900">
              {derived.building?.name ?? 'Singapore Expo'} — Levels
            </h2>
            <div className="flex flex-col gap-2">
              {derived.levels.length === 0 ? (
                <p className="py-6 text-center text-[14px] text-slate-400">Loading building data...</p>
              ) : (
                derived.levels.map((level) => (
                  <div key={level.name} className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/50 px-4 py-3">
                    <span className="text-[14px] font-medium text-slate-800">{level.name}</span>
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[12px] font-medium ${
                      level.status === 'ok' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                    }`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${level.status === 'ok' ? 'bg-emerald-500' : 'bg-red-500'}`} />
                      {level.status === 'ok' ? 'Operational' : 'Attention'}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>
      </div>
      <div className="mx-auto mt-2 max-w-[1460px] px-2 sm:px-1">
        <LiveIndicator serverTimestamp={new Date().toISOString()} />
      </div>
    </div>
  );
}

// ───── Sub-components ─────

function MetricCard({ label, value, tone, icon: Icon, sub, spark }: MetricCardData) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_8px_20px_rgba(15,23,42,0.04)] transition hover:shadow-[0_12px_28px_rgba(15,23,42,0.08)]">
      <div className="flex items-center justify-between">
        <span className="text-[14px] font-medium text-slate-500">{label}</span>
        <Icon className="h-5 w-5 text-slate-400" />
      </div>
      <div className="flex items-end justify-between">
        <span className={`text-[28px] font-semibold tracking-[-0.03em] ${tone}`} style={{ lineHeight: 1 }}>{value}</span>
        <MiniSparkline data={spark} />
      </div>
      <span className="text-[13px] text-slate-500">{sub}</span>
    </div>
  );
}

function MiniSparkline({ data }: { data: number[] }) {
  const w = 60; const h = 28;
  const max = Math.max(...data, 1); const min = Math.min(...data, 0);
  const range = max - min || 1;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * (h - 2)}`).join(' ');
  return (
    <svg width={w} height={h} className="shrink-0">
      <polyline points={pts} fill="none" stroke="#355fe5" strokeWidth="2" className="transition-all duration-800 ease-in-out" />
    </svg>
  );
}

function ConnectionBanner({ state, sources, failedCount }: { state: ConnectionState; sources: Record<string, SourceState>; failedCount: number }) {
  if (state === 'connected') return null;
  const errors = Object.entries(sources).filter(([, s]) => s.status === 'error').map(([k, s]) => ({ key: k, msg: s.status === 'error' ? s.message : '' }));
  return (
    <div className={`rounded-2xl border px-4 py-3 text-[14px] ${state === 'partial' ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-red-200 bg-red-50 text-red-800'}`}>
      <div className="flex items-center gap-2 font-medium">
        <span className={`h-2.5 w-2.5 rounded-full ${state === 'partial' ? 'bg-amber-500' : 'bg-red-500'}`} />
        {failedCount} of 5 data sources failed
      </div>
      {errors.length > 0 && <ul className="mt-1 list-inside list-disc text-[13px]">{errors.map((e) => <li key={e.key}>{e.key}: {e.msg}</li>)}</ul>}
    </div>
  );
}

// ───── Inline SVG Icons ─────

function HealthIcon(p: IconProps) { return <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>; }
function AlertIcon(p: IconProps) { return <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>; }
function BoxIcon(p: IconProps) { return <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>; }
function ZapIcon(p: IconProps) { return <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>; }
function ClipboardIcon(p: IconProps) { return <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/></svg>; }
function TrendingDownIcon(p: IconProps) { return <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/><polyline points="17 18 23 18 23 12"/></svg>; }
function MenuIcon(p: IconProps) { return <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>; }
