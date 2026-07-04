/**
 * Digital Twin FM — Demo / Scenario Controller
 *
 * Provides endpoints for the presenter to reset demo state, trigger
 * sensor anomalies, and switch simulator scenarios — all through the
 * Redis pub/sub channels that the ingestion pipeline and simulator
 * already listen on.
 *
 * All endpoints are admin-only (@Roles('admin')) and require a valid
 * JWT (the global JwtAuthGuard applies automatically).
 */
import {
  Controller,
  Post,
  Body,
  Logger,
  InternalServerErrorException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { createRedisOptions } from '../redis-config';
import { Roles } from '../auth/roles.guard';

const VALID_SCENARIOS = [
  'normal',
  'chiller_failure',
  'power_surge_floor_3',
  'severe_temp_breach',
] as const;

type Scenario = (typeof VALID_SCENARIOS)[number];

@Controller('demo')
@Roles('admin')
export class DemoController {
  private readonly logger = new Logger(DemoController.name);
  private readonly redis: Redis;

  constructor(config: ConfigService) {
    this.redis = new Redis(
      createRedisOptions({
        maxRetriesPerRequest: 3,
        lazyConnect: true,
      }),
    );
    this.redis.on('error', (err) => {
      this.logger.warn(`Demo Redis connection error (non-fatal): ${(err as Error).message}`);
    });
  }

  /**
   * POST /demo/scenario
   *
   * Switches the sensor simulator's active scenario via the
   * `simulator.control` Redis channel. The simulator subscribes to this
   * channel and changes its behaviour accordingly.
   *
   * Body: { "scenario": "chiller_failure" }
   * Scenarios: normal, chiller_failure, power_surge_floor_3, severe_temp_breach
   */
  @Post('scenario')
  async setScenario(
    @Body() body: { scenario: string },
  ): Promise<{ success: true; scenario: Scenario }> {
    const scenario = body?.scenario?.toLowerCase().replace(/\s/g, '_');
    if (!VALID_SCENARIOS.includes(scenario as Scenario)) {
      throw new BadRequestException(
        `Invalid scenario. Valid: ${VALID_SCENARIOS.join(', ')}`,
      );
    }

    try {
      await this.redis.connect();
      await this.redis.publish(
        'simulator.control',
        JSON.stringify({ scenario }),
      );
      await this.redis.disconnect();
      this.logger.log(`Demo scenario switched to: ${scenario}`);
      return { success: true, scenario: scenario as Scenario };
    } catch (err) {
      this.logger.error('Failed to publish scenario to Redis', err);
      throw new InternalServerErrorException('Failed to switch scenario');
    }
  }

  /**
   * POST /demo/inject-reading
   *
   * Publishes a fake sensor reading directly to the `sensor.reading`
   * Redis channel, bypassing MQTT / real hardware. The reading flows
   * through the same pipeline: ingestion worker persists it →
   * WebSocket broadcasts it → dashboard updates.
   *
   * Use this to demonstrate threshold alerts or anomaly detection
   * when real sensor data is unavailable.
   *
   * Body: { "sensorId": "...", "assetId": "...", "value": 42, "unit": "C",
   *         "quality": "good" }
   */
  @Post('inject-reading')
  async injectReading(
    @Body()
    body: {
      sensorId: string;
      assetId?: string;
      value: number;
      unit?: string;
      quality?: 'good' | 'uncertain' | 'bad';
    },
  ): Promise<{ success: true; sensorId: string; value: number }> {
    if (!body.sensorId || body.value == null) {
      throw new BadRequestException('sensorId and value are required');
    }

    const reading = {
      sensorId: body.sensorId,
      assetId: body.assetId || body.sensorId,
      timestamp: new Date().toISOString(),
      value: body.value,
      unit: body.unit || '',
      quality: body.quality || 'good',
    };

    try {
      await this.redis.connect();
      await this.redis.publish('sensor.reading', JSON.stringify(reading));
      await this.redis.disconnect();
      this.logger.log(
        `Demo injected reading: sensor=${reading.sensorId} value=${reading.value}${reading.unit}`,
      );
      return { success: true, sensorId: body.sensorId, value: body.value };
    } catch (err) {
      this.logger.error('Failed to publish reading to Redis', err);
      throw new InternalServerErrorException('Failed to inject reading');
    }
  }
}
