import { Test } from '@nestjs/testing';
import { BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DemoController } from './demo.controller';

// Self-contained ioredis mock — no external variable references in the factory.
jest.mock('ioredis', () => {
  const { EventEmitter } = require('events');
  const ee = new EventEmitter();
  ee.publish = jest.fn().mockResolvedValue(1);
  return {
    __esModule: true,
    default: jest.fn(() => ee),
  };
});

// Import after jest.mock so the hoisted mock takes effect
import Redis from 'ioredis';

describe('DemoController', () => {
  let controller: DemoController;

  beforeEach(async () => {
    // Reset the shared mock's publish
    (new Redis() as any).publish.mockClear();

    const moduleRef = await Test.createTestingModule({
      controllers: [DemoController],
      providers: [
        { provide: ConfigService, useValue: { get: jest.fn() } },
      ],
    }).compile();

    controller = moduleRef.get(DemoController);
  });

  /** Convenience: get the mocked publish function on the Redis singleton. */
  function publish() {
    return new Redis().publish as jest.Mock;
  }

  // ── setScenario ─────────────────────────────────────────────────

  describe('POST /demo/scenario', () => {
    it('publishes a valid scenario to Redis', async () => {
      const result = await controller.setScenario({ scenario: 'chiller_failure' });

      expect(result).toEqual({ success: true, scenario: 'chiller_failure' });
      expect(publish()).toHaveBeenCalledTimes(1);
      expect(publish()).toHaveBeenCalledWith(
        'simulator.control',
        JSON.stringify({ scenario: 'chiller_failure' }),
      );
    });

    it('normalises whitespace and case in scenario names', async () => {
      await controller.setScenario({ scenario: 'Severe Temp Breach' });

      expect(publish()).toHaveBeenCalledWith(
        'simulator.control',
        JSON.stringify({ scenario: 'severe_temp_breach' }),
      );
    });

    it('rejects an invalid scenario with BadRequestException', async () => {
      await expect(
        controller.setScenario({ scenario: 'nuclear_meltdown' }),
      ).rejects.toThrow(BadRequestException);

      expect(publish()).not.toHaveBeenCalled();
    });

    it('rejects an empty scenario', async () => {
      await expect(
        controller.setScenario({ scenario: '' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects undefined body gracefully', async () => {
      await expect(
        controller.setScenario({} as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws InternalServerErrorException on Redis failure', async () => {
      publish().mockRejectedValueOnce(new Error('redis connection refused'));

      await expect(
        controller.setScenario({ scenario: 'normal' }),
      ).rejects.toThrow(InternalServerErrorException);
    });
  });

  // ── inject-reading ──────────────────────────────────────────────

  describe('POST /demo/inject-reading', () => {
    const validReading = {
      sensorId: '00000000-0000-0000-0000-000000000001',
      value: 48.5,
      unit: 'C',
    };

    it('publishes a valid reading to Redis', async () => {
      const result = await controller.injectReading(validReading);

      expect(result).toEqual({ success: true, sensorId: validReading.sensorId, value: 48.5 });
      expect(publish()).toHaveBeenCalledTimes(1);

      const channel = publish().mock.calls[0][0];
      const payload = JSON.parse(publish().mock.calls[0][1]);
      expect(channel).toBe('sensor.reading');
      expect(payload.sensorId).toBe(validReading.sensorId);
      expect(payload.value).toBe(48.5);
      expect(payload.unit).toBe('C');
      expect(payload.quality).toBe('good'); // default
      expect(payload.timestamp).toBeDefined();
    });

    it('uses assetId from body when provided', async () => {
      await controller.injectReading({ ...validReading, assetId: 'asset-999' });

      const payload = JSON.parse(publish().mock.calls[0][1]);
      expect(payload.assetId).toBe('asset-999');
    });

    it('defaults assetId to sensorId when not provided', async () => {
      await controller.injectReading(validReading);

      const payload = JSON.parse(publish().mock.calls[0][1]);
      expect(payload.assetId).toBe(validReading.sensorId);
    });

    it('defaults quality to "good"', async () => {
      await controller.injectReading(validReading);

      const payload = JSON.parse(publish().mock.calls[0][1]);
      expect(payload.quality).toBe('good');
    });

    it('accepts explicit quality values', async () => {
      await controller.injectReading({ ...validReading, quality: 'bad' });

      const payload = JSON.parse(publish().mock.calls[0][1]);
      expect(payload.quality).toBe('bad');
    });

    it('rejects missing sensorId with BadRequestException', async () => {
      await expect(
        controller.injectReading({ sensorId: '', value: 42 } as any),
      ).rejects.toThrow(BadRequestException);

      expect(publish()).not.toHaveBeenCalled();
    });

    it('rejects null value with BadRequestException', async () => {
      await expect(
        controller.injectReading({ sensorId: 's-1', value: null } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws InternalServerErrorException on Redis failure', async () => {
      publish().mockRejectedValueOnce(new Error('redis connection refused'));

      await expect(
        controller.injectReading(validReading),
      ).rejects.toThrow(InternalServerErrorException);
    });
  });
});
