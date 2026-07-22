/**
 * Digital Twin FM — Real-Time Floor Thermal Heatmap (R3F)
 *
 * Renders a live, interpolated temperature heatmap directly on
 * room floors using a custom THREE.ShaderMaterial.
 *
 * The heatmap uses Inverse Distance Weighting (IDW) interpolation
 * between sensor readings, producing smooth hot/cool gradients that
 * update in real-time as telemetry changes.
 *
 * Color scale:
 *   cold  (#3b82f6) → ≤ 20 °C
 *   cool  (#22c55e) → 20–23 °C  (normal operating range)
 *   warm  (#f59e0b) → 23–27 °C  (elevated)
 *   hot   (#ef4444) → ≥ 27 °C  (alarm)
 */

"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { FloorData } from "./building-geometry";

// ─── Types ────────────────────────────────────────────────────────

export interface ThermalSensor {
  /** World-space xz position of the sensor (y is ignored — always on floor). */
  x: number;
  z: number;
  /** Temperature reading in °C */
  temperature: number;
}

interface ThermalHeatmapProps {
  /** Floor data for bounds/placement. */
  floor: FloorData;
  /** Live sensor readings. Updated each render cycle via uniforms. */
  sensors: ThermalSensor[];
  /** 0–1 opacity of the heatmap overlay. Default 0.55. */
  opacity?: number;
}

// ─── Thermal Gradient Lookup ──────────────────────────────────────

// Maps normalized temp (0=cold, 1=hot) → RGB colour via 4-stop gradient.
// Stops: 20°C, 23°C, 27°C, 30°C mapped to [0, 0.33, 0.77, 1.0]
const TEMP_MIN = 18.0;
const TEMP_MAX = 30.0;

// ─── GLSL Shader ─────────────────────────────────────────────────

