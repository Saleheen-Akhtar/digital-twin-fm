"use client";

/**
 * Digital Twin FM — 3D Asset Markers (R3F)
 *
 * Clean, compact markers placed at exact asset coordinates.
 * Each marker is a small colored sphere with a floating name badge.
 * Positioned using the asset's floor yBase so they sit INSIDE the building.
 */

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import type { Asset } from "./viewer-data";
import { BUILDING_FLOORS, FLOOR_H } from "./building-floors";
import { useViewerStore } from "./viewer-store";
import { EquipmentModel3D } from "./equipment-models-3d";

const STATUS_COLORS: Record<string, string> = {
  ok: "#22c55e",
  info: "#3b82f6",
  warning: "#f59e0b",
  critical: "#ef4444",
  offline: "#94a3b8",
};

import {
  Wind,
  Snowflake,
  Flame,
  Droplets,
  Fan,
  ArrowUpDown,
  Lightbulb,
  Activity,
  Settings
} from "lucide-react";

import type { LucideIcon } from "lucide-react";

const TYPE_ICONS: Record<string, LucideIcon> = {
  "Air Handler": Wind,
  Chiller: Snowflake,
  Boiler: Flame,
  Pump: Droplets,
  Fan: Fan,
  Elevator: ArrowUpDown,
  Lighting: Lightbulb,
  Sensor: Activity,
  Equipment: Settings,
};

// ─── Pulsing Ground Ring ────────────────────────────────────────────

function StatusRing({ color, status }: { color: string; status: string }) {
  const ref = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.MeshBasicMaterial>(null);

  useFrame((state) => {
    if (!ref.current || !materialRef.current) return;
    const t = state.clock.getElapsedTime();
    
    let scale = 1;
    let opacity = 0.35;

    if (status === "critical") {
      // Rapid blink
      scale = 1 + Math.sin(t * 10) * 0.1;
      opacity = (Math.sin(t * 15) > 0) ? 0.8 : 0.2;
    } else if (status === "warning") {
      // Fast pulse
      scale = 1 + Math.sin(t * 5) * 0.2;
      opacity = 0.5 + Math.sin(t * 5) * 0.3;
    } else if (status === "ok") {
      // Slow soft pulse
      scale = 1 + Math.sin(t * 1.5) * 0.05;
      opacity = 0.25 + Math.sin(t * 1.5) * 0.1;
    } else {
      // Offline / info - static
      opacity = 0.2;
    }

    ref.current.scale.setScalar(scale);
    materialRef.current.opacity = opacity;
  });

  return (
    <mesh ref={ref} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
      <ringGeometry args={[0.3, 0.45, 32]} />
      <meshBasicMaterial ref={materialRef} color={color} transparent depthWrite={false} />
    </mesh>
  );
}

// ─── Floating Name Badge ────────────────────────────────────────────

function NameBadge({ asset, showDetails }: { asset: Asset; showDetails: boolean }) {
  const color = STATUS_COLORS[asset.status] ?? STATUS_COLORS.ok;
  const Icon = TYPE_ICONS[asset.type] ?? Settings;
  const primaryMetric = Object.entries(asset.metrics)[0];

  return (
    <Html position={[0, 1.8, 0]} center distanceFactor={12} style={{ pointerEvents: "none" }}>
      <div style={{
        background: "rgba(255,255,255,0.92)",
        backdropFilter: "blur(8px)",
        border: `1.5px solid ${color}`,
        borderRadius: "8px",
        padding: "3px 8px",
        display: "flex",
        alignItems: "center",
        gap: "6px",
        boxShadow: `0 2px 8px rgba(0,0,0,0.12)`,
        whiteSpace: "nowrap",
        userSelect: "none",
        maxWidth: "200px",
      }}>
        <Icon size={14} style={{ color: color, flexShrink: 0 }} />
        {showDetails && (
          <>
            <span style={{ fontSize: "11px", fontWeight: 600, color: "#1e293b", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "80px" }}>
              {asset.name}
            </span>
            {primaryMetric && (
              <span style={{
                fontSize: "10px", fontWeight: 700, color,
                fontFamily: "monospace",
                background: `${color}15`,
                padding: "1px 4px",
                borderRadius: "3px",
                overflow: "hidden", textOverflow: "ellipsis", maxWidth: "70px"
              }}>
                {primaryMetric[1]}
              </span>
            )}
          </>
        )}
      </div>
    </Html>
  );
}

