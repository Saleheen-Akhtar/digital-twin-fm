/**
 * Digital Twin FM — Realtime Redis Bridge
 *
 * Subscribes to the ingestion pipeline's `sensor.reading` Redis channel
 * and forwards every reading to the WebSocket gateway as a
 * `sensor:reading` event, so connected clients get live sensor data
 * without polling.
 *
 * The ingestion worker publishes readings to this channel after writing
 * them to TimescaleDB. This service acts as the bridge between the
 * backend pipeline and the frontend WebSocket.
 */
import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import Redis from 'ioredis';
import { RealtimeGateway } from './realtime.gateway';
import { createRedisOptions } from '../redis-config';

export interface SensorReadingPayload {
  sensorId: string;
  assetId: string;
  timestamp: string;
  value: number;
  unit: string;
  quality: 'good' | 'uncertain' | 'bad';
}

@Injectable()
export class RealtimeRedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RealtimeRedisService.name);
  private readonly redis: Redis;
  private readonly channel = 'sensor.reading';

  constructor(
    private readonly gateway: RealtimeGateway,
  ) {
    this.redis = new Redis(createRedisOptions({
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    }));

    // Suppress unhandled error events (Redis not running is non-fatal)
    this.redis.on('error', (err) => {
      this.logger.warn(`Redis connection error (non-fatal): ${(err as Error).message}`);
    });
  }

  async onModuleInit() {
    try {
      await this.redis.connect();
      await this.redis.subscribe(this.channel);
      this.logger.log(`Subscribed to Redis channel "${this.channel}"`);

      this.redis.on('message', (channel, message) => {
        if (channel !== this.channel) return;
        try {
          const reading: SensorReadingPayload = JSON.parse(message);
          this.gateway.broadcastSensorReading({
            sensorId: reading.sensorId,
            assetId: reading.assetId,
            value: reading.value,
            unit: reading.unit,
            timestamp: reading.timestamp,
          });
        } catch (err) {
          this.logger.error('Failed to parse sensor reading from Redis', err);
        }
      });
    } catch (err) {
      this.logger.error('Failed to subscribe to Redis for sensor readings', err);
    }
  }

  async onModuleDestroy() {
    try {
      await this.redis.unsubscribe(this.channel);
      await this.redis.quit();
    } catch {
      // ignore errors during shutdown
    }
  }
}
