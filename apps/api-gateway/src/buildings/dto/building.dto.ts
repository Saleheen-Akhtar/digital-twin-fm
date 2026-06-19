import type { Building } from '@digital-twin-fm/types';

/**
 * Response shape for `GET /buildings` and `GET /buildings/:id`.
 *
 * Per Finding 23 (Medium): the previous version of this file defined
 * its own `BuildingDto` interface (a near-duplicate of the shared
 * `Building` in `@digital-twin-fm/types`), and the api-client on the
 * web side defined yet a third shape. Three sources of truth = three
 * sources of drift.
 *
 * The fix: extend the shared `Building` interface. Any new field added
 * to `Building` in `packages/types` automatically appears here and on
 * the web side, with no per-controller bookkeeping.
 *
 * The `totalFloors` field comes from the database schema
 * (`packages/db/src/schema.ts`) and is not part of the MVP wire
 * contract. We declare it as a non-enumerable augmentation here.
 */
export interface BuildingDto extends Building {
  totalFloors: number;
}
