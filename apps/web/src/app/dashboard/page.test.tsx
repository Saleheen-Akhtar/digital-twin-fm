import { render, screen } from '@testing-library/react';
import DashboardPage from './page';

// Mock the api-client so the page renders without making real network calls.
jest.mock('@/lib/api-client', () => ({
  createApiClient: () => ({
    health: async () => ({ status: 'ok' }),
    findBuildings: async () => [
      { id: 'b1', name: 'Test Building', address: '123 Test St', totalFloors: 3, createdAt: 'x', updatedAt: 'x' },
    ],
    findAssets: async () => [
      { id: 'a1', name: 'AHU-001', type: 'ahu', status: 'ok', positionX: 0, positionY: 0, positionZ: 0, createdAt: 'x', updatedAt: 'x' } as any,
      { id: 'a2', name: 'AHU-002', type: 'ahu', status: 'critical', positionX: 0, positionY: 0, positionZ: 0, createdAt: 'x', updatedAt: 'x' } as any,
    ],
    findSensors: async () => [
      { id: 's1', assetId: 'a1', type: 'temperature', unit: 'C', status: 'ok', createdAt: 'x' } as any,
      { id: 's2', assetId: 'a1', type: 'humidity', unit: '%', status: 'ok', createdAt: 'x' } as any,
    ],
    findAlerts: async () => [
      { id: 'al1', severity: 'high', status: 'open', message: 'Sensor offline', createdAt: 'x' } as any,
    ],
  }),
}));

jest.mock('@/env', () => ({
  getServerEnv: () => ({ apiGatewayUrl: 'http://localhost:4000' }),
  getClientEnv: () => ({ apiBaseUrl: 'http://localhost:4000' }),
}));

// Per Finding 4: the dashboard requires a valid session. In tests we mock
// the session helper to return a real-shaped session (the cookie check is
// already covered by session.test.ts; the dashboard just needs to render).
jest.mock('@/lib/session', () => ({
  requireSession: async () => ({
    userId: '00000000-0000-0000-0000-000000000001',
    email: 'admin@dtfm.local',
    role: 'admin',
    accessToken: 'mock-access-token',
  }),
}));

describe('DashboardPage', () => {
  it('shows the building name', async () => {
    const element = await DashboardPage();
    render(element);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/Test Building/);
  });

  it('shows the api-gateway connected indicator', async () => {
    const element = await DashboardPage();
    render(element);
    expect(screen.getByTestId('api-status')).toHaveClass('bg-green-500');
  });

  it('shows real asset counts from the API', async () => {
    const element = await DashboardPage();
    render(element);
    // 2 mocked assets, 1 healthy + 1 critical
    expect(screen.getByTestId('kpi-total-assets')).toHaveTextContent('2');
    expect(screen.getByTestId('kpi-healthy')).toHaveTextContent('1');
    expect(screen.getByTestId('kpi-critical')).toHaveTextContent('1');
  });

  it('shows the recent alerts panel', async () => {
    const element = await DashboardPage();
    render(element);
    expect(screen.getByText('Sensor offline')).toBeInTheDocument();
  });

  it('links to the 3D twin viewer', async () => {
    const element = await DashboardPage();
    render(element);
    const link = screen.getByRole('link', { name: /digital twin/i });
    expect(link).toHaveAttribute('href', '/twin');
  });
});
