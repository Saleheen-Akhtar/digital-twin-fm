import { Controller, Get, Header, Param, Query } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { SensorsService, ListReadingsFilter } from './sensors.service';
import { SensorReadingDto } from './dto/sensor.dto';

/**
 * Per the dashboard-polling follow-up: `/sensors/:id/readings` is the
 * highest-frequency endpoint in the system.
 *
 *   1. The dashboard's `DashboardLiveMonitoring` client component
 *      re-fetches /sensors every 30s in the background and then calls
 *      `/sensors/:id/readings` for each displayed sensor.
 *   2. The `AssetDetailPanel` opens on user click and re-fetches
 *      readings for the clicked asset.
 *
 * So this endpoint sees 10-30 calls per user per minute in normal use.
 * The new throttler design (`ThrottlerBehindAuthGuard` skips GETs for
 * authenticated users) already exempts this endpoint for the common
 * case, but we add an explicit `@SkipThrottle()` so the intent is
 * clear at the route level AND a future refactor that tightens the
 * global guard won't silently re-throttle it.
 *
 * The 10-second `Cache-Control: private, max-age=10` lets the browser
 * absorb the duplicate request that React 19 fires on every effect
 * re-run during asset selection. Refresh 10 times in 10 seconds → 1
 * real request. The `private` directive is required because the
 * response varies per user (it'll be the same for every user in the
 * MVP, but once we add per-user asset filters this matters).
 */
@SkipThrottle()
@Controller('sensors/:sensorId/readings')
export class SensorReadingsController {
  constructor(private readonly service: SensorsService) {}

  @Header('Cache-Control', 'private, max-age=10')
  @Get()
  findAll(
    @Param('sensorId') sensorId: string,
    @Query() q: Omit<ListReadingsFilter, 'sensorId'>,
  ): Promise<SensorReadingDto[]> {
    return this.service.findReadings({ sensorId, ...q });
  }
}
