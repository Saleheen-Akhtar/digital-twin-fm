"use client";

/**
 * Digital Twin FM — High-Fidelity 3D Equipment Models (R3F)
 *
 * Procedural 3D models for MEP assets. Each component renders
 * a multi-part model with PBR materials that matches the token
 * design system.
 */

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { Asset } from "./viewer-data";

// ─── 1. Chiller Unit ───────────────────────────────────────────────

export function ChillerUnit3D({ position = [0, 0, 0] }: { position?: [number, number, number] }) {
  return (
    <group position={position}>
      {/* Two Cylindrical Condenser Vessels */}
      <mesh position={[-0.28, 0.6, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.38, 0.38, 1.3, 24]} />
        <meshPhysicalMaterial color="#8a9baa" roughness={0.35} metalness={0.75} />
      </mesh>
      <mesh position={[0.28, 0.6, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.34, 0.34, 1.3, 24]} />
        <meshPhysicalMaterial color="#9db0c2" roughness={0.3} metalness={0.8} />
      </mesh>
      {/* Base Frame */}
      <mesh position={[0, 0.06, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.24, 0.12, 0.86]} />
        <meshPhysicalMaterial color="#a0b0c0" roughness={0.7} metalness={0.3} />
      </mesh>
      {/* Control Panel */}
      <mesh position={[-0.42, 0.46, 0.32]}>
        <boxGeometry args={[0.1, 0.34, 0.24]} />
        <meshPhysicalMaterial color="#1e293a" roughness={0.4} metalness={0.1} />
      </mesh>
      {/* Display Screen */}
      <mesh position={[-0.47, 0.48, 0.22]}>
        <planeGeometry args={[0.04, 0.1]} />
        <meshBasicMaterial color="#06d6a0" />
      </mesh>
      {/* Copper Pipe Manifold */}
      <mesh position={[0, 0.34, 0.38]}>
        <cylinderGeometry args={[0.04, 0.04, 0.5, 8]} />
        <meshPhysicalMaterial color="#b85a30" roughness={0.6} metalness={0.4} />
      </mesh>
    </group>
  );
}

// ─── 2. Air Handler Unit ───────────────────────────────────────────

export function AirHandlerUnit3D({ position = [0, 0, 0] }: { position?: [number, number, number] }) {
  return (
    <group position={position}>
      {/* Main Casing */}
      <mesh position={[0, 0.52, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.9, 1.04, 1.1]} />
        <meshPhysicalMaterial color="#6d7f91" roughness={0.5} metalness={0.55} />
      </mesh>
      {/* Panel Details (raised trim) */}
      <mesh position={[0.76, 0.4, 0.56]}>
        <boxGeometry args={[0.02, 0.3, 0.16]} />
        <meshPhysicalMaterial color="#536575" roughness={0.6} metalness={0.5} />
      </mesh>
      {/* Air Intake Grille */}
      {[-0.6, -0.3, 0, 0.3, 0.6].map((y, i) => (
        <mesh key={i} position={[0.96, y - 0.05, 0]}>
          <boxGeometry args={[0.02, 0.12, 0.9]} />
          <meshPhysicalMaterial color="#354455" roughness={0.5} metalness={0.4} />
        </mesh>
      ))}
      {/* Supply Air Outlet Spigot */}
      <mesh position={[-0.96, 0.4, -0.3]}>
        <cylinderGeometry args={[0.15, 0.2, 0.12, 14]} />
        <meshPhysicalMaterial color="#657688" roughness={0.4} metalness={0.45} />
      </mesh>
    </group>
  );
}

// ─── 3. Industrial Boiler ──────────────────────────────────────────

export function IndustrialBoiler3D({ position = [0, 0, 0] }: { position?: [number, number, number] }) {
  return (
    <group position={position}>
      {/* Main Cylindrical Drum */}
      <mesh position={[0, 0.74, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.65, 0.65, 1.1, 22]} />
        <meshPhysicalMaterial color="#506376" roughness={0.45} metalness={0.65} />
      </mesh>
      {/* Retaining Rings */}
      {[-0.45, -0.22, 0, 0.22, 0.45].map((y, i) => (
        <mesh key={i} position={[0, 0.74 + y, 0]}>
        <cylinderGeometry args={[0.67, 0.67, 0.015, 22]} />
        <meshPhysicalMaterial color="#7a8fa3" roughness={0.4} metalness={0.7} />
        </mesh>
      ))}
      {/* Base Stand */}
      <mesh position={[0, -0.06, 0]} castShadow>
        <boxGeometry args={[1.5, 0.12, 0.8]} />
        <meshPhysicalMaterial color="#8a9aaa" roughness={0.7} metalness={0.3} />
      </mesh>
      {/* Firebox Door (front) */}
      <mesh position={[0, 0.48, 0.67]}>
        <circleGeometry args={[0.3, 16]} />
        <meshPhysicalMaterial color="#2c3d4b" roughness={0.6} metalness={0.8} />
      </mesh>
      {/* Relief Valve */}
      <mesh position={[0, 1.2, 0]}>
        <cylinderGeometry args={[0.06, 0.08, 0.14, 8]} />
        <meshPhysicalMaterial color="#c93838" roughness={0.5} metalness={0.3} />
      </mesh>
      {/* Exhaust Flue */}
      <mesh position={[-0.3, 1.24, -0.2]}>
        <cylinderGeometry args={[0.04, 0.06, 0.22, 8]} />
        <meshPhysicalMaterial color="#3a4c5e" roughness={0.5} metalness={0.6} />
      </mesh>
    </group>
  );
}

