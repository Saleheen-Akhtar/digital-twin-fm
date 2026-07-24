"use client";

import { useMemo } from "react";
import { ThreeEvent } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import type { Asset } from "./viewer-data";
import type { FloorFilter } from "./viewer-store";
import { colors } from "@/design-system/tokens";
import { EquipmentModel3D } from "./equipment-models-3d";
import { BUILDING_FLOORS } from "./building-floors";

const WIDTH = 36;
const DEPTH = 25;
const FLOOR_HEIGHT = 5.15;
const FLOORS = 4;

// MEP equipment types that should render as full 3D models
const MAJOR_MEP = new Set(["Chiller", "Air Handler", "Boiler", "Pump", "Fan", "Elevator"]);
// Ceiling-mounted minor fixtures
const CEILING_FIXTURE = new Set(["Light Fixture", "Lighting", "HVAC Diffuser", "Sensor"]);
// Wall-mounted fixtures
const WALL_FIXTURE = new Set(["Fire Alarm"]);

/** Ceiling-mounted minor fixture: small lit indicator */
function CeilingDot({ position, color, size = 0.12 }: { position: [number, number, number]; color: string; size?: number }) {
  return (
    <group position={position}>
      <mesh>
        <circleGeometry args={[size, 8]} />
        <meshBasicMaterial color={color} transparent opacity={0.7} depthWrite={false} />
      </mesh>
    </group>
  );
}

/** Wall-mounted fixture: small rectangular indicator */
function WallTag({ position, color }: { position: [number, number, number]; color: string }) {
  return (
    <mesh position={position}>
      <planeGeometry args={[0.14, 0.18]} />
      <meshBasicMaterial color={color} side={THREE.DoubleSide} />
    </mesh>
  );
}

function getStatusColor(status: string): string {
  const s = colors.status as Record<string, string>;
  return s[status] ?? "#8899aa";
}

/**
 * Clean, light convention centre building.
 * - Glass curtain wall with silver mullions
 * - Light concrete floors
 * - MEP equipment only on plant floors
 * - Ceiling fixtures as subtle dots
 * - No oversized click boxes
 */
