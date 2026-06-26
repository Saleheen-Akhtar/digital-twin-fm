import type { Alert, Asset, Sensor, SensorReading, WorkOrder } from '@/lib/api-client';
import type { LiveChartData } from './dashboard-live-monitoring';

export type BuildingSnapshot = {
  healthScore: number;
  totalAssets: number;
  onlineAssets: number;
  warningAssets: number;
  criticalAssets: number;
  offlineAssets: number;
  activeAlerts: number;
  criticalAlerts: number;
  sensorUptime: number;
  totalSensors: number;
  onlineSensors: number;
  avgEnergyKw: number;
  computedAt: string;
};

export type SnapshotHistoryEntry = {
  healthScore: number;
  activeAlerts: number;
  onlineAssets: number;
  avgEnergyKw: number;
  computedAt: string;
};

export type LevelRow = { name: string; status: 'ok' | 'critical' };

export type MetricTone =
  | 'text-emerald-500'
  | 'text-orange-500'
  | 'text-blue-500'
  | 'text-violet-500'
  | 'text-red-500';

export type MetricCardData = {
  label: string;
  value: string;
  tone: MetricTone;
  sub: string;
  spark: number[];
};

const OPEN_ALERT_STATUSES = new Set(['cancelled', 'resolved', 'closed']);
const OPEN_WO_STATUSES = new Set(['completed', 'cancelled']);

export function isOpenAlert(alert: Alert): boolean {
  return !OPEN_ALERT_STATUSES.has(alert.status);
}

export function isOpenWorkOrder(wo: WorkOrder): boolean {
  return !OPEN_WO_STATUSES.has(wo.status);
}

export function buildFloorLevels(assets: Asset[]): LevelRow[] {
  const byFloor = new Map<number, Asset[]>();
  for (const asset of assets) {
    const level = asset.floorLevel ?? 1;
    const list = byFloor.get(level) ?? [];
    list.push(asset);
    byFloor.set(level, list);
  }

  return [...byFloor.entries()]
    .sort(([a], [b]) => a - b)
    .map(([level, floorAssets]) => ({
      name: `Level ${level}`,
      status: floorAssets.some(
        (a) => a.status === 'critical' || a.status === 'warning',
      )
        ? ('critical' as const)
        : ('ok' as const),
    }));
}

function historySpark(
  history: SnapshotHistoryEntry[],
  pick: (entry: SnapshotHistoryEntry) => number,
  fallback: number,
  maxPoints = 12,
): number[] {
  const values = history
    .slice(0, maxPoints)
    .reverse()
    .map(pick)
    .filter((v) => Number.isFinite(v));
  if (values.length >= 2) return values;
  return values.length === 1 ? [values[0], values[0]] : [fallback, fallback];
}

