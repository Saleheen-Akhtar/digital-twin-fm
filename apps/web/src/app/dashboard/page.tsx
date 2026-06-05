import { getServerEnv } from '@/env';
import { createApiClient } from '@/lib/api-client';

export const metadata = { title: 'Dashboard — Digital Twin FM' };
export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const { apiGatewayUrl } = getServerEnv();
  const api = createApiClient({ baseUrl: apiGatewayUrl });

  let apiStatus: 'connected' | 'disconnected' = 'disconnected';
  let apiError: string | null = null;
  try {
    const health = await api.health();
    apiStatus = health.status === 'ok' ? 'connected' : 'disconnected';
  } catch (err) {
    apiError = err instanceof Error ? err.message : 'Unknown error';
  }

  return (
    <main className="min-h-screen p-8 max-w-6xl mx-auto">
      <header className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <div className="flex items-center gap-2 text-sm">
          <span
            data-testid="api-status"
            className={`inline-block w-2 h-2 rounded-full ${
              apiStatus === 'connected' ? 'bg-green-500' : 'bg-red-500'
            }`}
          />
          <span>api-gateway: {apiStatus}</span>
          {apiError && <span className="text-red-400 text-xs ml-2">({apiError})</span>}
        </div>
      </header>

      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="border border-neutral-800 rounded-lg p-6">
          <h2 className="font-semibold mb-2">Digital Twin</h2>
          <p className="text-neutral-400 text-sm">3D viewer coming soon.</p>
        </div>
        <div className="border border-neutral-800 rounded-lg p-6">
          <h2 className="font-semibold mb-2">Live Sensors</h2>
          <p className="text-neutral-400 text-sm">Realtime feed coming soon.</p>
        </div>
        <div className="border border-neutral-800 rounded-lg p-6">
          <h2 className="font-semibold mb-2">AI Copilot</h2>
          <p className="text-neutral-400 text-sm">Chat panel coming soon.</p>
        </div>
      </section>
    </main>
  );
}
