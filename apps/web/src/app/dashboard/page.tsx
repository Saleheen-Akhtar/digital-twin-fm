import { getServerEnv } from '@/env';
import { createApiClient } from '@/lib/api-client';
import { requireSession } from '@/lib/session';
import Link from 'next/link';

export const metadata = { title: 'Dashboard — Digital Twin FM' };
export const dynamic = 'force-dynamic';

const STATUS_DOT: Record<string, string> = {
  ok: 'bg-green-500',
  warning: 'bg-amber-500',
  critical: 'bg-red-500',
  offline: 'bg-neutral-500',
  info: 'bg-blue-500',
};

const STATUS_RING: Record<string, string> = {
  ok: 'ring-green-500/30',
  warning: 'ring-amber-500/30',
  critical: 'ring-red-500/30',
  offline: 'ring-neutral-500/30',
  info: 'ring-blue-500/30',
};

const SEVERITY_COLOR: Record<string, string> = {
  low: 'text-neutral-300',
  medium: 'text-amber-300',
  high: 'text-orange-300',
  critical: 'text-red-300',
};

export default async function DashboardPage() {
  // Per Finding 4: every protected page must verify the session before
  // rendering. requireSession() reads + verifies the dtfm_token cookie via
  // jose (same secret/aud/iss as the api-gateway). If invalid, it
  // redirects to /login. This is a defense-in-depth check; the middleware
  // does the same thing at the edge before the page even renders.
  const session = await requireSession();

  const { apiGatewayUrl } = getServerEnv();
  // Pass the access token from the verified session cookie. The api-gateway's
  // JwtAuthGuard re-verifies the signature/audience/issuer independently.
  const api = createApiClient({ baseUrl: apiGatewayUrl, token: session.accessToken });

  // Fetch all the data we need in parallel
  let apiStatus: 'connected' | 'disconnected' = 'disconnected';
  let apiError: string | null = null;
  const [buildings, assets, sensors, recentAlerts] = await Promise.all([
    api.findBuildings().catch((e) => {
      apiError = e.message;
      apiStatus = 'disconnected';
      return [];
    }),
    api.findAssets().catch(() => []),
    api.findSensors().catch(() => []),
    api.findAlerts({ limit: 5 }).catch(() => []),
  ]);

  if (!apiError) apiStatus = 'connected';

  // Compute asset counts by status
  const assetStatusCounts = assets.reduce<Record<string, number>>((acc, a) => {
    acc[a.status] = (acc[a.status] ?? 0) + 1;
    return acc;
  }, {});

  const totalAssets = assets.length;
  const criticalCount = assetStatusCounts.critical ?? 0;
  const warningCount = assetStatusCounts.warning ?? 0;
  const okCount = assetStatusCounts.ok ?? 0;
  const offlineCount = assetStatusCounts.offline ?? 0;
  const building = buildings[0];
  const openAlerts = recentAlerts.filter((a) => a.status === 'open' || a.status === 'in_progress' || a.status === 'acknowledged');

  return (
    <main className="min-h-screen p-8 max-w-7xl mx-auto">
      <header className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">{building?.name ?? 'Digital Twin FM'}</h1>
          {building?.address && (
            <p className="text-sm text-neutral-500 mt-1">{building.address}</p>
          )}
        </div>
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

      {/* KPI cards */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <KpiCard label="Total Assets" value={totalAssets} sub={`${building?.totalFloors ?? 0} floors`} />
        <KpiCard label="Healthy" value={okCount} sub="status: ok" tone="ok" />
        <KpiCard label="Warning" value={warningCount} sub="needs attention" tone="warning" />
        <KpiCard label="Critical" value={criticalCount} sub="immediate action" tone="critical" />
      </section>

      {/* Domain panels */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <PanelLink
          href="/twin"
          title="Digital Twin"
          subtitle={`${totalAssets} assets in 3D viewer`}
          status={criticalCount > 0 ? 'critical' : warningCount > 0 ? 'warning' : 'ok'}
          footer="Open 3D viewer →"
        />
        <Panel
          title="Sensors"
          subtitle={`${sensors.length} sensors across all assets`}
        >
          <ul className="text-sm space-y-1">
            {Object.entries(
              sensors.reduce<Record<string, number>>((acc, s) => {
                acc[s.type] = (acc[s.type] ?? 0) + 1;
                return acc;
              }, {}),
            )
              .sort(([, a], [, b]) => b - a)
              .slice(0, 5)
              .map(([type, count]) => (
                <li key={type} className="flex justify-between">
                  <span className="text-neutral-400">{type}</span>
                  <span className="font-mono">{count}</span>
                </li>
              ))}
          </ul>
        </Panel>
        <Panel
          title={`Recent Alerts (${openAlerts.length} active)`}
          subtitle="Last 5 across all assets"
        >
          {recentAlerts.length === 0 ? (
            <p className="text-sm text-neutral-500">No alerts in the system. 🎉</p>
          ) : (
            <ul className="text-sm space-y-2">
              {recentAlerts.map((a) => (
                <li key={a.id} className="flex items-start gap-2">
                  <span
                    className={`inline-block w-2 h-2 rounded-full mt-1.5 ${STATUS_DOT[a.status] ?? 'bg-neutral-500'}`}
                  />
                  <div className="flex-1 min-w-0">
                    <div className={`text-xs uppercase tracking-wider ${SEVERITY_COLOR[a.severity] ?? 'text-neutral-400'}`}>
                      {a.severity} · {a.status}
                    </div>
                    <div className="text-neutral-200 truncate">{a.message}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </section>

      {/* Asset status legend */}
      <section className="mt-8 border border-neutral-800 rounded-lg p-6">
        <h2 className="font-semibold mb-4">Asset Status Distribution</h2>
        <div className="flex flex-wrap gap-4">
          {(['ok', 'warning', 'critical', 'offline', 'info'] as const).map((s) => {
            const count = assetStatusCounts[s] ?? 0;
            return (
              <div key={s} className={`flex items-center gap-2 px-3 py-1.5 rounded ring-1 ${STATUS_RING[s]}`}>
                <span className={`w-2 h-2 rounded-full ${STATUS_DOT[s]}`} />
                <span className="text-sm capitalize">{s}</span>
                <span className="text-sm text-neutral-400 font-mono">{count}</span>
              </div>
            );
          })}
        </div>
      </section>
    </main>
  );
}

function KpiCard({ label, value, sub, tone }: { label: string; value: number; sub: string; tone?: 'ok' | 'warning' | 'critical' }) {
  const toneClass = tone === 'critical' ? 'text-red-400' : tone === 'warning' ? 'text-amber-400' : tone === 'ok' ? 'text-green-400' : 'text-neutral-100';
  return (
    <div className="border border-neutral-800 rounded-lg p-4">
      <div className="text-xs uppercase tracking-wider text-neutral-500">{label}</div>
      <div className={`text-3xl font-bold mt-1 ${toneClass}`} data-testid={`kpi-${label.toLowerCase().replace(/\s+/g, '-')}`}>{value}</div>
      <div className="text-xs text-neutral-500 mt-1">{sub}</div>
    </div>
  );
}

function Panel({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="border border-neutral-800 rounded-lg p-6">
      <h2 className="font-semibold">{title}</h2>
      {subtitle && <p className="text-xs text-neutral-500 mt-1">{subtitle}</p>}
      <div className="mt-4">{children}</div>
    </div>
  );
}

function PanelLink({ href, title, subtitle, status, footer }: { href: string; title: string; subtitle: string; status: 'ok' | 'warning' | 'critical'; footer: string }) {
  return (
    <Link
      href={href}
      className={`block border border-neutral-800 rounded-lg p-6 hover:border-neutral-600 transition-colors`}
    >
      <div className="flex items-center gap-2">
        <span className={`w-2 h-2 rounded-full ${STATUS_DOT[status]}`} />
        <h2 className="font-semibold">{title}</h2>
      </div>
      <p className="text-sm text-neutral-400 mt-1">{subtitle}</p>
      <p className="text-sm text-blue-400 mt-4">{footer}</p>
    </Link>
  );
}
