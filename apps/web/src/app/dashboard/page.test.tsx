import { render, screen } from '@testing-library/react';
import DashboardPage from './page';
import { ApiError } from '@/lib/api-client';

jest.mock('@/env', () => ({
  getServerEnv: () => ({ apiGatewayUrl: 'http://localhost:4000' }),
}));

jest.mock('@/lib/session', () => ({
  requireSession: async () => ({
    userId: '00000000-0000-0000-0000-000000000001',
    email: 'admin@dtfm.local',
    role: 'admin',
    accessToken: 'mock-access-token',
  }),
}));

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    refresh: jest.fn(),
    prefetch: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
  }),
}));

const baseBuildings = [
  {
    id: 'building-1',
    name: 'Singapore - Hall 1',
    address: '1 Convention Drive',
    totalFloors: 5,
    createdAt: '2025-05-21T10:30:00+05:30',
    updatedAt: '2025-05-21T10:30:00+05:30',
  },
];

const baseAssets = [
  { id: 'asset-ahu', buildingId: 'building-1', floorId: 'floor-3', floorLevel: 3, name: 'AHU-301', type: 'ahu', status: 'critical', createdAt: '2025-05-21T10:30:00+05:30', updatedAt: '2025-05-21T10:30:00+05:30' },
  { id: 'asset-temp', buildingId: 'building-1', floorId: 'floor-3', floorLevel: 3, name: 'Temp Sensor 3A', type: 'sensor_only', status: 'warning', createdAt: '2025-05-21T10:30:00+05:30', updatedAt: '2025-05-21T10:30:00+05:30' },
  { id: 'asset-energy', buildingId: 'building-1', floorId: 'floor-1', floorLevel: 1, name: 'Energy Meter 1', type: 'sensor_only', status: 'ok', createdAt: '2025-05-21T10:30:00+05:30', updatedAt: '2025-05-21T10:30:00+05:30' },
  { id: 'asset-occ', buildingId: 'building-1', floorId: 'floor-2', floorLevel: 2, name: 'Occupancy Sensor 1', type: 'sensor_only', status: 'ok', createdAt: '2025-05-21T10:30:00+05:30', updatedAt: '2025-05-21T10:30:00+05:30' },
];

const baseSnapshot = {
  healthScore: 72,
  totalAssets: 4,
  onlineAssets: 2,
  warningAssets: 1,
  criticalAssets: 1,
  offlineAssets: 0,
  activeAlerts: 3,
  criticalAlerts: 1,
  sensorUptime: 88,
  totalSensors: 4,
  onlineSensors: 4,
  avgEnergyKw: 45,
  computedAt: '2025-05-21T10:30:00+05:30',
};

const baseHistory = [
  { healthScore: 70, activeAlerts: 2, onlineAssets: 2, avgEnergyKw: 42, computedAt: '2025-05-21T09:30:00+05:30' },
  { healthScore: 72, activeAlerts: 3, onlineAssets: 2, avgEnergyKw: 45, computedAt: '2025-05-21T10:30:00+05:30' },
];

const baseSensors = [
  { id: 'sensor-temp', assetId: 'asset-ahu', type: 'temperature', unit: '°C', status: 'warning', lastValue: 28.7, lastReadingAt: '2025-05-21T10:30:00+05:30', createdAt: '2025-05-21T10:30:00+05:30' },
  { id: 'sensor-humidity', assetId: 'asset-temp', type: 'humidity', unit: '%', status: 'ok', lastValue: 54, lastReadingAt: '2025-05-21T10:30:00+05:30', createdAt: '2025-05-21T10:30:00+05:30' },
  { id: 'sensor-power', assetId: 'asset-energy', type: 'power', unit: 'kWh', status: 'ok', lastValue: 78, lastReadingAt: '2025-05-21T10:30:00+05:30', createdAt: '2025-05-21T10:30:00+05:30' },
  { id: 'sensor-occ', assetId: 'asset-occ', type: 'occupancy', unit: 'people', status: 'ok', lastValue: 36, lastReadingAt: '2025-05-21T10:30:00+05:30', createdAt: '2025-05-21T10:30:00+05:30' },
];

