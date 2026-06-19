import type { Asset } from '@digital-twin-fm/types';

/**
 * Response shape for `GET /api/assets` and `GET /api/assets/:id`.
 *
 * Per Finding 23 (Medium): the previous version of this file defined its
 * own `AssetDto` interface with string-typed `type` and `status` (no
 * enum safety), and the web-side api-client defined yet another shape.
 * The fix is to extend the single source of truth in
 * `@digital-twin-fm/types`. The `AssetType` / `AssetStatus` unions
 * from there are now picked up automatically.
 */
export type AssetDto = Asset;
