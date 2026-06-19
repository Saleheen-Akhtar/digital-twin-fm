// Server component: requires a valid session, fetches assets with the
// access token, then hands off to a small client wrapper for the
// interactive bits (selection state, click → detail panel).
import { getServerEnv } from '@/env';
import { createApiClient, type Asset } from '@/lib/api-client';
import { requireSession } from '@/lib/session';
import { DigitalTwinClient } from './client';

export const metadata = { title: 'Digital Twin — Digital Twin FM' };
export const dynamic = 'force-dynamic';

export default async function DigitalTwinPage() {
  // Per Finding 4: verify session before any data fetch. If invalid, the
  // user is redirected to /login (defense-in-depth; the middleware does
  // the same at the edge).
  const session = await requireSession();

  const { apiGatewayUrl } = getServerEnv();
  const api = createApiClient({ baseUrl: apiGatewayUrl, token: session.accessToken });

  let assets: Asset[] = [];
  let loadError: string | null = null;
  try {
    assets = await api.findAssets();
  } catch (err) {
    loadError = err instanceof Error ? err.message : 'Failed to load assets';
  }

  return <DigitalTwinClient initialAssets={assets} initialError={loadError} />;
}
