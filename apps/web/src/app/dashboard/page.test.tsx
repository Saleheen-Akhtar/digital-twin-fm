import { render, screen } from '@testing-library/react';
import DashboardPage from './page';

// The Dashboard page is an async Server Component that calls api-gateway /health.
// In a real Next.js environment the page would be rendered on the server and
// the React tree would arrive pre-resolved. For Jest (which renders on the
// client side) we mock the api-client so the call resolves immediately.
jest.mock('@/lib/api-client', () => ({
  createApiClient: () => ({
    health: async () => ({ status: 'ok' }),
    login: async () => 'token',
  }),
}));

jest.mock('@/env', () => ({
  getServerEnv: () => ({ apiGatewayUrl: 'http://localhost:4000' }),
  getClientEnv: () => ({ apiBaseUrl: 'http://localhost:4000' }),
}));

describe('DashboardPage', () => {
  it('shows the dashboard title', async () => {
    const element = await DashboardPage();
    render(element);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/dashboard/i);
  });

  it('shows the connected status when api-gateway is healthy', async () => {
    const element = await DashboardPage();
    render(element);
    expect(screen.getByTestId('api-status')).toHaveClass('bg-green-500');
  });
});
