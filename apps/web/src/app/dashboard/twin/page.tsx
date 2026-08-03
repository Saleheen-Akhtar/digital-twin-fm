import { getServerEnv } from '@/env';
import { createApiClient, type Asset } from '@/lib/api-client';
import { requireSession } from '@/lib/session';
import { DigitalTwinClient } from './client';

export const metadata = { title: 'Digital Twin — Digital Twin FM' };
export const dynamic = 'force-dynamic';

export default async function TwinPage() {
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
