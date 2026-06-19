import { describe, it, expect } from "vitest";
import { z } from "zod";

// Inline minimal version of the schema to avoid importing the whole service
const SensorReading = z.object({
  sensorId: z.string().uuid(),
  assetId: z.string().uuid(),
  value: z.number().finite(),
  unit: z.string().min(1).max(16),
  quality: z.enum(["good", "uncertain", "bad"]).default("good"),
});

describe("SensorReading schema", () => {
  it("accepts a valid reading", () => {
    const r = SensorReading.parse({
      sensorId: "00000000-0000-0000-0000-000000000000",
      assetId: "00000000-0000-0000-0000-000000000001",
      value: 22.5,
      unit: "C",
    });
    expect(r.quality).toBe("good");
  });

  it("rejects non-finite value", () => {
    expect(() => SensorReading.parse({ sensorId: "x", assetId: "y", value: NaN, unit: "C" })).toThrow();
  });
});