// ─── Main Asset Marker ──────────────────────────────────────────────

interface AssetMarker3DProps {
  asset: Asset;
  selected?: boolean;
  onClick?: () => void;
}

export function AssetMarker3D({ asset, selected = false, onClick }: AssetMarker3DProps) {
  const hoveredAsset = useViewerStore((s) => s.hoveredAsset);
  const selectedAsset = useViewerStore((s) => s.selectedAsset);
  const setHoveredAsset = useViewerStore((s) => s.setHoveredAsset);
  const selectedFloor = useViewerStore((s) => s.selectedFloor);

  const isSelected = selected || selectedAsset?.id === asset.id;
  const isHovered = hoveredAsset?.id === asset.id;
  
  const hasSelection = !!selectedAsset;
  const hasHover = !!hoveredAsset;

  const color = STATUS_COLORS[asset.status] ?? STATUS_COLORS.ok;
  const isAlert = asset.status === "critical" || asset.status === "warning";

  // Aggressive decluttering: Fade healthy assets when viewing the whole building (unless hovered/selected)
  const isGloballyFaded = selectedFloor === "ALL" && !isAlert && !isSelected && !isHovered;
  
  // Fade out if something else is selected/hovered, or if it's a healthy asset in global view
  const isFaded = isGloballyFaded || (hasSelection && !isSelected) || (!hasSelection && hasHover && !isHovered);
  
  // Scale down less important markers slightly so they don't dominate
  const scale = isFaded ? 0.7 : (isSelected ? 1.3 : 1.0);

  // Calculate Y position based on which floor the asset is on
  const floorDef = BUILDING_FLOORS.find((f) => f.level === asset.floor + 1);
  const yBase = floorDef ? floorDef.yBase : 0;
  // Ensure the model sits flush on the floor by not adding a floating offset.
  // The database seed provides asset.y, but if missing we fallback to yBase.
  const y = asset.y ?? yBase;

  return (
    <group
      position={[asset.x, y, asset.z]}
      scale={[scale, scale, scale]}
      onClick={(e) => { e.stopPropagation(); onClick?.(); }}
      onPointerOver={(e) => { e.stopPropagation(); setHoveredAsset(asset); document.body.style.cursor = 'pointer'; }}
      onPointerOut={(e) => { e.stopPropagation(); setHoveredAsset(null); document.body.style.cursor = 'auto'; }}
    >
      {/* Realistic 3D Equipment Model */}
      <EquipmentModel3D asset={asset} />

      {/* Floating status sphere above the model */}
      <mesh position={[0, 1.5, 0]} castShadow>
        <sphereGeometry args={[0.15, 16, 16]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={isAlert ? (isHovered ? 0.8 : 0.5) : (isHovered ? 0.4 : 0.2)}
          roughness={0.3}
          metalness={0.4}
          transparent
          opacity={isFaded ? 0.2 : 0.8}
        />
      </mesh>

      {/* Pulsing ground ring */}
      {!isFaded && <StatusRing color={color} status={asset.status} />}

      {/* Floating name badge (only render if not faded) */}
      {!isFaded && (
        <group>
          <NameBadge asset={asset} showDetails={isHovered || isSelected} />
        </group>
      )}

      {/* Selection highlight beam */}
      {selected && (
        <mesh position={[0, 2.5, 0]}>
          <cylinderGeometry args={[0.02, 0.06, 4, 8, 1, true]} />
          <meshBasicMaterial color="#3b82f6" transparent opacity={0.3} depthWrite={false} side={THREE.DoubleSide} />
        </mesh>
      )}
    </group>
  );
}