const VERTEX_SHADER = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vWorldPos;

  void main() {
    vUv = uv;
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPos = worldPos.xzy; // swap y/z since floor is XZ plane
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FRAGMENT_SHADER = /* glsl */ `
  #define MAX_SENSORS 24

  uniform float uSensorX[MAX_SENSORS];
  uniform float uSensorZ[MAX_SENSORS];
  uniform float uSensorTemp[MAX_SENSORS];
  uniform int uSensorCount;
  uniform float uTempMin;
  uniform float uTempMax;
  uniform float uOpacity;
  uniform float uTime;

  varying vec2 vUv;
  varying vec3 vWorldPos;

  // 4-stop colour gradient: cold → cool → warm → hot
  vec3 thermalColor(float t) {
    vec3 cold = vec3(0.231, 0.510, 0.965);   // #3b82f6
    vec3 cool = vec3(0.133, 0.773, 0.369);   // #22c55e
    vec3 warm = vec3(0.961, 0.620, 0.043);   // #f59e0b
    vec3 hot  = vec3(0.937, 0.267, 0.267);   // #ef4444

    if (t < 0.33) return mix(cold, cool, t / 0.33);
    if (t < 0.66) return mix(cool, warm, (t - 0.33) / 0.33);
    return mix(warm, hot, (t - 0.66) / 0.34);
  }

  void main() {
    // IDW interpolation (power = 2)
    float weightSum = 0.0;
    float tempSum   = 0.0;

    for (int i = 0; i < MAX_SENSORS; i++) {
      if (i >= uSensorCount) break;
      float dx = vWorldPos.x - uSensorX[i];
      float dz = vWorldPos.z - uSensorZ[i];
      float dist2 = dx * dx + dz * dz;
      float w = 1.0 / max(dist2, 0.01); // IDW weight
      weightSum += w;
      tempSum   += w * uSensorTemp[i];
    }

    float temp = (uSensorCount > 0) ? tempSum / weightSum : 22.0;

    // Normalise to [0, 1] over the colour range
    float t = clamp((temp - uTempMin) / (uTempMax - uTempMin), 0.0, 1.0);

    vec3 colour = thermalColor(t);

    // Subtle animated shimmer (very faint, just enough to feel "live")
    float shimmer = sin(vUv.x * 40.0 + uTime * 1.2) * sin(vUv.y * 40.0 + uTime * 0.8);
    colour += shimmer * 0.012;

    // Vignette towards room edges (fades out near walls)
    float vignette = 1.0 - smoothstep(0.38, 0.5, length(vUv - 0.5));

    gl_FragColor = vec4(colour, uOpacity * vignette);
  }
`;

// ─── Heatmap plane component ──────────────────────────────────────

export function ThermalHeatmap({ floor, sensors, opacity = 0.55 }: ThermalHeatmapProps) {
  const matRef = useRef<THREE.ShaderMaterial>(null);

  // Build floor footprint bounds for plane sizing
  const bounds = useMemo(() => {
    const rooms = floor.rooms ?? [];
    if (rooms.length === 0) return { cx: 0, cz: 0, w: 36, d: 24 };
    const xs = rooms.flatMap((r) => r.vertices.map((v) => v.x));
    const zs = rooms.flatMap((r) => r.vertices.map((v) => v.z));
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minZ = Math.min(...zs), maxZ = Math.max(...zs);
    return {
      cx: (minX + maxX) / 2,
      cz: (minZ + maxZ) / 2,
      w: maxX - minX,
      d: maxZ - minZ,
    };
  }, [floor]);

  // Build initial uniforms (capped at MAX_SENSORS = 24)
  const uniforms = useMemo<Record<string, THREE.IUniform>>(() => {
    const MAX = 24;
    const sx = new Float32Array(MAX);
    const sz = new Float32Array(MAX);
    const st = new Float32Array(MAX);
    sensors.slice(0, MAX).forEach((s, i) => { sx[i] = s.x; sz[i] = s.z; st[i] = s.temperature; });
    return {
      uSensorX:     { value: sx },
      uSensorZ:     { value: sz },
      uSensorTemp:  { value: st },
      uSensorCount: { value: Math.min(sensors.length, MAX) },
      uTempMin:     { value: TEMP_MIN },
      uTempMax:     { value: TEMP_MAX },
      uOpacity:     { value: opacity },
      uTime:        { value: 0 },
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Update uniforms each frame (sensors + time)
  useFrame((state) => {
    if (!matRef.current) return;
    const u = matRef.current.uniforms;
    const MAX = 24;
    sensors.slice(0, MAX).forEach((s, i) => {
      u.uSensorX.value[i]    = s.x;
      u.uSensorZ.value[i]    = s.z;
      u.uSensorTemp.value[i] = s.temperature;
    });
    u.uSensorCount.value = Math.min(sensors.length, MAX);
    u.uOpacity.value     = opacity;
    u.uTime.value        = state.clock.getElapsedTime();
  });

  const yPos = floor.yBase + 0.025; // just above floor slab

  return (
    <mesh
      position={[bounds.cx, yPos, bounds.cz]}
      rotation={[-Math.PI / 2, 0, 0]}
      renderOrder={1}
    >
      <planeGeometry args={[bounds.w, bounds.d, 1, 1]} />
      <shaderMaterial
        ref={matRef}
        vertexShader={VERTEX_SHADER}
        fragmentShader={FRAGMENT_SHADER}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        side={THREE.DoubleSide}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  );
}

// ─── Default demo sensors for SEED_ASSETS (when no live API) ─────

export function generateDemoSensors(floorLevel: number): ThermalSensor[] {
  // Sensor positions mapped to the reference model footprint (W=36, D=25)
  // Distributed across the actual zone layout for smooth IDW interpolation
  if (floorLevel === 0) {
    return [
      // Main Entrance / Lobby (cool)
      { x: -6, z: -9.5, temperature: 20.2 },
      { x: 0,  z: -9.5, temperature: 20.8 },
      { x: 6,  z: -9.5, temperature: 20.5 },
      { x: -6, z: -5.5, temperature: 21.0 },
      { x: 0,  z: -5.5, temperature: 21.2 },
      { x: 6,  z: -5.5, temperature: 21.1 },
      // Exhibition Hall A (moderate)
      { x: -9, z: 1,   temperature: 22.5 },
      { x: -6, z: 2,   temperature: 22.8 },
      { x: -3, z: 4,   temperature: 23.1 },
      // Exhibition Hall B (moderate)
      { x: 3,  z: 1,   temperature: 22.0 },
      { x: 6,  z: 2,   temperature: 22.4 },
      { x: 9,  z: 4,   temperature: 22.7 },
      // Plant room / Services — hot (chillers, boilers)
      { x: -3, z: 9,   temperature: 27.2 },
      { x: 2,  z: 9,   temperature: 28.0 },
      { x: 5,  z: 9,   temperature: 27.8 },
      // Café (slightly warm from kitchen)
      { x: -8, z: -3,  temperature: 24.0 },
    ];
  }
  if (floorLevel === 1) {
    return [
      // Exhibition Hall C (moderate)
      { x: -9, z: -2,  temperature: 22.0 },
      { x: -5, z: 0,   temperature: 22.5 },
      { x: -7, z: 2,   temperature: 22.2 },
      // Exhibition Hall D (warm — afternoon sun side)
      { x: 3,  z: -2,  temperature: 23.5 },
      { x: 7,  z: 0,   temperature: 23.8 },
      { x: 5,  z: 2,   temperature: 23.2 },
      // Meeting Rooms (cool — well air-conditioned)
      { x: 0,  z: -7,  temperature: 20.5 },
      { x: -2, z: -5,  temperature: 20.8 },
      // Terrace (outdoor — hot)
      { x: -8, z: -6,  temperature: 29.5 },
    ];
  }
  if (floorLevel === 2) {
    return [
      // Chiller Plant (hot)
      { x: -4, z: -2,  temperature: 27.5 },
      { x: -0, z: 0,   temperature: 26.8 },
      { x: -6, z: 1,   temperature: 27.0 },
      // AHU Deck (warm)
      { x: 6,  z: 2,   temperature: 25.2 },
      { x: 8,  z: 3,   temperature: 25.0 },
    ];
  }
  return [];
}