// ─── 4. Centrifugal Pump ───────────────────────────────────────────

export function CentrifugalPump3D({ position = [0, 0, 0] }: { position?: [number, number, number] }) {
  return (
    <group position={position}>
      {/* Concrete Baseplate */}
      <mesh position={[0, -0.04, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.72, 0.08, 0.58]} />
        <meshPhysicalMaterial color="#b0bcc8" roughness={0.9} metalness={0.02} />
      </mesh>
      {/* Pump Volute */}
      <mesh position={[-0.12, 0.18, 0]} castShadow receiveShadow>
        <sphereGeometry args={[0.22, 16, 16]} />
        <meshPhysicalMaterial color="#5b6d7e" roughness={0.4} metalness={0.6} />
      </mesh>
      {/* Motor Housing */}
      <mesh position={[0.28, 0.22, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.16, 0.18, 0.34, 14]} />
        <meshPhysicalMaterial color="#889aaa" roughness={0.5} metalness={0.3} />
      </mesh>
      {/* Motor cooling fins */}
      {[0.15, 0.2, 0.25, 0.3, 0.35].map((y, i) => (
        <mesh key={i} position={[0.28, y, 0.18]}>
        <boxGeometry args={[0.02, 0.012, 0.05]} />
        <meshPhysicalMaterial color="#5c6f80" roughness={0.4} metalness={0.7} />
        </mesh>
      ))}
      {/* Inlet Flange */}
      <mesh position={[-0.3, 0.18, 0]}>
        <cylinderGeometry args={[0.08, 0.1, 0.04, 12]} />
        <meshPhysicalMaterial color="#798b9c" roughness={0.3} metalness={0.6} />
      </mesh>
      {/* Outlet Flange */}
      <mesh position={[-0.12, 0.18, 0.24]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.06, 0.08, 0.04, 12]} />
        <meshPhysicalMaterial color="#798b9c" roughness={0.3} metalness={0.6} />
      </mesh>
    </group>
  );
}

// ─── 5. Exhaust Fan ────────────────────────────────────────────────

export function ExhaustFan3D({ position = [0, 0, 0] }: { position?: [number, number, number] }) {
  const rotorRef = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (rotorRef.current) rotorRef.current.rotation.z = clock.getElapsedTime() * 8;
  });
  return (
    <group position={position}>
      {/* Housing (scroll casing style) */}
      <mesh castShadow receiveShadow>
        <cylinderGeometry args={[0.4, 0.44, 0.35, 22]} />
        <meshPhysicalMaterial color="#889aaa" roughness={0.5} metalness={0.4} />
      </mesh>
      {/* Impeller (rotating) */}
      <mesh ref={rotorRef} position={[0, 0, 0.04]}>
        <boxGeometry args={[0.6, 0.04, 0.06]} />
        <meshPhysicalMaterial color="#98aec2" roughness={0.3} metalness={0.8} />
      </mesh>
      {/* Second blade crossed */}
      <mesh ref={rotorRef} position={[0, 0, 0.04]}>
        <boxGeometry args={[0.04, 0.6, 0.06]} />
        <meshPhysicalMaterial color="#98aec2" roughness={0.3} metalness={0.8} />
      </mesh>
      {/* Center hub */}
      <mesh position={[0, 0, 0.06]}>
        <cylinderGeometry args={[0.1, 0.1, 0.04, 14]} />
        <meshPhysicalMaterial color="#1f2d39" roughness={0.5} metalness={0.6} />
      </mesh>
      {/* Safety guard (cage) */}
      <mesh position={[0, 0, 0.18]}>
        <ringGeometry args={[0.14, 0.42, 22]} />
        <meshPhysicalMaterial color="#76899a" roughness={0.4} metalness={0.3} side={THREE.DoubleSide} transparent opacity={0.35} wireframe />
      </mesh>
      {/* Mounting bracket */}
      <mesh position={[0, -0.24, 0]}>
        <boxGeometry args={[0.54, 0.08, 0.12]} />
        <meshPhysicalMaterial color="#889aaa" roughness={0.6} metalness={0.3} />
      </mesh>
    </group>
  );
}

