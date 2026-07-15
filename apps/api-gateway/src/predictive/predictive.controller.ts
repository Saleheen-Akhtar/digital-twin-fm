import {
  Controller,
  Get,
  Param,
  Query,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SkipThrottle } from '@nestjs/throttler';
import { Public } from '../auth/jwt-auth.guard';
import { PredictiveService } from './predictive.service';

interface HealthScoreItem {
  assetId: string;
  assetName: string;
  assetType: string;
  floorLevel: number | null;
  score: number;
  trend: string;
  topRisks: string[];
  lastUpdated: string;
}

interface PredictiveAsset {
  id: string;
  name: string;
  type: string;
  floorLevel: number | null;
}

@Controller('predictive')
export class PredictiveController {
  private readonly logger = new Logger(PredictiveController.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly predictiveService: PredictiveService,
  ) {}

  /**
   * Public: minimal asset list for ai-service health scoring.
   *
   * `@SkipThrottle()` — this is an internal service-to-service read
   * that the ai-service fans out to for every asset (one GET per asset
   * per health-score request). Unauthenticated (no JWT on the
   * server-to-server call), so without the exemption it would hit the
   * global burst limit (20 req/s) and ~half the assets would 429 →
   * "Insufficient data". Mirrors the existing exemption on
   * `sensor-readings.controller.ts` for the same internal-call reason.
   */
  @Public()
  @SkipThrottle()
  @Get('assets')
  async getAssets(): Promise<PredictiveAsset[]> {
    return this.predictiveService.getAssets();
  }

  /**
   * Public: raw sensor readings for an asset.
   *
   * `@SkipThrottle()` — see getAssets(): the ai-service calls this
   * once per asset during health scoring; throttling it starves the
   * predictive tab of data.
   */
  @Public()
  @SkipThrottle()
  @Get('sensor-readings/:assetId')
  async getSensorReadings(
    @Param('assetId') assetId: string,
    @Query('hours') hours?: string,
  ) {
    const h = hours ? parseInt(hours, 10) : 2;
    return this.predictiveService.getAssetReadings(assetId, h);
  }

  /**
   * Proxy to ai-service: all assets health scores.
   */
  @Public()
  @Get('health-scores')
  async getHealthScores(): Promise<{ scores: HealthScoreItem[]; generatedAt: string }> {
    const aiUrl = this.configService.get<string>('AI_SERVICE_URL', 'http://localhost:8000');
    const url = `${aiUrl}/ai/predictive/health-scores`;

    this.logger.log(`Proxying to ai-service: GET ${url}`);

    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) {
      const text = await res.text();
      this.logger.error(`ai-service health-scores error: ${res.status} ${text}`);
      throw new ServiceUnavailableException(`Failed to fetch health scores: ${res.statusText}`);
    }
    return res.json();
  }

  @Public()
  @Get('health-scores/:assetId')
  async getAssetHealthScore(@Param('assetId') assetId: string) {
    const aiUrl = this.configService.get<string>('AI_SERVICE_URL', 'http://localhost:8000');
    const url = `${aiUrl}/ai/predictive/health-scores/${assetId}`;

    this.logger.log(`Proxying to ai-service: GET ${url}`);

    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) {
      const text = await res.text();
      this.logger.error(`ai-service asset health error: ${res.status} ${text}`);
      throw new ServiceUnavailableException(`Failed to fetch asset health: ${res.statusText}`);
    }
    return res.json();
  }
}
