import type { Alert } from '@digital-twin-fm/types';

/**
 * Response shape for `GET /api/alerts` and `GET /api/alerts/:id`.
 *
 * Per Finding 23 (Medium): was a locally-defined interface with
 * `severity: string` / `status: string`. Now aliases the shared
 * `Alert` from `@digital-twin-fm/types` so the `AlertSeverity` and
 * `AlertStatus` unions propagate.
 */
export type AlertDto = Alert;
