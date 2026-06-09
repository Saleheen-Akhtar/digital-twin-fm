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
    name: 'Singapore Expo - Hall 1',
    address: 'Expo Drive',
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

// Mutable state — each test can overwrite these before calling
// DashboardPage() to inject failures.
let mockBuildings: typeof baseBuildings | Promise<typeof baseBuildings> = baseBuildings;
let mockAssets: typeof baseAssets | Promise<typeof baseAssets> = baseAssets;
let mockSensors: typeof baseSensors | Promise<typeof baseSensors> = baseSensors;
let mockAlerts: typeof baseAlerts | Promise<typeof baseAlerts> = baseAlerts;

jest.mock('@/lib/api-client', () => {
  // Re-export the real `ApiError` class so tests can construct
  // realistic rejected promises. We override only `createApiClient`.
  const actual = jest.requireActual('@/lib/api-client') as typeof import('@/lib/api-client');
  return {
    ...actual,
    createApiClient: () => ({
      findBuildings: () => mockBuildings,
      findAssets: () => mockAssets,
      findSensors: () => mockSensors,
      findAlerts: () => mockAlerts,
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

jest.mock('./dashboard-live-monitoring', () => ({
  DashboardLiveMonitoring: ({
    initialCharts,
    sensorsError,
  }: {
    initialCharts: Array<{ title: string; value: string }>;
    sensorsError?: { message: string } | null;
  }) => (
    <section>
      <h2>Live Monitoring</h2>
      {sensorsError ? (
        <div data-testid="panel-error-sensors-monitoring">{sensorsError.message}</div>
      ) : null}
      {initialCharts.map((chart) => (
        <div key={chart.title}>
          <span>{chart.title}</span>
          <span>{chart.value}</span>
        </div>
      ))}
    </section>
  ),
}));

describe('DashboardPage', () => {
  beforeEach(() => {
    // Reset to the happy path between tests.
    mockBuildings = baseBuildings;
    mockAssets = baseAssets;
    mockSensors = baseSensors;
    mockAlerts = baseAlerts;
  });

  it('renders the facility dashboard shell', async () => {
    const element = await DashboardPage();
    render(element);

    expect(screen.getByText(/Good morning, Akshay/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Digital Twin' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Live Monitoring' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Active Alerts' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Work Orders' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'AI Copilot' })).toBeInTheDocument();
  });

  it('shows live values from the API', async () => {
    const element = await DashboardPage();
    render(element);

    expect(screen.getByText('65%')).toBeInTheDocument();
    expect(screen.getByText((_, element) => element?.textContent === '2 / 4')).toBeInTheDocument();
    expect(screen.getAllByText('78 kWh').length).toBeGreaterThan(0);
    expect(screen.getByText('28.7°C')).toBeInTheDocument();
    expect(screen.getByText('54%')).toBeInTheDocument();
    expect(screen.getAllByText((_, element) => element?.textContent === '36').length).toBeGreaterThan(0);
    expect(screen.getAllByText('AHU-301 Failure').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Equipment not responding').length).toBeGreaterThan(0);
  });

  it('hides the connection banner and shows a green "Live" pill when every source succeeds (Finding 14)', async () => {
    const element = await DashboardPage();
    render(element);

    expect(screen.queryByTestId('connection-banner')).not.toBeInTheDocument();
    const pill = screen.getByTestId('connection-pill');
    expect(pill.textContent).toMatch(/Live/);
    // The pill should be the default slate color in the connected state.
    expect(pill.className).toMatch(/text-slate-500/);
  });

  it('renders a yellow "Partial" banner and per-panel error when only sensors fail (Finding 14)', async () => {
    mockSensors = networkErr();
    const element = await DashboardPage();
    render(element);

    const banner = screen.getByTestId('connection-banner');
    expect(banner).toBeInTheDocument();
    expect(banner.getAttribute('data-state')).toBe('partial');
    expect(screen.getByTestId('connection-banner-headline').textContent).toMatch(
      /1 of 4 live data sources failed/,
    );
    expect(screen.getByTestId('connection-banner-row-sensors')).toBeInTheDocument();

    // Per-panel error appears on the live monitoring panel
    expect(screen.getByTestId('panel-error-sensors-monitoring')).toBeInTheDocument();

    // Sidebar pill turns amber
    const pill = screen.getByTestId('connection-pill');
    expect(pill.textContent).toMatch(/Partial/);
    expect(pill.className).toMatch(/text-amber-700/);

    // The other panels (alerts, work orders, twin) still render with data.
    expect(screen.getByRole('heading', { name: 'Active Alerts' })).toBeInTheDocument();
  });

  it('renders a red "Offline" banner when every source fails (Finding 14)', async () => {
    mockBuildings = networkErr();
    mockAssets = networkErr();
    mockSensors = networkErr();
    mockAlerts = networkErr();
    const element = await DashboardPage();
    render(element);

    const banner = screen.getByTestId('connection-banner');
    expect(banner.getAttribute('data-state')).toBe('disconnected');
    expect(screen.getByTestId('connection-banner-headline').textContent).toMatch(
      /Live data unavailable/,
    );

    // Sidebar pill turns red
    const pill = screen.getByTestId('connection-pill');
    expect(pill.textContent).toMatch(/Offline/);
    expect(pill.className).toMatch(/text-red-700/);

    // The twin panel shows the empty-state placeholder, not the live viewer.
    expect(
      screen.getByText(/3D viewer is unavailable while the api-gateway is unreachable/i),
    ).toBeInTheDocument();

    // The alerts panel shows its own explicit error. (It also appears
    // in the work-orders panel because work orders are derived from
    // alerts — that's intentional and asserted separately below.)
    expect(screen.getAllByTestId('panel-error-alerts').length).toBeGreaterThan(0);
    expect(
      screen.getByText(/No alerts can be shown while the api-gateway is unreachable/i),
    ).toBeInTheDocument();

    // The work-orders panel disables itself (work orders are derived from alerts).
    expect(screen.getByText(/Work orders are derived from alerts/i)).toBeInTheDocument();
  });
});