const baseAlerts = [
  { id: 'alert-1', assetId: 'asset-ahu', severity: 'critical', status: 'open', message: 'Equipment not responding', createdAt: '2025-05-21T10:30:00+05:30' },
  { id: 'alert-2', assetId: 'asset-temp', severity: 'high', status: 'open', message: 'Temp above 28C', createdAt: '2025-05-21T10:30:00+05:30' },
  { id: 'alert-3', assetId: 'asset-energy', severity: 'medium', status: 'open', message: 'Usage above normal', createdAt: '2025-05-21T10:30:00+05:30' },
];

const baseWorkOrders = [
  { id: 'wo-1', assetId: 'asset-ahu', alertId: 'alert-1', title: 'AHU-301 Failure', description: 'Chiller not cooling', type: 'corrective', priority: 'critical', status: 'open', assignedTo: 'user-1', createdAt: '2025-05-21T10:30:00+05:30' }
];

const baseReadings = [
  { sensorId: 'sensor-temp', assetId: 'asset-ahu', timestamp: '2025-05-21T10:30:00+05:30', value: 28.7, quality: 'good' }
];

type MockData<T> = T | Promise<T> | (() => T | Promise<T>);

let mockBuildings: MockData<typeof baseBuildings> = baseBuildings;
let mockSnapshot: MockData<{ found: boolean; snapshot: typeof baseSnapshot }> = { found: true, snapshot: baseSnapshot };
let mockHistory: MockData<{ history: typeof baseHistory }> = { history: baseHistory };
let mockAssets: MockData<typeof baseAssets> = baseAssets;
let mockSensors: MockData<typeof baseSensors> = baseSensors;
let mockAlerts: MockData<typeof baseAlerts> = baseAlerts;
let mockWorkOrders: MockData<typeof baseWorkOrders> = baseWorkOrders;
let mockReadings: MockData<typeof baseReadings> = baseReadings;

jest.mock('@/lib/api-client', () => {
  const actual = jest.requireActual('@/lib/api-client') as typeof import('@/lib/api-client');
  return {
    ...actual,
    createApiClient: () => ({
      findBuildings: () => typeof mockBuildings === 'function' ? mockBuildings() : mockBuildings,
      findBuildingSnapshot: () => typeof mockSnapshot === 'function' ? mockSnapshot() : mockSnapshot,
      findBuildingSnapshotHistory: () => typeof mockHistory === 'function' ? mockHistory() : mockHistory,
      findAssets: () => typeof mockAssets === 'function' ? mockAssets() : mockAssets,
      findSensors: () => typeof mockSensors === 'function' ? mockSensors() : mockSensors,
      findAlerts: () => typeof mockAlerts === 'function' ? mockAlerts() : mockAlerts,
      findWorkOrders: () => typeof mockWorkOrders === 'function' ? mockWorkOrders() : mockWorkOrders,
      findReadings: () => typeof mockReadings === 'function' ? mockReadings() : mockReadings,
    }),
  };
});

jest.mock('@/hooks/useSensorRealtime', () => ({
  useSensorRealtime: () => ({ readings: new Map(), connected: false, error: null }),
}));

jest.mock('./dashboard-metrics-live', () => ({
  DashboardMetricsLive: ({ initialMetrics }: { initialMetrics: Array<{ label: string; value: string; sub: string }> }) => (
    <div data-testid="dashboard-metrics-live">
      {initialMetrics.map((m) => (
        <div key={m.label}>
          <span>{m.label}</span>
          <span>{m.value}</span>
          <span>{m.sub}</span>
        </div>
      ))}
    </div>
  ),
}));

jest.mock('./dashboard-live-monitoring', () => ({
  DashboardLiveMonitoring: () => <div data-testid="dashboard-live-monitoring">Live Monitoring</div>,
}));

const networkErr = () =>
  Promise.reject(
    new ApiError('network_unavailable', 0, 'The service is temporarily unreachable.'),
  );

