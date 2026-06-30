/**
 * Digital Twin FM — MQTT Listener
 *
 * Subscribes to MQTT topics from real IoT devices (ESP32 demo hardware)
 * and publishes valid sensor readings to Redis pub/sub for the rest of
 * the pipeline.
 *
 * Reads sensor/+/reading topics and forwards matching SensorReading
 * payloads to the ingestion pipeline's Redis channel `sensor.reading`.
 */
import { Redis } from "ioredis";
import mqtt from "mqtt";
import { z } from "zod";

const SensorReading = z.object({
  sensorId: z.string().min(1),
  assetId: z.string().min(1),
  timestamp: z.string().datetime().optional(),
  value: z.number(),
  unit: z.string().optional(),
  quality: z.enum(["good", "uncertain", "bad"]).optional(),
});

export type MqttListenerOptions = {
  url: string;
  redis: Redis;
  topic?: string;
  log: {
    info: (msg: object, label?: string) => void;
    warn: (msg: object, label?: string) => void;
    error: (msg: object, label?: string) => void;
  };
};

export function startMqttListener(options: MqttListenerOptions): mqtt.MqttClient {
  const { url, redis, topic = "sensors/+/reading", log } = options;

  const client: mqtt.MqttClient = mqtt.connect(url);

  client.on("connect", () => {
    log.info({ url, topic }, "mqtt connected");
    client.subscribe(topic, (err) => {
      if (err) {
        log.error({ err }, "mqtt subscribe failed");
      }
    });
  });

  client.on("message", async (incomingTopic, payload) => {
    try {
      const json = JSON.parse(payload.toString());
      const parsed = SensorReading.parse(json);

      const channel = "sensor.reading";
      await redis.publish(channel, JSON.stringify(parsed));
    } catch (err) {
      log.warn({ err, topic: incomingTopic }, "invalid mqtt message");
    }
  });

  client.on("error", (err) => {
    log.error({ err, url }, "mqtt error");
  });

  client.on("close", () => {
    log.info({ url }, "mqtt disconnected");
  });

  return client;
}
