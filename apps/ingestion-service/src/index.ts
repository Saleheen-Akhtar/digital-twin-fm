/**
 * Digital Twin FM — Ingestion Service
 *
 * Accepts sensor readings from:
 *   1. HTTP  POST /ingest/sensor-reading       (MVP — simulators, demo data)
 *   2. MQTT topic sensors/+/reading             (post-MVP — real devices)
 *
 * Forwards each reading to Redis pub/sub channel `sensor.reading` so the
 * api-gateway can broadcast it to the frontend over WebSockets.
 *
 * Per Finding 12 (High): the previous version bound to 0.0.0.0 and
 * accepted unauthenticated POSTs. The fixed version:
 *   - Binds to 127.0.0.1 by default; override with `INGESTION_HOST` only
 *     when behind a reverse proxy / within a trusted network.
 *   - Requires an `X-Ingest-Api-Key` header matching `INGEST_API_KEY`
 *     (or refuses to start if `INGEST_API_KEY` is missing in non-dev
 *     environments).
 *   - Applies a per-IP rate limit on /ingest/* endpoints.
 *   - CORS allowlist is opt-in via `INGESTION_CORS_ORIGIN`.
 */
import Fastify from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import { z } from "zod";
import { Redis } from "ioredis";
import mqtt from "mqtt";
import { randomBytes } from "crypto";

const PORT = Number(process.env.INGESTION_PORT) || Number(process.env.PORT) || 4100;
const HOST = process.env.INGESTION_HOST || "127.0.0.1";
const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";
const MQTT_URL = process.env.MQTT_URL || ""; // empty = MQTT disabled (MVP)
const CORS_ORIGIN = (process.env.INGESTION_CORS_ORIGIN || "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);
const NODE_ENV = process.env.NODE_ENV || "development";

/**
 * Resolve INGEST_API_KEY.
 *
 *   - In production/staging: REQUIRED. Refuse to start without it.
 *   - In development: if unset, generate a random one and log it. The
 *     developer must paste it into the simulator / curl command.
 *   - Never allow a deterministic dev fallback (per the same lesson as
 *     Finding 5 on the api-gateway: any constant value ends up in git
 *     examples and becomes a known backdoor).
 */
function resolveIngestApiKey(): string {
  const fromEnv = process.env.INGEST_API_KEY;
  if (fromEnv && fromEnv.length > 0) return fromEnv;
  if (NODE_ENV === "production" || NODE_ENV === "staging") {
    throw new Error(
      "INGEST_API_KEY is required in staging/production. Set it via orchestrator secrets.",
    );
  }
  const generated = randomBytes(24).toString("base64url");
  console.warn(
    `[ingestion-service] INGEST_API_KEY not set. Generated for this process: ${generated}. ` +
      "Set it in .env or your orchestrator to persist across restarts.",
  );
  return generated;
}

const INGEST_API_KEY = resolveIngestApiKey();

const SensorReading = z.object({
  sensorId: z.string().uuid(),
  assetId: z.string().uuid(),
  timestamp: z.string().datetime().optional(),
  value: z.number().finite(),
  unit: z.string().min(1).max(16),
  quality: z.enum(["good", "uncertain", "bad"]).default("good"),
});

const SimulatorScenario = z.object({
  scenario: z.enum(["normal", "chiller_failure", "power_surge_floor_3", "severe_temp_breach"]),
});

const app = Fastify({ logger: { level: process.env.LOG_LEVEL || "info" } });

// Per Finding 12 (followup): the previous version used `await` at the top
// level for `app.register(cors, ...)` and `app.register(rateLimit, ...)`.
// That works under tsx + ESM but breaks under tsx + CJS, which is the
// default output for this service (`tsconfig.json` has no `"type": "module"`
// and no `"module": "esnext"`, so `tsx watch` emits CJS, where top-level
// `await` is a syntax error).
//
// We keep the boot sequence identical — same registrations, same order —
// but move them into a single `main()` so the file is portable across
// both module systems. `app = Fastify(...)` stays at top level because it
// is synchronous and we want the instance available to module-scope route
// declarations below.

const redis = new Redis(REDIS_URL, {
  maxRetriesPerRequest: 3,
  lazyConnect: false,
});
redis.on("error", (err) => app.log.error({ err }, "redis error"));

async function publish(reading: z.infer<typeof SensorReading>) {
  const channel = "sensor.reading";
  await redis.publish(channel, JSON.stringify(reading));
}

/**
 * Auth hook for /ingest/* routes.
 *
 * In dev, the X-Ingest-Api-Key header must match INGEST_API_KEY. In a
 * real IoT deployment this becomes mTLS / per-device certs (post-MVP).
 */
async function requireIngestApiKey(
  req: import("fastify").FastifyRequest,
  reply: import("fastify").FastifyReply,
) {
  const provided = req.headers["x-ingest-api-key"];
  if (typeof provided !== "string" || provided.length === 0) {
    return reply.code(401).send({ error: "MissingApiKey" });
  }
  // Constant-time compare to avoid timing oracle on the key.
  const expected = Buffer.from(INGEST_API_KEY);
  const got = Buffer.from(provided);
  if (expected.length !== got.length) {
    return reply.code(403).send({ error: "InvalidApiKey" });
  }
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= (expected[i] ?? 0) ^ (got[i] ?? 0);
  }
  if (diff !== 0) {
    return reply.code(403).send({ error: "InvalidApiKey" });
  }
}

