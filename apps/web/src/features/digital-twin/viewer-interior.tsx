"use client";

import { useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

// ─── Blinking LED Component ────────────────────────────────────────

interface BlinkingLedProps {
  position: [number, number, number];
  color: string;
  speed?: number;
  offset?: number;
}

function BlinkingLed({ position, color, speed = 2.0, offset = 0 }: BlinkingLedProps) {
  const matRef = useRef<THREE.MeshBasicMaterial>(null);

  useFrame((state) => {
    if (matRef.current) {
      const t = state.clock.getElapsedTime();
      const intensity = Math.sin(t * speed + offset) > 0.1 ? 1 : 0.1;
      matRef.current.opacity = intensity;
    }
  });

  return (
    <mesh position={position}>
      <sphereGeometry args={[0.03, 8, 8]} />
      <meshBasicMaterial ref={matRef} color={color} transparent opacity={1} />
    </mesh>
  );
}

// ─── Furniture Components ──────────────────────────────────────────

// Stylized Office Desk + Monitor + Chair
export function OfficeDesk({ position, rotation }: { position: [number, number, number]; rotation?: [number, number, number] }) {
  return (
    <group position={position} rotation={rotation}>
      {/* Desk Top */}
      <mesh position={[0, 0.75, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.5, 0.05, 0.8]} />
        <meshStandardMaterial color="#d97706" roughness={0.4} metalness={0.1} /> {/* warm wood */}
      </mesh>
      {/* Desk Legs */}
      {[
        [-0.7, 0.35, -0.35],
        [-0.7, 0.35, 0.35],
        [0.7, 0.35, -0.35],
        [0.7, 0.35, 0.35],
      ].map((pos, i) => (
        <mesh key={i} position={pos as [number, number, number]} castShadow>
          <cylinderGeometry args={[0.03, 0.03, 0.7, 8]} />
          <meshStandardMaterial color="#334155" roughness={0.5} metalness={0.5} />
        </mesh>
      ))}
      {/* Computer Monitor */}
      <group position={[0, 0.77, -0.15]}>
        {/* Stand */}
        <mesh position={[0, 0.1, 0]} castShadow>
          <cylinderGeometry args={[0.015, 0.02, 0.2, 8]} />
          <meshStandardMaterial color="#1e293b" roughness={0.3} metalness={0.7} />
        </mesh>
        {/* Screen */}
        <mesh position={[0, 0.3, 0]} castShadow>
          <boxGeometry args={[0.6, 0.35, 0.03]} />
          <meshStandardMaterial color="#0f172a" roughness={0.3} metalness={0.8} />
        </mesh>
        {/* Glowing screen face */}
        <mesh position={[0, 0.3, 0.016]}>
          <planeGeometry args={[0.57, 0.32]} />
          <meshBasicMaterial color="#38bdf8" toneMapped={false} />
        </mesh>
      </group>
      {/* Keyboard */}
      <mesh position={[0, 0.78, 0.15]} castShadow>
        <boxGeometry args={[0.35, 0.01, 0.12]} />
        <meshStandardMaterial color="#cbd5e1" roughness={0.7} />
      </mesh>
      {/* Office Chair */}
      <group position={[0, 0, 0.6]} rotation={[0, Math.PI, 0]}>
        {/* Base Stem */}
        <mesh position={[0, 0.25, 0]} castShadow>
          <cylinderGeometry args={[0.03, 0.03, 0.5, 8]} />
          <meshStandardMaterial color="#1e293b" roughness={0.4} metalness={0.8} />
        </mesh>
        {/* Base wheels structure */}
        <mesh position={[0, 0.05, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.3, 0.3, 0.03, 5]} />
          <meshStandardMaterial color="#0f172a" roughness={0.5} />
        </mesh>
        {/* Seat */}
        <mesh position={[0, 0.52, 0]} castShadow>
          <boxGeometry args={[0.45, 0.05, 0.45]} />
          <meshStandardMaterial color="#334155" roughness={0.6} />
        </mesh>
        {/* Backrest */}
        <mesh position={[0, 0.85, -0.2]} castShadow>
          <boxGeometry args={[0.4, 0.5, 0.05]} />
          <meshStandardMaterial color="#334155" roughness={0.6} />
        </mesh>
        {/* Armrests */}
        {[-0.23, 0.23].map((x, i) => (
          <mesh key={i} position={[x, 0.65, 0]} castShadow>
            <boxGeometry args={[0.04, 0.2, 0.35]} />
            <meshStandardMaterial color="#1e293b" roughness={0.5} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

// Stylized Boardroom Conference Table
export function ConferenceTable({ position, rotation }: { position: [number, number, number]; rotation?: [number, number, number] }) {
  return (
    <group position={position} rotation={rotation}>
      {/* Table Top */}
      <mesh position={[0, 0.75, 0]} castShadow receiveShadow>
        <boxGeometry args={[4.0, 0.06, 1.6]} />
        <meshStandardMaterial color="#78350f" roughness={0.2} metalness={0.1} /> {/* polished dark mahogany */}
      </mesh>
      {/* Base Pedestals */}
      {[-1.2, 1.2].map((x) => (
        <mesh key={x} position={[x, 0.37, 0]} castShadow>
          <cylinderGeometry args={[0.2, 0.3, 0.74, 12]} />
          <meshStandardMaterial color="#1e293b" roughness={0.3} metalness={0.7} />
        </mesh>
      ))}
      {/* Table Center Tech Panel */}
      <mesh position={[0, 0.785, 0]}>
        <boxGeometry args={[1.2, 0.01, 0.25]} />
        <meshStandardMaterial color="#0f172a" roughness={0.2} metalness={0.9} />
      </mesh>
      {/* Surround Conference Chairs */}
      {[
        [-1.3, 0, -0.9, 0],
        [0, 0, -0.9, 0],
        [1.3, 0, -0.9, 0],
        [-1.3, 0, 0.9, Math.PI],
        [0, 0, 0.9, Math.PI],
        [1.3, 0, 0.9, Math.PI],
        [-2.2, 0, 0, Math.PI / 2],
        [2.2, 0, 0, -Math.PI / 2],
      ].map((c, i) => (
        <group key={i} position={[c[0], c[1], c[2]] as [number, number, number]} rotation={[0, c[3], 0]}>
          <mesh position={[0, 0.22, 0]}>
            <cylinderGeometry args={[0.04, 0.04, 0.44, 8]} />
            <meshStandardMaterial color="#1e293b" metalness={0.8} />
          </mesh>
          <mesh position={[0, 0.46, 0]} castShadow>
            <boxGeometry args={[0.48, 0.06, 0.48]} />
            <meshStandardMaterial color="#1e293b" roughness={0.5} />
          </mesh>
          <mesh position={[0, 0.85, -0.22]} castShadow>
            <boxGeometry args={[0.45, 0.6, 0.06]} />
            <meshStandardMaterial color="#1e293b" roughness={0.5} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

// Server Rack with Blinking LEDs
export function ServerRack({ position, rotation }: { position: [number, number, number]; rotation?: [number, number, number] }) {
  const colors = ["#22c55e", "#ef4444", "#eab308"]; // green, red, yellow

  return (
    <group position={position} rotation={rotation}>
      {/* Metal Cabinet */}
      <mesh position={[0, 1.1, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.0, 2.2, 1.0]} />
        <meshStandardMaterial color="#0f172a" roughness={0.5} metalness={0.8} />
      </mesh>
      {/* Front glass door frame */}
      <mesh position={[0, 1.1, 0.505]}>
        <boxGeometry args={[0.9, 2.0, 0.02]} />
        <meshStandardMaterial color="#334155" roughness={0.2} metalness={0.9} />
      </mesh>
      {/* Front glass panel */}
      <mesh position={[0, 1.1, 0.51]}>
        <boxGeometry args={[0.8, 1.9, 0.01]} />
        <meshPhysicalMaterial color="#3b82f6" transparent opacity={0.3} transmission={0.7} roughness={0.1} />
      </mesh>
      {/* Server Slots / Shelves */}
      {Array.from({ length: 8 }).map((_, i) => {
        const y = 0.25 + i * 0.24;
        return (
          <group key={i}>
            {/* Shelf metal plate */}
            <mesh position={[0, y, 0.48]}>
              <boxGeometry args={[0.84, 0.04, 0.05]} />
              <meshStandardMaterial color="#1e293b" roughness={0.6} />
            </mesh>
            {/* Status LEDs */}
            {Array.from({ length: 4 }).map((_, j) => {
              const x = -0.32 + j * 0.21;
              const ledColor = colors[(i + j) % 3];
              const blinkSpeed = 1.5 + (i * 0.2) + (j * 0.3);
              const blinkOffset = (i * 0.5) + (j * 0.2);
              return (
                <BlinkingLed
                  key={j}
                  position={[x, y + 0.04, 0.495]}
                  color={ledColor}
                  speed={blinkSpeed}
                  offset={blinkOffset}
                />
              );
            })}
          </group>
        );
      })}
    </group>
  );
}

// Lounge Area Couch/Sofa
export function LoungeSofa({ position, rotation }: { position: [number, number, number]; rotation?: [number, number, number] }) {
  return (
    <group position={position} rotation={rotation}>
      {/* Base frame */}
      <mesh position={[0, 0.15, 0]} castShadow receiveShadow>
        <boxGeometry args={[2.2, 0.1, 0.9]} />
        <meshStandardMaterial color="#1e293b" roughness={0.8} />
      </mesh>
      {/* Seat Cushion */}
      <mesh position={[0, 0.35, 0.05]} castShadow receiveShadow>
        <boxGeometry args={[2.0, 0.3, 0.7]} />
        <meshStandardMaterial color="#3b82f6" roughness={0.85} /> {/* blue fabric */}
      </mesh>
      {/* Backrest */}
      <mesh position={[0, 0.65, -0.35]} castShadow>
        <boxGeometry args={[2.2, 0.6, 0.2]} />
        <meshStandardMaterial color="#3b82f6" roughness={0.85} />
      </mesh>
      {/* Armrests */}
      {[-1.05, 1.05].map((x) => (
        <mesh key={x} position={[x, 0.45, 0.05]} castShadow>
          <boxGeometry args={[0.15, 0.5, 0.8]} />
          <meshStandardMaterial color="#3b82f6" roughness={0.85} />
        </mesh>
      ))}
      {/* Coffee Table */}
      <group position={[0, 0, 0.95]}>
        <mesh position={[0, 0.2, 0]} castShadow>
          <cylinderGeometry args={[0.45, 0.45, 0.03, 16]} />
          <meshPhysicalMaterial color="#94a3b8" transparent opacity={0.4} transmission={0.9} roughness={0.1} />
        </mesh>
        <mesh position={[0, 0.09, 0]}>
          <cylinderGeometry args={[0.05, 0.05, 0.18, 8]} />
          <meshStandardMaterial color="#1e293b" metalness={0.7} />
        </mesh>
        <mesh position={[0, 0.01, 0]}>
          <cylinderGeometry args={[0.3, 0.3, 0.02, 12]} />
          <meshStandardMaterial color="#1e293b" metalness={0.7} />
        </mesh>
      </group>
    </group>
  );
}

// Reception Desk for Lobby
export function ReceptionDesk({ position, rotation }: { position: [number, number, number]; rotation?: [number, number, number] }) {
  return (
    <group position={position} rotation={rotation}>
      {/* Front shield panel (glowing logo block) */}
      <mesh position={[0, 0.6, 0]} castShadow receiveShadow>
        <boxGeometry args={[2.5, 1.2, 0.15]} />
        <meshStandardMaterial color="#cbd5e1" roughness={0.2} metalness={0.2} />
      </mesh>
      {/* Decorative wood trim */}
      <mesh position={[0, 1.15, 0.03]}>
        <boxGeometry args={[2.6, 0.1, 0.2]} />
        <meshStandardMaterial color="#b45309" roughness={0.3} />
      </mesh>
      {/* Desk counter plate behind */}
      <mesh position={[0, 0.75, -0.3]} castShadow receiveShadow>
        <boxGeometry args={[2.2, 0.04, 0.6]} />
        <meshStandardMaterial color="#1e293b" roughness={0.5} />
      </mesh>
      {/* Modern stool behind desk */}
      <group position={[0, 0, -0.45]}>
        <mesh position={[0, 0.25, 0]}>
          <cylinderGeometry args={[0.02, 0.02, 0.5, 8]} />
          <meshStandardMaterial color="#475569" metalness={0.8} />
        </mesh>
        <mesh position={[0, 0.5, 0]}>
          <cylinderGeometry args={[0.2, 0.2, 0.04, 10]} />
          <meshStandardMaterial color="#0f172a" roughness={0.6} />
        </mesh>
      </group>
    </group>
  );
}

// Storage wooden crate
export function StorageCrate({ position, rotation }: { position: [number, number, number]; rotation?: [number, number, number] }) {
  return (
    <group position={position} rotation={rotation}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[1.0, 1.0, 1.0]} />
        <meshStandardMaterial color="#d97706" roughness={0.8} />
      </mesh>
      {/* Crate cross braces */}
      {[-0.51, 0.51].map((z, i) => (
        <group key={i} position={[0, 0, z]}>
          <mesh position={[0, 0.4, 0]}>
            <boxGeometry args={[0.9, 0.1, 0.02]} />
            <meshStandardMaterial color="#b45309" roughness={0.8} />
          </mesh>
          <mesh position={[0, -0.4, 0]}>
            <boxGeometry args={[0.9, 0.1, 0.02]} />
            <meshStandardMaterial color="#b45309" roughness={0.8} />
          </mesh>
          <mesh position={[0.4, 0, 0]}>
            <boxGeometry args={[0.1, 0.9, 0.02]} />
            <meshStandardMaterial color="#b45309" roughness={0.8} />
          </mesh>
          <mesh position={[-0.4, 0, 0]}>
            <boxGeometry args={[0.1, 0.9, 0.02]} />
            <meshStandardMaterial color="#b45309" roughness={0.8} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

// ─── MEP (Mechanical, Electrical, Piping) Systems ─────────────────

// Render stylized ceiling HVAC ducts and plumbing pipes
export function MepSystems({ width, depth, yBase, height }: { width: number; depth: number; yBase: number; height: number }) {
  const ductY = yBase + height - 0.9;
  const pipeY = yBase + height - 0.7;

  return (
    <group>
      {/* HVAC Duct network (metallic silver box channels) */}
      {/* Main Longitudinal trunk */}
      <mesh position={[0, ductY, -2]} castShadow>
        <boxGeometry args={[width - 4, 0.35, 0.45]} />
        <meshStandardMaterial color="#94a3b8" roughness={0.15} metalness={0.85} />
      </mesh>
      {/* Transverse branch ducts */}
      {[-10, 0, 10].map((x) => (
        <mesh key={x} position={[x, ductY, 1]} castShadow>
          <boxGeometry args={[0.3, 0.25, 6]} />
          <meshStandardMaterial color="#94a3b8" roughness={0.15} metalness={0.85} />
        </mesh>
      ))}

      {/* Pipes (Red = Fire, Blue = Chilled Water, Green = Drainage) */}
      {/* Longitudinal pipes */}
      <mesh position={[0, pipeY, -3]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.04, 0.04, width - 6, 8]} />
        <meshStandardMaterial color="#dc2626" roughness={0.2} metalness={0.6} /> {/* Red fire pipe */}
      </mesh>
      <mesh position={[1, pipeY + 0.1, -3.1]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.06, 0.06, width - 6, 8]} />
        <meshStandardMaterial color="#2563eb" roughness={0.2} metalness={0.6} /> {/* Blue cooling water pipe */}
      </mesh>
      <mesh position={[-1, pipeY - 0.05, -3.1]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.05, 0.05, width - 6, 8]} />
        <meshStandardMaterial color="#16a34a" roughness={0.3} metalness={0.5} /> {/* Green drainage pipe */}
      </mesh>

      {/* Transverse drop pipes */}
      {[-12, 12].map((x) => (
        <group key={x}>
          <mesh position={[x, pipeY - 0.1, -1]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.04, 0.04, 4.0, 8]} />
            <meshStandardMaterial color="#dc2626" roughness={0.2} metalness={0.6} />
          </mesh>
          <mesh position={[x + 0.1, pipeY, -1]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.05, 0.05, 4.0, 8]} />
            <meshStandardMaterial color="#2563eb" roughness={0.2} metalness={0.6} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

// ─── Partition Walls ────────────────────────────────────────────────

function RoomWall({ position, rotation, length, height = 3.5, thickness = 0.08 }: {
  position: [number, number, number];
  rotation?: [number, number, number];
  length: number;
  height?: number;
  thickness?: number;
}) {
  return (
    <mesh position={position} rotation={rotation} castShadow receiveShadow>
      <boxGeometry args={[length, height, thickness]} />
      <meshStandardMaterial color="#f1f5f9" roughness={0.9} /> {/* clean drywall white/gray */}
    </mesh>
  );
}

// ─── Room Interior Coordinator ─────────────────────────────────────

interface RoomInteriorProps {
  floorLevel: number;
  zoneId: string;
  cx: number;
  cz: number;
  w: number;
  d: number;
  floorY: number;
  floorHeight: number;
  showFurniture: boolean;
  showMEP: boolean;
  showFacade: boolean;
}

export function RoomInterior({
  floorLevel,
  zoneId,
  cx,
  cz,
  w,
  d,
  floorY,
  floorHeight,
  showFurniture,
  showMEP,
  showFacade,
}: RoomInteriorProps) {
  const wallH = 3.5;
  const yWall = floorY + wallH / 2;

  return (
    <group>
      {/* ── 1. Partition Walls (always rendered if interior walls are shown) ── */}
      {/* Render walls with gap openings for doors */}
      {showFacade && (
        <group>
          {/* North Wall (Back) with center opening */}
          <RoomWall position={[cx - w / 4, yWall, cz - d / 2]} length={w / 2 - 0.6} />
          <RoomWall position={[cx + w / 4, yWall, cz - d / 2]} length={w / 2 - 0.6} />

          {/* South Wall (Front) with center opening */}
          <RoomWall position={[cx - w / 4, yWall, cz + d / 2]} length={w / 2 - 0.6} />
          <RoomWall position={[cx + w / 4, yWall, cz + d / 2]} length={w / 2 - 0.6} />

          {/* West Wall (Left) */}
          <RoomWall position={[cx - w / 2, yWall, cz]} rotation={[0, Math.PI / 2, 0]} length={d} />

          {/* East Wall (Right) */}
          <RoomWall position={[cx + w / 2, yWall, cz]} rotation={[0, Math.PI / 2, 0]} length={d} />
        </group>
      )}

      {/* ── 2. MEP System (Ducts & Pipes) ── */}
      {showMEP && (
        <MepSystems width={w} depth={d} yBase={floorY} height={floorHeight} />
      )}

      {/* ── 3. Furniture population based on Room Type ── */}
      {showFurniture && (
        <group>
          {/* Basement Rooms */}
          {zoneId === "b1" && ( // Loading dock: storage crates, industrial boxes
            <group>
              <StorageCrate position={[cx - 2.5, floorY + 0.5, cz - 1.5]} />
              <StorageCrate position={[cx - 2.5, floorY + 0.5, cz + 1.5]} rotation={[0, 0.4, 0]} />
              <StorageCrate position={[cx - 2.5, floorY + 1.5, cz - 0.5]} rotation={[0, -0.2, 0]} />
              <StorageCrate position={[cx + 2.0, floorY + 0.5, cz + 1.0]} rotation={[0, 1.1, 0]} />
            </group>
          )}

          {zoneId === "b2" && ( // Plant room: mechanical server racks
            <group>
              <ServerRack position={[cx - 1.8, floorY, cz - 1.5]} />
              <ServerRack position={[cx - 0.6, floorY, cz - 1.5]} />
              <ServerRack position={[cx + 0.6, floorY, cz - 1.5]} />
              <ServerRack position={[cx + 1.8, floorY, cz - 1.5]} />
              <ServerRack position={[cx - 1.2, floorY, cz + 1.5]} rotation={[0, Math.PI, 0]} />
              <ServerRack position={[cx + 1.2, floorY, cz + 1.5]} rotation={[0, Math.PI, 0]} />
            </group>
          )}

          {zoneId === "b3" && ( // Storage: wooden crates
            <group>
              <StorageCrate position={[cx - 2, floorY + 0.5, cz - 2]} />
              <StorageCrate position={[cx - 2, floorY + 0.5, cz]} />
              <StorageCrate position={[cx - 2, floorY + 0.5, cz + 2]} />
              <StorageCrate position={[cx + 2, floorY + 0.5, cz - 1]} rotation={[0, 0.2, 0]} />
              <StorageCrate position={[cx + 2, floorY + 0.5, cz + 1]} rotation={[0, -0.5, 0]} />
              <StorageCrate position={[cx + 2, floorY + 1.5, cz]} rotation={[0, 0.1, 0]} />
            </group>
          )}

          {zoneId === "b5" && ( // MEP Room: servers and boilers
            <group>
              <ServerRack position={[cx - 1.5, floorY, cz]} />
              <ServerRack position={[cx + 1.5, floorY, cz]} />
            </group>
          )}

          {/* Level 1 Rooms */}
          {zoneId === "1a" && ( // Main Entrance: Lobby reception and waiting couch
            <group>
              <ReceptionDesk position={[cx, floorY, cz - 1.0]} />
              <LoungeSofa position={[cx - 4.5, floorY, cz + 1.0]} />
              <LoungeSofa position={[cx + 4.5, floorY, cz + 1.0]} />
            </group>
          )}

          {(zoneId === "1b" || zoneId === "1c") && ( // Exhibition Halls: Large Cubicle layouts
            <group>
              {/* Row 1 */}
              <OfficeDesk position={[cx - 3.2, floorY, cz - 2.5]} />
              <OfficeDesk position={[cx, floorY, cz - 2.5]} />
              <OfficeDesk position={[cx + 3.2, floorY, cz - 2.5]} />

              {/* Row 2 */}
              <OfficeDesk position={[cx - 3.2, floorY, cz + 2.5]} rotation={[0, Math.PI, 0]} />
              <OfficeDesk position={[cx, floorY, cz + 2.5]} rotation={[0, Math.PI, 0]} />
              <OfficeDesk position={[cx + 3.2, floorY, cz + 2.5]} rotation={[0, Math.PI, 0]} />
            </group>
          )}

          {zoneId === "1f" && ( // Meeting Rooms: Boardroom table
            <group>
              <ConferenceTable position={[cx, floorY, cz]} />
            </group>
          )}

          {/* Level 2 Rooms */}
          {zoneId === "2a" && ( // Hall B West: Executive cubicles
            <group>
              <OfficeDesk position={[cx - 3.0, floorY, cz - 3.0]} />
              <OfficeDesk position={[cx + 3.0, floorY, cz - 3.0]} />
              <OfficeDesk position={[cx - 3.0, floorY, cz + 3.0]} rotation={[0, Math.PI, 0]} />
              <OfficeDesk position={[cx + 3.0, floorY, cz + 3.0]} rotation={[0, Math.PI, 0]} />
            </group>
          )}

          {zoneId === "2b" && ( // Hall B East: High Tech Server Room IT Hub
            <group>
              <ServerRack position={[cx - 3.5, floorY, cz - 3.5]} />
              <ServerRack position={[cx - 2.0, floorY, cz - 3.5]} />
              <ServerRack position={[cx - 0.5, floorY, cz - 3.5]} />
              <ServerRack position={[cx + 1.0, floorY, cz - 3.5]} />
              <ServerRack position={[cx + 2.5, floorY, cz - 3.5]} />

              <ServerRack position={[cx - 3.5, floorY, cz + 3.5]} rotation={[0, Math.PI, 0]} />
              <ServerRack position={[cx - 2.0, floorY, cz + 3.5]} rotation={[0, Math.PI, 0]} />
              <ServerRack position={[cx - 0.5, floorY, cz + 3.5]} rotation={[0, Math.PI, 0]} />
              <ServerRack position={[cx + 1.0, floorY, cz + 3.5]} rotation={[0, Math.PI, 0]} />
              <ServerRack position={[cx + 2.5, floorY, cz + 3.5]} rotation={[0, Math.PI, 0]} />
            </group>
          )}

          {zoneId === "2c" && ( // VIP Lounge: Couches
            <group>
              <LoungeSofa position={[cx - 2.2, floorY, cz]} />
              <LoungeSofa position={[cx + 2.2, floorY, cz]} rotation={[0, Math.PI, 0]} />
            </group>
          )}

          {zoneId === "2d" && ( // Terrace: Café tables
            <group>
              {[-5, 0, 5].map((x) => (
                <group key={x} position={[cx + x, floorY, cz]}>
                  {/* Café table */}
                  <mesh position={[0, 0.5, 0]} castShadow>
                    <cylinderGeometry args={[0.35, 0.35, 0.02, 10]} />
                    <meshStandardMaterial color="#cbd5e1" roughness={0.3} metalness={0.6} />
                  </mesh>
                  <mesh position={[0, 0.25, 0]}>
                    <cylinderGeometry args={[0.02, 0.02, 0.5, 8]} />
                    <meshStandardMaterial color="#475569" metalness={0.7} />
                  </mesh>
                  {/* Stools */}
                  {[-0.5, 0.5].map((sx, idx) => (
                    <mesh key={idx} position={[sx, 0.35, 0]} castShadow>
                      <cylinderGeometry args={[0.15, 0.15, 0.02, 8]} />
                      <meshStandardMaterial color="#1e293b" roughness={0.6} />
                    </mesh>
                  ))}
                </group>
              ))}
            </group>
          )}

          {zoneId === "2e" && ( // Control Room: desk consoles
            <group>
              <OfficeDesk position={[cx - 1.2, floorY, cz]} />
              <OfficeDesk position={[cx + 1.2, floorY, cz]} />
            </group>
          )}
        </group>
      )}
    </group>
  );
}

export function createConcreteTexture() {
  if (typeof window === "undefined") return null;
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  // Fill base light grey
  ctx.fillStyle = "#e2e8f0";
  ctx.fillRect(0, 0, size, size);

  // Add random noise/grain.
  // In jsdom (unit tests), getImageData returns an object whose `data`
  // field is undefined because the canvas backend isn't fully implemented.
  // Skip just the noise pass so the test suite doesn't blow up on
  // import-time side effects, then continue to build the texture below.
  const imgData = ctx.getImageData(0, 0, size, size);
  const data = imgData?.data;
  if (data) {
    for (let i = 0; i < data.length; i += 4) {
      const noise = (Math.random() - 0.5) * 15; // subtle grain
      data[i] = Math.min(255, Math.max(0, data[i] + noise));     // R
      data[i+1] = Math.min(255, Math.max(0, data[i+1] + noise)); // G
      data[i+2] = Math.min(255, Math.max(0, data[i+2] + noise)); // B
    }
    ctx.putImageData(imgData, 0, 0);
  }

  // Add a few larger stains/imperfections.
  // Guarded for jsdom (unit tests) — createRadialGradient returns an
  // object missing addColorStop when the canvas backend is incomplete.
  for (let i = 0; i < 15; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const r = 2 + Math.random() * 8;
    const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
    if (typeof grad?.addColorStop !== "function") continue;
    grad.addColorStop(0, "rgba(71, 85, 105, 0.12)");
    grad.addColorStop(1, "rgba(71, 85, 105, 0)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(6, 4); // tile repeat
  return texture;
}