export function ReferenceConventionCentre({
  assets,
  selectedFloor,
  selectedAssetId,
  onAssetClick,
}: {
  assets: Asset[];
  selectedFloor: FloorFilter;
  selectedAssetId?: string;
  onAssetClick: (asset: Asset) => void;
}) {
  const positionedAssets = useMemo(
    () => assets.map((asset, index) => {
      const level = asset.floor != null
        ? Math.min(asset.floor, FLOORS - 1)
        : index % FLOORS;
      const yBase = level * FLOOR_HEIGHT;
      let y = yBase;
      if (CEILING_FIXTURE.has(asset.type)) y = yBase + FLOOR_HEIGHT - 0.2;
      else if (WALL_FIXTURE.has(asset.type)) y = yBase + 1.5;
      // MEP stays at floor level
      return { asset, level, y, x: asset.x, z: asset.z };
    }),
    [assets],
  );

  return (
    <group>
      {/* Exterior ground */}
      <Ground />

      {/* Four floors */}
      {Array.from({ length: FLOORS }, (_, level) => (
        <FloorShell
          key={level}
          level={level}
          dimmed={selectedFloor !== "ALL" && selectedFloor !== level + 1}
        />
      ))}

      {/* Roof plant */}
      <RoofPlantShell />

      {/* Entry canopy */}
      <EntryCanopy />

      {/* Landscaping */}
      <Landscaping />

      {/* Room name labels */}
      {BUILDING_FLOORS.map((floorData) => {
        const isActive = selectedFloor === "ALL" || selectedFloor === floorData.level;
        if (!isActive) return null;
        const yPos = floorData.yBase + floorData.height - 0.6;
        return floorData.zones.map((zone) => (
          <Html
            key={`label-${zone.id}`}
            position={[zone.cx, yPos, zone.cz]}
            center
            distanceFactor={14}
            style={{ pointerEvents: "none" }}
          >
            <div
              style={{
                fontSize: 10,
                fontWeight: 600,
                color: "#5a6a7a",
                background: "rgba(240,244,248,0.8)",
                backdropFilter: "blur(6px)",
                padding: "2px 8px",
                borderRadius: 4,
                border: "1px solid rgba(150,160,170,0.25)",
                whiteSpace: "nowrap",
              }}
            >
              {zone.name}
            </div>
          </Html>
        ));
      })}

      {/* Interior partition walls */}
      {BUILDING_FLOORS.map((floorData) => {
        const isActive = selectedFloor === "ALL" || selectedFloor === floorData.level;
        if (!isActive || !floorData.rooms) return null;
        const wy1 = floorData.yBase;
        const wy2 = floorData.yBase + floorData.height;
        const segs: unknown[] = [];
        for (const room of floorData.rooms) {
          const v = room.vertices;
          for (let i = 0; i < v.length; i++) {
            const a = v[i];
            const b = v[(i + 1) % v.length];
            const mx = (a.x + b.x) / 2;
            const mz = (a.z + b.z) / 2;
            const dx = b.x - a.x;
            const dz = b.z - a.z;
            const len = Math.sqrt(dx * dx + dz * dz);
            const angle = Math.atan2(dx, dz);
            segs.push(
              <mesh
                key={`${room.id}-w${i}`}
                position={[mx, (wy1 + wy2) / 2, mz]}
                rotation={[0, angle, 0]}
              >
                <boxGeometry args={[0.1, wy2 - wy1, len]} />
                <meshStandardMaterial
                  color="#dce0e6"
                  roughness={0.6}
                  metalness={0}
                  transparent
                  opacity={0.3}
                  side={THREE.DoubleSide}
                />
              </mesh>,
            );
          }
        }
        return segs;
      })}

      {/* Assets */}
      {positionedAssets.map(({ asset, y, x, z }) => {
        const selected = asset.id === selectedAssetId;
        const statusColor = getStatusColor(asset.status);

        // Major MEP: full 3D model + click box
        if (MAJOR_MEP.has(asset.type)) {
          return (
            <group key={asset.id}>
              <mesh
                onClick={(e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); onAssetClick(asset); }}
                position={[x, y, z]}
              >
                <boxGeometry args={[2.4, 2.0, 2.4]} />
                <meshBasicMaterial transparent opacity={0} depthWrite={false} />
              </mesh>
              <EquipmentModel3D asset={{ ...asset, x, y, z } as Asset} />
              {selected && (
                <mesh position={[x, y + 1.2, z]}>
                  <sphereGeometry args={[1.6, 24, 24]} />
                  <meshBasicMaterial color={statusColor} transparent opacity={0.1} />
                </mesh>
              )}
            </group>
          );
        }

        // Ceiling fixtures: small dot + click handler
        if (CEILING_FIXTURE.has(asset.type)) {
          const dotColor =
            asset.type === "Light Fixture" || asset.type === "Lighting"
              ? "#ffeacc"
              : asset.type === "HVAC Diffuser"
              ? "#ccd8e4"
              : statusColor;
          return (
            <group key={asset.id}>
              <mesh
                onClick={(e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); onAssetClick(asset); }}
                position={[x, y, z]}
              >
                <planeGeometry args={[0.6, 0.6]} />
                <meshBasicMaterial transparent opacity={0} depthWrite={false} side={THREE.DoubleSide} />
              </mesh>
              <CeilingDot position={[x, y, z]} color={dotColor} size={asset.type === "HVAC Diffuser" ? 0.18 : 0.1} />
              {selected && (
                <mesh position={[x, y, z]}>
                  <circleGeometry args={[0.5, 16]} />
                  <meshBasicMaterial color={statusColor} transparent opacity={0.15} side={THREE.DoubleSide} depthWrite={false} />
                </mesh>
              )}
            </group>
          );
        }

        // Wall fixtures: small plate on wall
        if (WALL_FIXTURE.has(asset.type)) {
          return (
            <group key={asset.id}>
              <mesh
                onClick={(e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); onAssetClick(asset); }}
                position={[x, y, z]}
              >
                <planeGeometry args={[0.6, 0.6]} />
                <meshBasicMaterial transparent opacity={0} depthWrite={false} side={THREE.DoubleSide} />
              </mesh>
              <WallTag position={[x, y, z]} color={statusColor} />
              {selected && (
                <mesh position={[x, y, z]}>
                  <planeGeometry args={[0.5, 0.5]} />
                  <meshBasicMaterial color={statusColor} transparent opacity={0.15} side={THREE.DoubleSide} depthWrite={false} />
                </mesh>
              )}
            </group>
          );
        }

        return null;
      })}
    </group>
  );
}