// ─── 6. Elevator Cab ──────────────────────────────────────────────

export function ElevatorCab3D({ position = [0, 0, 0] }: { position?: [number, number, number] }) {
  const cabRef = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!cabRef.current) return;
    cabRef.current.position.y = Math.sin(clock.getElapsedTime() * 0.6) * 0.25;
  });
  return (
    <group position={position}>
      {/* Guide rails (continuous) */}
      {[-0.86, 0.86].map((x, i) => (
        <mesh key={i} position={[x, 1.8, 0]}>
          <boxGeometry args={[0.04, 3.6, 0.04]} />
          <meshPhysicalMaterial color="#8a9db0" roughness={0.3} metalness={0.85} />
        </mesh>
      ))}
      {/* Cab */}
      <group ref={cabRef} position={[0, 1.6, 0]}>
        {/* Cab walls (glass) */}
        <mesh position={[0, 0.7, 0]} castShadow>
          <boxGeometry args={[1.38, 1.4, 1.38]} />
          <meshPhysicalMaterial color="#6d8fb0" transparent opacity={0.45} transmission={0.35} roughness={0.05} metalness={0.1} ior={1.5} clearcoat={0.9} />
        </mesh>
        {/* Door frame */}
        <mesh position={[0, 0.7, 0.71]}>
          <boxGeometry args={[0.8, 0.9, 0.02]} />
          <meshPhysicalMaterial color="#a8bfd4" roughness={0.2} metalness={0.7} />
        </mesh>
        {/* Door split */}
        <mesh position={[0, 0.7, 0.72]}>
          <boxGeometry args={[0.02, 0.86, 0.01]} />
          <meshPhysicalMaterial color="#1d2b36" />
        </mesh>
        {/* Top trim */}
        <mesh position={[0, 1.35, 0.71]}>
          <boxGeometry args={[0.86, 0.04, 0.02]} />
          <meshBasicMaterial color="#38bdf8" />
        </mesh>
        {/* Counterweight cables */}
        {[-0.5, 0.5].map((x, i) => (
          <mesh key={i} position={[x, -1, 0]}>
          <cylinderGeometry args={[0.015, 0.015, 2, 6]} />
          <meshPhysicalMaterial color="#3a4d5e" roughness={0.5} metalness={0.8} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

// ─── 7. Electrical Transformer ─────────────────────────────────────

export function ElectricalTransformer3D({ position = [0, 0, 0] }: { position?: [number, number, number] }) {
  return (
    <group position={position}>
      {/* Core / Main tank */}
      <mesh position={[0, 0.54, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.72, 1.08, 0.58]} />
        <meshPhysicalMaterial color="#7a8a9a" roughness={0.5} metalness={0.4} />
      </mesh>
      {/* Radiator cooling fins */}
      {[-0.38, -0.19, 0, 0.19, 0.38].map((x, i) => (
        <mesh key={i} position={[x, 0.6, 0.31]}>
        <boxGeometry args={[0.012, 0.6, 0.14]} />
        <meshPhysicalMaterial color="#5a6b7a" roughness={0.4} metalness={0.7} />
        </mesh>
      ))}
      {/* Bushing insulators (porcelain) */}
      {[-0.18, 0.18].map((x, i) => (
        <mesh key={i} position={[x, 1.12, 0]}>
        <cylinderGeometry args={[0.04, 0.06, 0.16, 10]} />
        <meshPhysicalMaterial color="#d4dce8" roughness={0.6} metalness={0.05} />
        </mesh>
      ))}
      {/* Coil top */}
      <mesh position={[0.06, 0.9, 0.2]}>
        <boxGeometry args={[0.34, 0.08, 0.08]} />
        <meshPhysicalMaterial color="#b87333" roughness={0.35} metalness={0.6} />
      </mesh>
      {/* Base plate */}
      <mesh position={[0, 0.02, 0]} castShadow>
        <boxGeometry args={[0.9, 0.04, 0.74]} />
        <meshPhysicalMaterial color="#1f2d39" roughness={0.7} metalness={0.4} />
      </mesh>
    </group>
  );
}

// ─── 8. Light Fixture — Ceiling LED Panel ────────────────────────

export function LightFixture3D({ position = [0, 0, 0] }: { position?: [number, number, number] }) {
  return (
    <group position={position}>
      {/* Troffer housing (recessed in ceiling) */}
      <mesh position={[0, -0.08, 0]} castShadow>
        <boxGeometry args={[0.6, 0.04, 0.6]} />
        <meshPhysicalMaterial color="#889898" roughness={0.6} metalness={0.5} />
      </mesh>
      {/* Diffuser (lit surface) */}
      <mesh position={[0, -0.1, 0]}>
        <planeGeometry args={[0.48, 0.48]} />
        <meshBasicMaterial
          color="#ffeeda"
          transparent
          opacity={0.92}
          toneMapped={false}
        />
      </mesh>
      {/* Glow halo */}
      <pointLight color="#ffe8c4" intensity={0.4} distance={3} />
    </group>
  );
}

// ─── 9. HVAC Diffuser — Ceiling Grille ────────────────────────────

export function HvacDiffuser3D({ position = [0, 0, 0] }: { position?: [number, number, number] }) {
  return (
    <group position={position}>
      {/* Frame */}
      <mesh>
        <boxGeometry args={[0.45, 0.03, 0.45]} />
        <meshPhysicalMaterial color="#bfceda" roughness={0.55} metalness={0.45} />
      </mesh>
      {/* Louver slats */}
      {[-0.15, -0.07, 0, 0.07, 0.15].map((x, i) => (
        <mesh key={i} position={[x, -0.015, 0]}>
          <boxGeometry args={[0.04, 0.01, 0.36]} />
          <meshPhysicalMaterial color="#7a8a9a" roughness={0.6} metalness={0.5} />
        </mesh>
      ))}
    </group>
  );
}

// ─── 10. Sensor Node — Environmental Monitor ───────────────────────

export function SensorNode3D({ position = [0, 0, 0] }: { position?: [number, number, number] }) {
  return (
    <group position={position}>
      {/* Base puck */}
      <mesh castShadow>
        <cylinderGeometry args={[0.12, 0.14, 0.05, 16]} />
        <meshPhysicalMaterial color="#e2e8f0" roughness={0.4} metalness={0.2} />
      </mesh>
      {/* Dome */}
      <mesh position={[0, 0.04, 0]}>
        <sphereGeometry args={[0.08, 12, 12]} />
        <meshPhysicalMaterial color="#1a2330" roughness={0.15} metalness={0.05} clearcoat={0.9} />
      </mesh>
      {/* Status LED */}
      <mesh position={[0, 0.06, 0.06]}>
        <circleGeometry args={[0.018, 8]} />
        <meshBasicMaterial color="#22c55e" />
      </mesh>
    </group>
  );
}

// ─── 11. Fire Alarm — Wall Strobe ───────────────────────────────

export function FireAlarm3D({ position = [0, 0, 0] }: { position?: [number, number, number] }) {
  return (
    <group position={position}>
      {/* Backplate */}
      <mesh>
        <boxGeometry args={[0.16, 0.22, 0.04]} />
        <meshPhysicalMaterial color="#e63946" roughness={0.3} metalness={0.1} />
      </mesh>
      {/* Strobe lens */}
      <mesh position={[0, 0.03, 0]}>
        <boxGeometry args={[0.1, 0.12, 0.02]} />
        <meshPhysicalMaterial
          color="#ff3333"
          emissive="#ff0000"
          emissiveIntensity={0.5}
          transparent
          opacity={0.85}
          roughness={0.1}
          metalness={0}
        />
      </mesh>
      {/* Horn vents */}
      {[-0.04, 0.04].map((x, i) => (
        <mesh key={i} position={[x, -0.05, 0.02]}>
          <boxGeometry args={[0.02, 0.02, 0.01]} />
          <meshBasicMaterial color="#1a1a2e" />
        </mesh>
      ))}
    </group>
  );
}

// ─── Dispatch Component ───────────────────────────────────────────

export function EquipmentModel3D({ asset }: { asset: Asset }) {
  // Use [0, 0, 0] relative to the parent group so we don't float incorrectly.
  // The AssetMarker3D already positions the group at the exact [x, y, z].
  const pos: [number, number, number] = [0, 0, 0];

  switch (asset.type) {
    case "Chiller":
      return <ChillerUnit3D position={pos} />;
    case "Air Handler":
      return <AirHandlerUnit3D position={pos} />;
    case "Boiler":
      return <IndustrialBoiler3D position={pos} />;
    case "Pump":
      return <CentrifugalPump3D position={pos} />;
    case "Fan":
      return <ExhaustFan3D position={pos} />;
    case "Elevator":
      return <ElevatorCab3D position={pos} />;
    case "Lighting":
      return <LightFixture3D position={pos} />;
    case "Light Fixture":
      return <LightFixture3D position={pos} />;
    case "HVAC Diffuser":
      return <HvacDiffuser3D position={pos} />;
    case "Sensor":
      return <SensorNode3D position={pos} />;
    case "Fire Alarm":
      return <FireAlarm3D position={pos} />;
    default:
      return <ElectricalTransformer3D position={pos} />;
  }
}
