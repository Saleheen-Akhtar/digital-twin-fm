import type { ComponentType } from 'react';

export type IconProps = { className?: string };
export type IconComponent = ComponentType<IconProps>;

export type SidebarItem = {
  label: string;
  icon: IconComponent;
  active?: boolean;
  badge?: string;
  href?: string;
};

export type MetricTone = 'text-emerald-500' | 'text-orange-500' | 'text-blue-500' | 'text-violet-500' | 'text-red-500';

export type MetricCardData = {
  label: string;
  value: string;
  tone: MetricTone;
  icon: IconComponent;
  sub: string;
  spark: number[];
  secondary?: string;
};

export type ChartTone = 'red' | 'green' | 'blue' | 'violet';

export type ChartCardData = {
  metric: 'temperature' | 'energy' | 'humidity' | 'occupancy';
  title: string;
  value: string;
  toneClass: MetricTone;
  icon: IconComponent;
  line: ChartTone;
  points: number[];
};

export type AlertRow = {
  id: string;
  severity: string;
  title: string;
  description: string;
  asset: string;
  zone: string;
  time: string;
  tone: MetricTone;
};

export type WorkOrderRow = {
  id: string;
  title: string;
  priority: 'Low' | 'Medium' | 'High';
  status: 'Open' | 'Assigned' | 'In Progress';
  assignee: string;
  due: string;
};

export type LevelRow = { name: string; status: 'ok' | 'critical' };

export type ConnectionState = 'connected' | 'partial' | 'disconnected';

export type SourceState =
  | { status: 'ok'; count: number }
  | { status: 'error'; code: string; message: string };

export type PanelSourceId = 'buildings' | 'assets' | 'sensors' | 'alerts' | 'workOrders';

export type LoadResult = {
  sources: Record<PanelSourceId, SourceState>;
  connection: ConnectionState;
  failedCount: number;
};
