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
 *
 * Redis connection is established once on module init and held for the
 * lifetime of the service (eliminating per-request connect/disconnect
 * churn reported in review).
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
  private connected = false;

  constructor(_config: ConfigService) {
    this.redis = new Redis(
      createRedisOptions({
        maxRetriesPerRequest: 3,
        lazyConnect: false, // connect on instantiation, hold for lifetime
      }),
    );
    this.redis.on('error', (err) => {
      this.logger.warn(`Demo Redis error (non-fatal): ${(err as Error).message}`);
      this.connected = false;
    });
    this.redis.on('connect', () => {
      this.connected = true;
    });
    this.redis.on('close', () => {
      this.connected = false;
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
      await this.redis.publish(
        'simulator.control',
        JSON.stringify({ scenario }),
      );
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
   *
   * Rate limiting: the global ThrottlerBehindAuthGuard (20 req/s burst,
   * 300 req/min sustained) applies — prevents accidental button mashing.
   */
  /**
   * POST /demo/inject-alert
   *
   * Publishes a fake alert directly to the `alert.created` Redis channel.
   * This allows presenters to simulate a new alert popping up on the
   * frontend instantly via WebSocket, without waiting for the ingestion
   * pipeline's threshold evaluations.
   */
  @Post('inject-alert')
  async injectAlert(
    @Body()
    body: {
      assetId: string;
      message: string;
      severity: 'low' | 'medium' | 'high' | 'critical';
    },
  ): Promise<{ success: true; alertId: string }> {
    if (!body.assetId || !body.message) {
      throw new BadRequestException('assetId and message are required');
    }

    const alert = {
      id: `alert-demo-${Date.now()}`,
      assetId: body.assetId,
      severity: body.severity || 'critical',
      status: 'open',
      message: body.message,
      createdAt: new Date().toISOString(),
    };

    try {
      await this.redis.publish('alert.created', JSON.stringify(alert));
      this.logger.log(`Demo injected alert for asset=${alert.assetId}`);
      return { success: true, alertId: alert.id };
    } catch (err) {
      this.logger.error('Failed to publish alert to Redis', err);
      throw new InternalServerErrorException('Failed to inject alert');
    }
  }

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
      await this.redis.publish('sensor.reading', JSON.stringify(reading));
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
