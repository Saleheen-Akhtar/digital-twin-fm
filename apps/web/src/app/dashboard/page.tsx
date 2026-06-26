import { getServerEnv } from '@/env';
import {
  createApiClient,
  type Alert,
  type Asset,
  type Building,
  type BuildingSnapshot,
  type Sensor,
  type SensorReading,
  type SnapshotHistoryEntry,
  type WorkOrder,
} from '@/lib/api-client';
import { requireSession } from '@/lib/session';
import { DashboardAlertActions } from './dashboard-alert-actions';
import { DashboardLiveMonitoring } from './dashboard-live-monitoring';
import { DashboardMetricsLive } from './dashboard-metrics-live';
import {
  buildAssetReadingsMap,
  buildFloorLevels,
  buildLiveCharts,
  buildMetrics,
  displayNameFromEmail,
  greetingForHour,
  isOpenAlert,
  type LevelRow,
  type MetricCardData,
} from './dashboard-model';
import { LiveIndicator } from './live-indicator';

export const metadata = { title: 'Dashboard - Digital Twin FM' };
export const dynamic = 'force-dynamic';

type ConnectionState = 'connected' | 'partial' | 'disconnected';
type SourceState = { status: 'ok'; count: number } | { status: 'error'; code: string; message: string };
type PanelSourceId = 'buildings' | 'assets' | 'sensors' | 'alerts' | 'workOrders' | 'snapshot';

type DashboardData = {
  building: Building | null;
  snapshot: BuildingSnapshot | null;
  history: SnapshotHistoryEntry[];
  assets: Asset[];
  sensors: Sensor[];
  alerts: Alert[];
  workOrders: WorkOrder[];
  readingsBySensorId: Map<string, SensorReading[]>;
};

interface LoadResult {
  data: DashboardData;
  sources: Record<PanelSourceId, SourceState>;
  connection: ConnectionState;
  failedCount: number;
}

function settledValue<T>(result: PromiseSettledResult<T>, fallback: T): T {
  return result.status === 'fulfilled' ? result.value : fallback;
}

async function loadSensorReadings(
  api: ReturnType<typeof createApiClient>,
  sensors: Sensor[],
): Promise<Map<string, SensorReading[]>> {
  const chartTypes = ['temperature', 'humidity', 'power', 'co2', 'occupancy'];
  const chartSensors = sensors.filter((s) => chartTypes.includes(s.type));
  const entries = await Promise.all(
    chartSensors.map(async (sensor) => {
      try {
        const readings = await api.findReadings(sensor.id, { limit: 20 });
        return [sensor.id, readings] as [string, SensorReading[]];
      } catch {
        return [sensor.id, [] as SensorReading[]] as [string, SensorReading[]];
      }
    }),
  );
  return new Map(entries);
}

async function loadDashboardData(api: ReturnType<typeof createApiClient>): Promise<LoadResult> {
  const sources: Partial<Record<PanelSourceId, SourceState>> = {};
  let failedCount = 0;

  const buildingRes = await Promise.allSettled([
    (async () => {
      const buildings = await api.findBuildings();
      return buildings[0] ?? null;
    })(),
  ]).then((r) => r[0]);

  const building = settledValue(buildingRes, null);
  sources.buildings =
    buildingRes.status === 'fulfilled'
      ? { status: 'ok', count: building ? 1 : 0 }
      : (failedCount++, {
          status: 'error',
          code: 'BUILDINGS_FAILED',
          message: buildingRes.reason?.message ?? 'Failed to load building',
        });

  const buildingId = building?.id;

  const [snapshotRes, historyRes, assetsRes, sensorsRes, alertsRes, workOrdersRes] =
    await Promise.allSettled([
      buildingId
        ? api.findBuildingSnapshot(buildingId)
        : Promise.resolve({ found: false as const }),
      buildingId
        ? api.findBuildingSnapshotHistory(buildingId, 24)
        : Promise.resolve({ history: [] as SnapshotHistoryEntry[] }),
      api.findAssets(buildingId ? { buildingId } : {}),
      api.findSensors(),
      api.findAlerts(),
      api.findWorkOrders(),
    ]);

  sources.snapshot =
    snapshotRes.status === 'fulfilled'
      ? { status: 'ok', count: snapshotRes.value.found ? 1 : 0 }
      : (failedCount++, {
          status: 'error',
          code: 'SNAPSHOT_FAILED',
          message: snapshotRes.reason?.message ?? 'Failed to load building snapshot',
        });

  sources.assets =
    assetsRes.status === 'fulfilled'
      ? { status: 'ok', count: assetsRes.value.length }
      : (failedCount++, {
          status: 'error',
          code: 'ASSETS_FAILED',
          message: assetsRes.reason?.message ?? 'Failed to load assets',
        });

  sources.sensors =
    sensorsRes.status === 'fulfilled'
      ? { status: 'ok', count: sensorsRes.value.length }
      : (failedCount++, {
          status: 'error',
          code: 'SENSORS_FAILED',
          message: sensorsRes.reason?.message ?? 'Failed to load sensors',
        });

  sources.alerts =
    alertsRes.status === 'fulfilled'
      ? { status: 'ok', count: alertsRes.value.length }
      : (failedCount++, {
          status: 'error',
          code: 'ALERTS_FAILED',
          message: alertsRes.reason?.message ?? 'Failed to load alerts',
        });

  sources.workOrders =
    workOrdersRes.status === 'fulfilled'
      ? { status: 'ok', count: workOrdersRes.value.length }
      : (failedCount++, {
          status: 'error',
          code: 'WORK_ORDERS_FAILED',
          message: workOrdersRes.reason?.message ?? 'Failed to load work orders',
        });

  const connection: ConnectionState =
    failedCount === 0
      ? 'connected'
      : sources.buildings?.status === 'error'
        ? 'disconnected'
        : 'partial';

  const snapshotPayload = settledValue(snapshotRes, { found: false as const });
  const snapshot = snapshotPayload.found ? snapshotPayload.snapshot ?? null : null;
  const history = settledValue(historyRes, { history: [] }).history;
  const assets = settledValue(assetsRes, []);
  const sensors = settledValue(sensorsRes, []);
  const alerts = settledValue(alertsRes, []);
  const workOrders = settledValue(workOrdersRes, []);
  const readingsBySensorId = await loadSensorReadings(api, sensors);

  return {
    data: {
      building,
      snapshot,
      history,
      assets,
      sensors,
      alerts,
      workOrders,
      readingsBySensorId,
    },
    sources: sources as Record<PanelSourceId, SourceState>,
    connection,
    failedCount,
  };
}

