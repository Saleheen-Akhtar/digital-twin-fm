import type { Sensor, SensorReading } from '@digital-twin-fm/types';

/**
 * Response shapes for the sensors endpoints.
 *
 * Per Finding 23 (Medium): these used to be locally-defined interfaces
 * with `type: string` and `status: string` (no enum safety). The fix
 * is to alias the shared types from `@digital-twin-fm/types` so the
 * `SensorType` / `AssetStatus` / `ReadingQuality` unions propagate.
 */
export type SensorDto = Sensor;
export type SensorReadingDto = SensorReading;
