import { getServerEnv } from '@/env';
import { createApiClient, type Asset, type Building } from '@/lib/api-client';
import { requireSession } from '@/lib/session';
import { DigitalTwinClient } from './client';

export const metadata = { title: 'Digital Twin — Digital Twin FM' };
export const dynamic = 'force-dynamic';

export default async function TwinPage({
  searchParams,
}: {
  searchParams: Promise<{ buildingId?: string }>;
}) {
  const session = await requireSession();
  const { apiGatewayUrl } = getServerEnv();
  const api = createApiClient({ baseUrl: apiGatewayUrl, token: session.accessToken });
  const params = await searchParams;

  let modelUrl: string | undefined;

  // If a buildingId is provided, fetch the building to get its modelUrl
  if (params.buildingId) {
    try {
      const building: Building = await api.findBuilding(params.buildingId);
      const relUrl = building.modelUrl ?? undefined;
      // modelUrl is a relative path (e.g. /uploads/models/xxx.glb)
      // served by the api‑gateway — prepend the gateway base URL
      // so Three.js can fetch it from the correct origin
      if (relUrl) {
        modelUrl = `${apiGatewayUrl.replace(/\/+$/, '')}${relUrl}`;
      }
    } catch {
      // building not found or other error — fall through to procedural model
    }
  }

  let assets: Asset[] = [];
  let loadError: string | null = null;
  try {
    assets = await api.findAssets();
  } catch (err) {
    loadError = err instanceof Error ? err.message : 'Failed to load assets';
  }

  return <DigitalTwinClient initialAssets={assets} initialError={loadError} modelUrl={modelUrl} />;
}