export function buildMetrics(input: {
  snapshot: BuildingSnapshot | null;
  history: SnapshotHistoryEntry[];
  assets: Asset[];
  alerts: Alert[];
  workOrders: WorkOrder[];
}): MetricCardData[] {
  const { snapshot, history, assets, alerts, workOrders } = input;
  const openAlerts = alerts.filter(isOpenAlert);
  const openWorkOrders = workOrders.filter(isOpenWorkOrder);
  const criticalAssets = assets.filter((a) => a.status === 'critical').length;
  const onlineAssets = snapshot?.onlineAssets ?? assets.filter((a) => a.status === 'ok').length;
  const totalAssets = snapshot?.totalAssets ?? assets.length;
  const healthScore = snapshot?.healthScore ?? 0;
  const avgEnergy = Math.round(snapshot?.avgEnergyKw ?? 0);
  const highPriorityWo = openWorkOrders.filter(
    (wo) => wo.priority === 'critical' || wo.priority === 'high',
  ).length;

  return [
    {
      label: 'Health Score',
      value: `${healthScore}%`,
      tone:
        healthScore >= 60
          ? 'text-emerald-500'
          : healthScore >= 35
            ? 'text-orange-500'
            : 'text-red-500',
      sub: `${onlineAssets}/${totalAssets} assets online · ${Math.round(snapshot?.sensorUptime ?? 0)}% sensor uptime`,
      spark: historySpark(history, (h) => h.healthScore, healthScore),
    },
    {
      label: 'Active Alerts',
      value: `${openAlerts.length}`,
      tone: openAlerts.length === 0 ? 'text-emerald-500' : 'text-orange-500',
      sub: `${openAlerts.filter((a) => a.severity === 'high' || a.severity === 'critical').length} critical`,
      spark: historySpark(history, (h) => h.activeAlerts, openAlerts.length),
    },
    {
      label: 'Assets Online',
      value: `${onlineAssets}`,
      tone: 'text-blue-500',
      sub: `out of ${totalAssets} total assets`,
      spark: historySpark(history, (h) => h.onlineAssets, onlineAssets),
    },
    {
      label: 'Energy Today',
      value: `${avgEnergy}`,
      tone: 'text-violet-500',
      sub: 'kW avg (last 15 min)',
      spark: historySpark(history, (h) => Math.round(h.avgEnergyKw), avgEnergy),
    },
    {
      label: 'Open Work Orders',
      value: `${openWorkOrders.length}`,
      tone: 'text-orange-500',
      sub: `${highPriorityWo} high priority`,
      spark: [openWorkOrders.length, openWorkOrders.length],
    },
    {
      label: 'Critical Assets',
      value: `${criticalAssets}`,
      tone: 'text-red-500',
      sub: 'assets need attention',
      spark: [criticalAssets, criticalAssets],
    },
  ];
}

const CHART_DEFS: Array<{
  metric: LiveChartData['metric'];
  title: string;
  types: string[];
  toneClass: LiveChartData['toneClass'];
  line: LiveChartData['line'];
}> = [
  {
    metric: 'temperature',
    title: 'Temperature',
    types: ['temperature'],
    toneClass: 'text-red-500',
    line: 'red',
  },
  {
    metric: 'energy',
    title: 'Power',
    types: ['power'],
    toneClass: 'text-emerald-500',
    line: 'green',
  },
  {
    metric: 'humidity',
    title: 'Humidity',
    types: ['humidity'],
    toneClass: 'text-blue-500',
    line: 'blue',
  },
  {
    metric: 'occupancy',
    title: 'CO₂',
    types: ['co2', 'occupancy'],
    toneClass: 'text-violet-500',
    line: 'violet',
  },
];

function formatSensorValue(sensor: Sensor, metric: LiveChartData['metric']): string {
  const value = sensor.lastValue;
  if (value == null || !Number.isFinite(value)) return '--';
  if (metric === 'temperature') return `${value.toFixed(1)}${sensor.unit}`;
  if (sensor.unit === '%' || sensor.unit.startsWith('°')) {
    return `${value.toFixed(0)}${sensor.unit}`;
  }
  return `${value.toFixed(0)} ${sensor.unit}`.trim();
}

export function buildLiveCharts(
  sensors: Sensor[],
  readingsBySensorId: Map<string, SensorReading[]>,
): LiveChartData[] {
  return CHART_DEFS.map((def) => {
    const sensor = sensors.find((s) => def.types.includes(s.type));
    const readings = sensor ? readingsBySensorId.get(sensor.id) ?? [] : [];
    const points = [...readings]
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
      .map((r) => r.value);
    const fallbackPoint =
      sensor?.lastValue != null ? [Number(sensor.lastValue)] : [0];

    return {
      metric: def.metric,
      title: def.title,
      value: sensor ? formatSensorValue(sensor, def.metric) : '--',
      toneClass: def.toneClass,
      line: def.line,
      points: points.length >= 2 ? points.slice(-20) : fallbackPoint,
    };
  });
}

export function buildAssetReadingsMap(sensors: Sensor[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const sensor of sensors) {
    if (sensor.lastValue == null) continue;
    map[sensor.assetId] = `${sensor.lastValue}${sensor.unit}`;
  }
  return map;
}

export function greetingForHour(hour: number): string {
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export function displayNameFromEmail(email: string): string {
  const local = email.split('@')[0] ?? 'there';
  return local.charAt(0).toUpperCase() + local.slice(1);
}
