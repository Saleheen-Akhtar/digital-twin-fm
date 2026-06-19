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

/**
 * Per Finding 14 (High): the dashboard previously used a module-level
 * snapshot and a synthetic fallback to mask API failures. The new
 * implementation captures per-source success/failure and surfaces it
 * via a tri-state `<ConnectionBanner />` + per-panel `<PanelError />`.
 *
 * The mock below uses mutable arrays so each test can swap in a
 * rejecting promise before calling DashboardPage().
 */
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
  { id: 'asset-ahu', buildingId: 'building-1', floorId: '3', name: 'AHU-301', type: 'ahu', status: 'critical', createdAt: '2025-05-21T10:30:00+05:30', updatedAt: '2025-05-21T10:30:00+05:30' },
  { id: 'asset-temp', buildingId: 'building-1', floorId: '3', name: 'Temp Sensor 3A', type: 'sensor_only', status: 'warning', createdAt: '2025-05-21T10:30:00+05:30', updatedAt: '2025-05-21T10:30:00+05:30' },
  { id: 'asset-energy', buildingId: 'building-1', floorId: '1', name: 'Energy Meter 1', type: 'sensor_only', status: 'ok', createdAt: '2025-05-21T10:30:00+05:30', updatedAt: '2025-05-21T10:30:00+05:30' },
  { id: 'asset-occ', buildingId: 'building-1', floorId: '2', name: 'Occupancy Sensor 1', type: 'sensor_only', status: 'ok', createdAt: '2025-05-21T10:30:00+05:30', updatedAt: '2025-05-21T10:30:00+05:30' },
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

// Mutable state — each test can overwrite these before calling
// DashboardPage() to inject failures.
let mockBuildings: MockData<typeof baseBuildings> = baseBuildings;
let mockAssets: MockData<typeof baseAssets> = baseAssets;
let mockSensors: MockData<typeof baseSensors> = baseSensors;
let mockAlerts: MockData<typeof baseAlerts> = baseAlerts;
let mockWorkOrders: MockData<typeof baseWorkOrders> = baseWorkOrders;
let mockReadings: MockData<typeof baseReadings> = baseReadings;

jest.mock('@/lib/api-client', () => {
  // Re-export the real `ApiError` class so tests can construct
  // realistic rejected promises. We override only `createApiClient`.
  const actual = jest.requireActual('@/lib/api-client') as typeof import('@/lib/api-client');
  return {
    ...actual,
    createApiClient: () => ({
      findBuildings: () => typeof mockBuildings === 'function' ? mockBuildings() : mockBuildings,
      findAssets: () => typeof mockAssets === 'function' ? mockAssets() : mockAssets,
      findSensors: () => typeof mockSensors === 'function' ? mockSensors() : mockSensors,
      findAlerts: () => typeof mockAlerts === 'function' ? mockAlerts() : mockAlerts,
      findWorkOrders: () => typeof mockWorkOrders === 'function' ? mockWorkOrders() : mockWorkOrders,
      findReadings: () => typeof mockReadings === 'function' ? mockReadings() : mockReadings,
    }),
  };
});

const networkErr = () =>
  Promise.reject(
    new ApiError('network_unavailable', 0, 'The service is temporarily unreachable.'),
  );

// next/link calls Next.js router hooks, which are not present in the
// jest environment. Mock it as a plain anchor tag so the sidebar
// (and any other component that uses Link) renders cleanly.
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
    // Reset to the happy path between tests.
    mockBuildings = () => baseBuildings;
    mockAssets = () => baseAssets;
    mockSensors = () => baseSensors;
    mockAlerts = () => baseAlerts;
    mockWorkOrders = () => baseWorkOrders;
    mockReadings = () => baseReadings;
  });

  it('renders the facility dashboard shell', async () => {
    const element = await DashboardPage();
    render(element);

    expect(screen.getByText(/Good morning, Akshay/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Recent Alerts' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Levels/i })).toBeInTheDocument();
    expect(screen.getByText('Health Score')).toBeInTheDocument();
    expect(screen.getByText('Active Alerts')).toBeInTheDocument();
    expect(screen.getByText('Assets Online')).toBeInTheDocument();
    expect(screen.getByText('Energy Today')).toBeInTheDocument();
    expect(screen.getByText('Open Work Orders')).toBeInTheDocument();
    expect(screen.getByText('Predicted Failures')).toBeInTheDocument();
  });

  it('shows live values from the API', async () => {
    const element = await DashboardPage();
    render(element);

    // Assert calculated health score card
    expect(screen.getByText('0%')).toBeInTheDocument();
    expect(screen.getByText('2/4 assets online')).toBeInTheDocument();

    // Assert active alerts count
    expect(screen.getByText('3')).toBeInTheDocument();

    // Assert assets online count
    expect(screen.getAllByText('2').length).toBeGreaterThan(0);

    // Assert energy today (no series -> 0)
    expect(screen.getAllByText('0').length).toBeGreaterThan(0);

    // Assert open work orders count
    expect(screen.getAllByText('1').length).toBeGreaterThan(0);

    // Assert predicted failures (critical status count -> 1)
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
      /1 of 5 data sources failed/,
    );
    expect(screen.getByTestId('connection-banner-row-sensors')).toBeInTheDocument();
  });

  it('renders a red "Offline" banner when every source fails', async () => {
    mockBuildings = networkErr;
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