export default async function DashboardPage() {
  const session = await requireSession();
  const { apiGatewayUrl } = getServerEnv();
  const api = createApiClient({ baseUrl: apiGatewayUrl, token: session.accessToken });
  const { data, sources, connection, failedCount } = await loadDashboardData(api);

  const levels: LevelRow[] = buildFloorLevels(data.assets);
  const openAlerts = data.alerts.filter(isOpenAlert);
  const metrics: MetricCardData[] = buildMetrics({
    snapshot: data.snapshot,
    history: data.history,
    assets: data.assets,
    alerts: data.alerts,
    workOrders: data.workOrders,
  });
  const liveCharts = buildLiveCharts(data.sensors, data.readingsBySensorId);
  const assetReadingsById = buildAssetReadingsMap(data.sensors);
  const buildingId = data.building?.id ?? '';
  const greeting = greetingForHour(new Date().getHours());
  const userName = displayNameFromEmail(session.email);

  const sensorsError =
    sources.sensors.status === 'error'
      ? sources.sensors
      : null;

  return (
    <div className="flex-1 px-3 pb-4 pt-5 sm:px-5 lg:px-6">
      <div className="mx-auto flex max-w-[1460px] flex-col gap-4">
        <section className="px-2 sm:px-1">
          <h1 className="text-[32px] font-semibold tracking-[-0.04em] text-slate-950">
            {greeting}, {userName} <span className="text-[28px]">👋</span>
          </h1>
          <p className="mt-1 text-[15px] text-slate-500">
            Here&apos;s what&apos;s happening with {data.building?.name ?? 'your facility'}
          </p>
        </section>

        <ConnectionBanner state={connection} sources={sources} failedCount={failedCount} />

        <section className="grid gap-4 xl:grid-cols-6">
          {buildingId ? (
            <DashboardMetricsLive
              buildingId={buildingId}
              initialMetrics={metrics}
              initialSnapshot={data.snapshot}
              initialHistory={data.history}
              assets={data.assets}
              alerts={data.alerts}
              workOrders={data.workOrders}
            />
          ) : (
            metrics.map((card) => <StaticMetricCard key={card.label} {...card} />)
          )}
        </section>

        <section className="w-full">
          <DashboardLiveMonitoring
            initialCharts={liveCharts}
            sensorsError={sensorsError}
          />
        </section>

        <section className="w-full">
          <DashboardAlertActions
            initialAlerts={openAlerts}
            initialWorkOrders={data.workOrders}
          />
        </section>
      </div>
      <div className="mx-auto mt-2 max-w-[1460px] px-2 sm:px-1">
        <LiveIndicator serverTimestamp={new Date().toISOString()} />
      </div>
    </div>
  );
}

function StaticMetricCard({ label, value, tone, sub, spark }: MetricCardData) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_8px_20px_rgba(15,23,42,0.04)]">
      <span className="text-[14px] font-medium text-slate-500">{label}</span>
      <span className={`text-[28px] font-semibold tracking-[-0.03em] ${tone}`}>{value}</span>
      <MiniSparkline data={spark} />
      <span className="text-[13px] text-slate-500">{sub}</span>
    </div>
  );
}

function MiniSparkline({ data }: { data: number[] }) {
  const w = 60;
  const h = 28;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const pts = data
    .map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * (h - 2)}`)
    .join(' ');
  return (
    <svg width={w} height={h} className="shrink-0">
      <polyline points={pts} fill="none" stroke="#355fe5" strokeWidth="2" />
    </svg>
  );
}

function ConnectionBanner({
  state,
  sources,
  failedCount,
}: {
  state: ConnectionState;
  sources: Record<string, SourceState>;
  failedCount: number;
}) {
  if (state === 'connected') return null;
  const errors = Object.entries(sources)
    .filter(([, s]) => s.status === 'error')
    .map(([k, s]) => ({ key: k, msg: s.status === 'error' ? s.message : '' }));
  return (
    <div
      data-testid="connection-banner"
      data-state={state}
      className={`rounded-2xl border px-4 py-3 text-[14px] ${
        state === 'partial'
          ? 'border-amber-200 bg-amber-50 text-amber-800'
          : 'border-red-200 bg-red-50 text-red-800'
      }`}
    >
      <div className="flex items-center gap-2 font-medium" data-testid="connection-banner-headline">
        <span
          className={`h-2.5 w-2.5 rounded-full ${
            state === 'partial' ? 'bg-amber-500' : 'bg-red-500'
          }`}
        />
        {state === 'partial'
          ? `${failedCount} of 6 data sources failed`
          : 'Live data unavailable'}
      </div>
      {errors.length > 0 && (
        <ul className="mt-1 list-inside list-disc text-[13px]">
          {errors.map((e) => (
            <li key={e.key} data-testid={`connection-banner-row-${e.key}`}>
              {e.key}: {e.msg}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
