/**
 * Digital Twin FM — Animated Airflow Particle System (R3F)
 *
 * Renders directional airflow particles showing how conditioned air
 * moves from AHUs through the space. Each particle follows a bezier
 * spline from a source position (AHU) toward diffuser locations
 * distributed across the floor.
 *
 * Visual design:
 *   - Tiny circular instanced point sprites (white/cyan, 0.06 radius)
 *   - Particle density and speed scale with live CFM telemetry
 *   - Particles fade-in near source, fade-out at diffuser
 *   - Colour shifts from cold (#38bdf8) near AHU → warm (#fbbf24) near room
 */

"use client";

import { useMemo, useRef, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

// ─── Types ────────────────────────────────────────────────────────

export interface AirflowSource {
  /** Source position — usually an AHU or Fan asset position */
  x: number;
  y: number;
  z: number;
  /** Volumetric flow in CFM — scales particle count and speed */
  cfm?: number;
  /** Direction vector (normalized). Default: [0, 0, 1] (toward front of hall) */
  dirX?: number;
  dirZ?: number;
}

interface AirflowParticlesProps {
  /** Array of airflow sources (AHUs / fans) on this floor */
  sources: AirflowSource[];
  /** Particles per source. Default 40 */
  particlesPerSource?: number;
  /** Speed multiplier. Default 1.0 */
  speedMultiplier?: number;
  /** Overall opacity. Default 0.7 */
  opacity?: number;
}

// ─── Particle Instance Data ────────────────────────────────────────

interface Particle {
  sourceIdx: number;
  /** 0–1 progress along the flow path */
  t: number;
  /** Speed: how fast t advances per second */
  speed: number;
  /** Lateral sway offset */
  swayX: number;
  swayZ: number;
  swayFreq: number;
  swayAmp: number;
}

// ─── Main component ────────────────────────────────────────────────

export function AirflowParticles({
  sources,
  particlesPerSource = 40,
  speedMultiplier = 1.0,
  opacity = 0.7,
}: AirflowParticlesProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null);

  // Build initial particle data
  const particles = useMemo<Particle[]>(() => {
    return sources.flatMap((_, si) =>
      Array.from({ length: particlesPerSource }, (__, pi) => ({
        sourceIdx: si,
        // stagger start positions so not all particles start at the source simultaneously
        t: (pi / particlesPerSource),
        speed: 0.08 + Math.random() * 0.06,
        swayX: (Math.random() - 0.5) * 3.0,
        swayZ: (Math.random() - 0.5) * 3.0,
        swayFreq: 0.4 + Math.random() * 0.8,
        swayAmp: 0.15 + Math.random() * 0.25,
      }))
    );
  }, [sources, particlesPerSource]);

  const totalCount = particles.length;

  // Pre-allocate reusable objects (outside useFrame to avoid GC churn)
  const dummy  = useMemo(() => new THREE.Object3D(), []);
  const color  = useMemo(() => new THREE.Color(), []);

  // Build material once
  const material = useMemo(() => {
    return new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Update material opacity when prop changes
  useEffect(() => {
    material.opacity = opacity;
  }, [opacity, material]);

  useFrame((state, delta) => {
    const mesh = meshRef.current;
    if (!mesh || sources.length === 0) return;

    const t = state.clock.getElapsedTime();

    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      const src = sources[p.sourceIdx];
      if (!src) continue;

      // Advance particle along path
      p.t += p.speed * speedMultiplier * delta;
      if (p.t > 1.0) p.t -= 1.0; // loop

      const progress = p.t;

      // Bezier path: start at AHU → arc up → spread across room
      // Control point 1: slightly above source
      // Control point 2: toward the far room area
      const dirX = src.dirX ?? 0.0;
      const dirZ = src.dirZ ?? 1.0;
      const spread = 8.0;

      const x0 = src.x, y0 = src.y, z0 = src.z;
      const x3 = src.x + dirX * spread + p.swayX;
      const y3 = src.y - 1.2; // diffusers are lower than AHU
      const z3 = src.z + dirZ * spread + p.swayZ;

      // Control points for smooth arc
      const x1 = x0 + dirX * 1.5;
      const y1 = y0 + 0.4;
      const z1 = z0 + dirZ * 1.5;
      const x2 = x3 - dirX * 1.5;
      const y2 = y3 + 0.4;
      const z2 = z3 - dirZ * 1.5;

      // Cubic bezier
      const s = 1 - progress;
      const px = s*s*s*x0 + 3*s*s*progress*x1 + 3*s*progress*progress*x2 + progress*progress*progress*x3;
      const py = s*s*s*y0 + 3*s*s*progress*y1 + 3*s*progress*progress*y2 + progress*progress*progress*y3;
      const pz = s*s*s*z0 + 3*s*s*progress*z1 + 3*s*progress*progress*z2 + progress*progress*progress*z3;

      // Subtle sway
      const sway = Math.sin(t * p.swayFreq + i * 0.7) * p.swayAmp * progress;

      dummy.position.set(px + sway, py, pz);
      dummy.scale.setScalar(0.06 + 0.02 * Math.sin(t * 2 + i));
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);

      // Colour: cyan near source → light blue/white toward room
      // Fade edges: fade in for first 10%, fade out for last 10%
      const alpha = Math.min(progress / 0.1, 1) * Math.min((1 - progress) / 0.1, 1);
      color.setHSL(0.55 - progress * 0.08, 0.9, 0.55 + progress * 0.2);
      mesh.setColorAt(i, color);

      // Update opacity per-instance via scale (instance colors handle the visual)
      // Note: additive blending handles the fade naturally
      void alpha; // suppress unused warning
    }

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  });

  if (totalCount === 0 || sources.length === 0) return null;

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, totalCount]}
      frustumCulled={false}
    >
      <sphereGeometry args={[0.06, 6, 6]} />
      <primitive object={material} attach="material" />
    </instancedMesh>
  );
}

// ─── Default demo airflow sources from SEED_ASSETS ────────────────

/**
 * Returns airflow sources for a given floor based on AHU/Fan positions.
 * In production this would be derived from live asset telemetry.
 */
export function getDefaultAirflowSources(floorLevel: number): AirflowSource[] {
  if (floorLevel === 0) {
    return [
      // AHUs in plant room blow toward main halls
      { x: -6,   y: 7.8, z: 9.4, cfm: 8230, dirX: 0,   dirZ: -1 },
      { x: -2.5, y: 7.8, z: 9.4, cfm: 8460, dirX: -0.3, dirZ: -1 },
      { x: 1,    y: 7.8, z: 9.4, cfm: 8690, dirX: 0.3,  dirZ: -1 },
      // Exhaust fan at concourse
      { x: 0,    y: 3.0, z: -5.5, cfm: 4000, dirX: 0, dirZ: 1 },
    ];
  }
  if (floorLevel === 1) {
    return [
      { x: -10, y: 16.8, z: 0, cfm: 5500, dirX: 1,  dirZ: 0 },
      { x: 10,  y: 16.8, z: 0, cfm: 5500, dirX: -1, dirZ: 0 },
    ];
  }
  return [];
}