/** Ground plane */
function Ground() {
  return (
    <group>
      {/* Main campus ground */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[82, 72]} />
        <meshStandardMaterial color="#c8d0d6" roughness={0.92} metalness={0.02} />
      </mesh>
      {/* Building footprint (slightly darker paved area) */}
      <mesh position={[0, -0.015, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[48, 40]} />
        <meshStandardMaterial color="#d4d8dc" roughness={0.9} />
      </mesh>
    </group>
  );
}

/** Single floor: concrete slab, glass walls, columns */
function FloorShell({ level, dimmed }: { level: number; dimmed: boolean }) {
  const y = level * FLOOR_HEIGHT;
  const slabOpacity = dimmed ? 0.04 : 0.35;
  const glassOpacity = dimmed ? 0.015 : 0.26;

  // Column positions
  const colX = [-14, -7, 0, 7, 14];
  const colZ = [-9, 9];

  return (
    <group>
      {/* Floor slab */}
      <mesh position={[0, y, 0]} receiveShadow>
        <boxGeometry args={[WIDTH + 0.6, 0.35, DEPTH + 0.6]} />
        <meshStandardMaterial color="#d0d4d8" roughness={0.8} metalness={0.02} transparent opacity={slabOpacity} envMapIntensity={1} />
      </mesh>
      {/* Floor finish line */}
      {!dimmed && (
        <mesh position={[0, y + 0.25, 0]}>
          <planeGeometry args={[WIDTH - 1, DEPTH - 1]} />
          <meshStandardMaterial color="#e0e4e8" roughness={0.85} metalness={0} transparent opacity={0.2} />
        </mesh>
      )}

      {/* Structural columns */}
      {colX.map((x) =>
        colZ.map((z) => (
          <mesh key={`col-${x}-${z}`} position={[x, y + FLOOR_HEIGHT / 2, z]} castShadow>
            <boxGeometry args={[0.35, FLOOR_HEIGHT, 0.35]} />
            <meshStandardMaterial color="#c0c8d0" roughness={0.6} metalness={0.02} />
          </mesh>
        ))
      )}

      {/* Glass curtain wall - 4 sides */}
      <GlassPanel position={[0, y + FLOOR_HEIGHT / 2, -DEPTH / 2]} size={[WIDTH - 0.6, FLOOR_HEIGHT]} opacity={glassOpacity} />
      <GlassPanel position={[0, y + FLOOR_HEIGHT / 2, DEPTH / 2]} size={[WIDTH - 0.6, FLOOR_HEIGHT]} opacity={glassOpacity} />
      <GlassPanel position={[-WIDTH / 2, y + FLOOR_HEIGHT / 2, 0]} size={[DEPTH - 0.6, FLOOR_HEIGHT]} rotationY={Math.PI / 2} opacity={glassOpacity} />
      <GlassPanel position={[WIDTH / 2, y + FLOOR_HEIGHT / 2, 0]} size={[DEPTH - 0.6, FLOOR_HEIGHT]} rotationY={Math.PI / 2} opacity={glassOpacity} />

      {/* Window mullions - vertical on front/back */}
      {[-12, -6, 0, 6, 12].map((x) => (
        <Mullion key={`fb-${x}`} position={[x, y + FLOOR_HEIGHT / 2, -DEPTH / 2 - 0.02]} height={FLOOR_HEIGHT} />
      ))}
      {[-12, -6, 0, 6, 12].map((x) => (
        <Mullion key={`fb2-${x}`} position={[x, y + FLOOR_HEIGHT / 2, DEPTH / 2 + 0.02]} height={FLOOR_HEIGHT} />
      ))}
    </group>
  );
}

/** Glass panel with silver trim */
function GlassPanel({ position, size, opacity, rotationY = 0 }: {
  position: [number, number, number];
  size: [number, number];
  opacity: number;
  rotationY?: number;
}) {
  return (
    <mesh position={position} rotation={[0, rotationY, 0]}>
      <planeGeometry args={size} />
      <meshPhysicalMaterial envMapIntensity={2}
        color="#cce5f2"
        transparent
        opacity={opacity}
        roughness={0.06}
        metalness={0.1}
        transmission={0.82}
        ior={1.52}
        thickness={0.3}
        clearcoat={0.9}
        clearcoatRoughness={0.08}
        side={THREE.DoubleSide}
        depthWrite={false}
      />
    </mesh>
  );
}

/** Vertical mullion frame */
function Mullion({ position, height }: { position: [number, number, number]; height: number }) {
  return (
    <mesh position={position} castShadow>
      <boxGeometry args={[0.08, height, 0.08]} />
      <meshPhysicalMaterial envMapIntensity={2} color="#a8b8c8" metalness={0.55} roughness={0.3} clearcoat={0.12} />
    </mesh>
  );
}

/** Roof plant mechanical deck */
function RoofPlantShell() {
  const roof = FLOOR_HEIGHT * FLOORS;
  return (
    <group position={[0, roof, 0]}>
      {/* Roof slab */}
      <mesh position={[0, 0.35, 0]} castShadow>
        <boxGeometry args={[WIDTH + 0.6, 0.35, DEPTH + 0.6]} />
        <meshStandardMaterial color="#c8d0d8" metalness={0.2} roughness={0.5} />
      </mesh>
      {/* Mechanical enclosures */}
      <mesh position={[-6, 1.2, 2]} castShadow>
        <boxGeometry args={[4, 1.8, 3.5]} />
        <meshStandardMaterial color="#d0d8e0" metalness={0.4} roughness={0.35} />
      </mesh>
      <mesh position={[7, 1.2, -1]} castShadow>
        <boxGeometry args={[5, 1.8, 4]} />
        <meshStandardMaterial color="#d0d8e0" metalness={0.4} roughness={0.35} />
      </mesh>
      {/* Tiny equipment silhouettes on roof */}
      {[[0, 1.6, -6], [2, 1.3, 4], [-4, 1.1, -3], [6, 1.4, 5]].map(([x, h, z], i) => (
        <mesh key={i} position={[x, h + 0.5, z]} castShadow>
          <boxGeometry args={[0.8, h, 0.8]} />
          <meshStandardMaterial color="#a8b8c8" metalness={0.5} roughness={0.4} />
        </mesh>
      ))}
    </group>
  );
}

/** Entrance canopy - south side */
function EntryCanopy() {
  return (
    <group position={[0, 0, -DEPTH / 2 - 2.8]}>
      {/* Canopy roof */}
      <mesh position={[0, 2.4, 0]} castShadow>
        <boxGeometry args={[16, 0.15, 5]} />
        <meshStandardMaterial color="#c8d0d8" metalness={0.3} roughness={0.4} />
      </mesh>
      {/* Columns */}
      {[-7, 7].map((x) => (
        <mesh key={x} position={[x, 1.2, 1.5]}>
          <cylinderGeometry args={[0.18, 0.22, 2.4, 10]} />
          <meshStandardMaterial color="#a0b0c0" metalness={0.6} roughness={0.3} />
        </mesh>
      ))}
      {/* Glass panel */}
      <mesh position={[0, 1.2, 0.3]}>
        <planeGeometry args={[12, 2]} />
        <meshPhysicalMaterial envMapIntensity={2} color="#cce5f2" transparent opacity={0.4} transmission={0.7} roughness={0.05} metalness={0.1} ior={1.5} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

/** Simple landscaping */
function Landscaping() {
  const trees: [number, number][] = [
    [-22, -14], [-19, -14], [20, -13], [23, -10],
    [-22, 14], [22, 14], [-15, 18], [15, 18],
  ];
  return (
    <group>
      {/* Grass strips left/right */}
      <mesh position={[-24, 0.01, -5]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[10, 32]} />
        <meshStandardMaterial color="#6a9e70" roughness={0.95} />
      </mesh>
      <mesh position={[24, 0.01, -5]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[10, 32]} />
        <meshStandardMaterial color="#6a9e70" roughness={0.95} />
      </mesh>
      {/* Trees */}
      {trees.map(([x, z]) => (
        <group key={`t-${x}-${z}`} position={[x, 0, z]}>
          <mesh position={[0, 1.0, 0]}>
            <cylinderGeometry args={[0.1, 0.15, 2, 8]} />
            <meshStandardMaterial color="#7a6a58" />
          </mesh>
          <mesh position={[0, 2.6, 0]} castShadow>
            <sphereGeometry args={[1.3, 10, 10]} />
            <meshStandardMaterial color="#5a9060" roughness={0.95} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
