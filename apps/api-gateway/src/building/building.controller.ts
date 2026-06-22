import { Controller, Get, Query } from '@nestjs/common';
import { BuildingService } from './building.service';
import { Public } from '../auth/jwt-auth.guard';

@Controller('building')
export class BuildingController {
  constructor(private readonly service: BuildingService) {}

  /**
   * GET /building/snapshot?buildingId=xxx
   * Returns the latest health score snapshot with full breakdown.
   */
  @Public()
  @Get('snapshot')
  async getSnapshot(
    @Query('buildingId') buildingId?: string,
  ) {
    const id = buildingId ?? '9a83477a-4b19-444a-9345-0e07f90d16b0';
    const snapshot = await this.service.getLatestSnapshot(id);
    if (!snapshot) {
      return { found: false, message: 'No building data found' };
    }
    return { found: true, snapshot };
  }

  /**
   * GET /building/snapshot/history?buildingId=xxx&hours=24
   * Returns health score time series for sparkline / trend chart.
   */
  @Public()
  @Get('snapshot/history')
  async getSnapshotHistory(
    @Query('buildingId') buildingId?: string,
    @Query('hours') hours?: string,
  ) {
    const id = buildingId ?? '9a83477a-4b19-444a-9345-0e07f90d16b0';
    const h = hours ? parseInt(hours, 10) : 24;
    const history = await this.service.getSnapshotHistory(id, h);
    return { history };
  }
}