app.get("/health", async () => ({ status: "ok", service: "ingestion-service" }));

app.post(
  "/ingest/sensor-reading",
  { preHandler: requireIngestApiKey },
  async (req, reply) => {
    const parsed = SensorReading.safeParse(req.body);
    if (!parsed.success) {
      return reply
        .code(400)
        .send({ error: "InvalidBody", details: parsed.error.flatten() });
    }
    const reading = {
      ...parsed.data,
      timestamp: parsed.data.timestamp ?? new Date().toISOString(),
    };
    await publish(reading);
    return { ok: true, reading };
  },
);

app.post(
  "/ingest/simulator/scenario",
  { preHandler: requireIngestApiKey },
  async (req, reply) => {
    const parsed = SimulatorScenario.safeParse(req.body);
    if (!parsed.success) {
      return reply
        .code(400)
        .send({ error: "InvalidBody", details: parsed.error.flatten() });
    }
    const { scenario } = parsed.data;
    await redis.publish("simulator.control", JSON.stringify({ scenario }));
    return { ok: true, scenario };
  },
);

const main = async (): Promise<void> => {
  try {
    // CORS — only allow explicitly-listed origins. Empty list = no CORS
    // (browsers will block cross-origin requests, which is what we want for
    // a server-to-server ingestion endpoint).
    await app.register(cors, {
      origin: CORS_ORIGIN.length > 0 ? CORS_ORIGIN : false,
      credentials: true,
      methods: ["POST", "GET", "OPTIONS"],
    });

    // Per-IP rate limit: 120 requests / minute. Generous for a sensor stream
    // (2/s sustained) but blocks naive DoS / credential-stuffing patterns.
    await app.register(rateLimit, {
      max: 120,
      timeWindow: "1 minute",
    });

    // MQTT subscriber. Wired AFTER CORS / rate-limit registration so a
    // misbehaving broker can't cause us to bind the HTTP port first and
    // then fail plugin init.
    if (MQTT_URL) {
      const mqttClient: mqtt.MqttClient = mqtt.connect(MQTT_URL);
      mqttClient.on("connect", () => {
        app.log.info({ MQTT_URL }, "mqtt connected");
        mqttClient.subscribe("sensors/+/reading");
      });
      mqttClient.on("message", async (topic, payload) => {
        try {
          const json = JSON.parse(payload.toString());
          const parsed = SensorReading.parse(json);
          await publish(parsed);
        } catch (err) {
          app.log.warn({ err, topic }, "invalid mqtt message");
        }
      });
    }

    // Per Finding 12: bind to 127.0.0.1 by default. Override with
    // INGESTION_HOST=0.0.0.0 only when the service sits behind a
    // reverse proxy / within a trusted Docker network.
    await app.listen({ port: PORT, host: HOST });
    app.log.info({ host: HOST, port: PORT }, "ingestion-service listening");
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

main();