jest.mock(
  'next/link',
  () =>
    function MockLink({
      children,
      href,
      ...rest
    }: {
      children: React.ReactNode;
      href: string;
      [key: string]: unknown;
    }) {
      return (
        <a href={href} {...rest}>
          {children}
        </a>
      );
    },
);

jest.mock('@/features/digital-twin/panel', () => ({
  DigitalTwinPanel: ({ assets, showHeader }: { assets: Array<{ id: string }>; showHeader?: boolean }) => (
    <div data-testid="digital-twin-panel-mock">
      <div>{showHeader === false ? 'header-hidden' : 'header-visible'}</div>
      <div>{assets.length} assets</div>
    </div>
  ),
}));

describe('DashboardPage', () => {
  beforeEach(() => {
    mockBuildings = () => baseBuildings;
    mockSnapshot = () => ({ found: true, snapshot: baseSnapshot });
    mockHistory = () => ({ history: baseHistory });
    mockAssets = () => baseAssets;
    mockSensors = () => baseSensors;
    mockAlerts = () => baseAlerts;
    mockWorkOrders = () => baseWorkOrders;
    mockReadings = () => baseReadings;
  });

  it('renders the facility dashboard shell', async () => {
    const element = await DashboardPage();
    render(element);

    expect(screen.getByText(/Good (morning|afternoon|evening), Admin/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Recent Alerts' })).toBeInTheDocument();
    expect(screen.getByText('Health Score')).toBeInTheDocument();
    expect(screen.getByText('Active Alerts')).toBeInTheDocument();
    expect(screen.getByText('Assets Online')).toBeInTheDocument();
    expect(screen.getByText('Energy Today')).toBeInTheDocument();
    expect(screen.getByText('Open Work Orders')).toBeInTheDocument();
    expect(screen.getByText('Critical Assets')).toBeInTheDocument();
    expect(screen.getByTestId('dashboard-live-monitoring')).toBeInTheDocument();
  });

  it('shows live values from the API snapshot', async () => {
    const element = await DashboardPage();
    render(element);

    expect(screen.getByText('72%')).toBeInTheDocument();
    expect(screen.getByText('2/4 assets online · 88% sensor uptime')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('45')).toBeInTheDocument();
    expect(screen.getByText('assets need attention')).toBeInTheDocument();
  });

  it('hides the connection banner when every source succeeds', async () => {
    const element = await DashboardPage();
    render(element);

    expect(screen.queryByTestId('connection-banner')).not.toBeInTheDocument();
  });

  it('renders a yellow "Partial" banner when only sensors fail', async () => {
    mockSensors = networkErr;
    const element = await DashboardPage();
    render(element);

    const banner = screen.getByTestId('connection-banner');
    expect(banner).toBeInTheDocument();
    expect(banner.getAttribute('data-state')).toBe('partial');
    expect(screen.getByTestId('connection-banner-headline').textContent).toMatch(
      /1 of 6 data sources failed/,
    );
    expect(screen.getByTestId('connection-banner-row-sensors')).toBeInTheDocument();
  });

  it('renders a red "Offline" banner when every source fails', async () => {
    mockBuildings = networkErr;
    mockSnapshot = networkErr;
    mockHistory = networkErr;
    mockAssets = networkErr;
    mockSensors = networkErr;
    mockAlerts = networkErr;
    mockWorkOrders = networkErr;
    mockReadings = networkErr;
    const element = await DashboardPage();
    render(element);

    const banner = screen.getByTestId('connection-banner');
    expect(banner.getAttribute('data-state')).toBe('disconnected');
    expect(screen.getByTestId('connection-banner-headline').textContent).toMatch(
      /Live data unavailable/,
    );

    expect(screen.getByTestId('connection-banner-row-buildings')).toBeInTheDocument();
    expect(screen.getByTestId('connection-banner-row-assets')).toBeInTheDocument();
    expect(screen.getByTestId('connection-banner-row-sensors')).toBeInTheDocument();
    expect(screen.getByTestId('connection-banner-row-alerts')).toBeInTheDocument();
    expect(screen.getByTestId('connection-banner-row-workOrders')).toBeInTheDocument();
  });
});
