/**
 * Digital Twin FM — Building floor definitions
 *
 * Convention centre layout with proper architectural spaces:
 *   L1 (Ground) — Main entrance, lobby, Exhibition Hall A/B, café, services, lift lobby
 *   L2 (Upper)  — Exhibition Hall C/D, meeting rooms, terrace, server room
 *   L3 (Roof)   — Chiller plant, AHU deck
 *   L4 (Upper Roof) — Sky garden, elevator penthouse
 */

import type { FloorData } from "./building-geometry";

export const W = 34;
export const D = 26;
export const SLAB_T = 0.35;
export const FLOOR_H = 5.0;
export const KERB = 0.6;

export const BUILDING_FLOORS: FloorData[] = [
  {
    level: 1,
    name: "Ground Floor — Lobby & Exhibition",
    shortLabel: "L1",
    yBase: 0,
    height: FLOOR_H,
    zones: [
      // Core circulation
      { id: "zone-l1-entrance", name: "Main Entrance", cx: 0, cz: -10, w: 10, d: 4 },
      { id: "zone-l1-lobby", name: "Grand Lobby", cx: 0, cz: -5, w: 14, d: 6 },
      { id: "zone-l1-reception", name: "Reception Desk", cx: 0, cz: -2, w: 4, d: 2.5 },
      { id: "zone-l1-corridor", name: "Main Corridor", cx: 0, cz: 2.5, w: 4, d: 5 },
      { id: "zone-l1-lift-lobby", name: "Lift Lobby", cx: 0, cz: 7.5, w: 6, d: 4 },
      // Exhibition halls
      { id: "zone-l1-hall-a", name: "Exhibition Hall A", cx: -8, cz: 0, w: 10, d: 12 },
      { id: "zone-l1-hall-b", name: "Exhibition Hall B", cx: 8, cz: 0, w: 10, d: 12 },
      // Amenities
      { id: "zone-l1-cafe", name: "Café & Lounge", cx: -9.5, cz: -5, w: 5, d: 4 },
      { id: "zone-l1-services", name: "Services & Plant", cx: 10, cz: 7.5, w: 6, d: 5 },
      { id: "zone-l1-restrooms", name: "Restrooms", cx: -10, cz: 7.5, w: 4, d: 4 },
      { id: "zone-l1-storage", name: "Storage", cx: -10, cz: -8.5, w: 4, d: 3 },
    ],
    rooms: [
      { id: "rm-l1-entrance", name: "Main Entrance", vertices: [
        { x: -5, z: -12 }, { x: 5, z: -12 }, { x: 5, z: -8 }, { x: -5, z: -8 },
      ]},
      { id: "rm-l1-lobby", name: "Grand Lobby", vertices: [
        { x: -7, z: -8 }, { x: 7, z: -8 }, { x: 7, z: -2 }, { x: -7, z: -2 },
      ]},
      { id: "rm-l1-corridor", name: "Main Corridor", vertices: [
        { x: -2, z: -2 }, { x: 2, z: -2 }, { x: 2, z: 5 }, { x: -2, z: 5 },
      ]},
      { id: "rm-l1-lift-lobby", name: "Lift Lobby", vertices: [
        { x: -3, z: 5.5 }, { x: 3, z: 5.5 }, { x: 3, z: 9.5 }, { x: -3, z: 9.5 },
      ]},
      { id: "rm-l1-hall-a", name: "Exhibition Hall A", vertices: [
        { x: -13, z: -2 }, { x: -3, z: -2 }, { x: -3, z: 6 }, { x: -13, z: 6 },
      ]},
      { id: "rm-l1-hall-b", name: "Exhibition Hall B", vertices: [
        { x: 3, z: -2 }, { x: 13, z: -2 }, { x: 13, z: 6 }, { x: 3, z: 6 },
      ]},
      { id: "rm-l1-cafe", name: "Café & Lounge", vertices: [
        { x: -12, z: -7 }, { x: -7, z: -7 }, { x: -7, z: -3 }, { x: -12, z: -3 },
      ]},
      { id: "rm-l1-services", name: "Services & Plant", vertices: [
        { x: 7, z: 5 }, { x: 13, z: 5 }, { x: 13, z: 10 }, { x: 7, z: 10 },
      ]},
      { id: "rm-l1-restrooms", name: "Restrooms", vertices: [
        { x: -13, z: 5.5 }, { x: -9, z: 5.5 }, { x: -9, z: 9.5 }, { x: -13, z: 9.5 },
      ]},
      { id: "rm-l1-storage", name: "Storage", vertices: [
        { x: -13, z: -10 }, { x: -9, z: -10 }, { x: -9, z: -7 }, { x: -13, z: -7 },
      ]},
    ],
  },
  {
    level: 2,
    name: "Upper Level — Exhibition & Conference",
    shortLabel: "L2",
    yBase: FLOOR_H,
    height: FLOOR_H,
    zones: [
      { id: "zone-l2-hall-c", name: "Exhibition Hall C", cx: -8, cz: -1, w: 10, d: 12 },
      { id: "zone-l2-hall-d", name: "Exhibition Hall D", cx: 8, cz: -1, w: 10, d: 12 },
      { id: "zone-l2-meeting", name: "Meeting Rooms", cx: 0, cz: -5, w: 8, d: 6 },
      { id: "zone-l2-terrace", name: "Roof Terrace", cx: -8, cz: -8, w: 8, d: 4 },
      { id: "zone-l2-lift-lobby", name: "Lift Lobby", cx: 0, cz: 7.5, w: 6, d: 4 },
      { id: "zone-l2-server", name: "Server Room", cx: -8, cz: 7.5, w: 6, d: 4 },
      { id: "zone-l2-corridor", name: "Corridor", cx: 0, cz: 1.5, w: 4, d: 5 },
    ],
    rooms: [
      { id: "rm-l2-hall-c", name: "Exhibition Hall C", vertices: [
        { x: -13, z: -7 }, { x: -3, z: -7 }, { x: -3, z: 5 }, { x: -13, z: 5 },
      ]},
      { id: "rm-l2-hall-d", name: "Exhibition Hall D", vertices: [
        { x: 3, z: -7 }, { x: 13, z: -7 }, { x: 13, z: 5 }, { x: 3, z: 5 },
      ]},
      { id: "rm-l2-meeting", name: "Meeting Rooms", vertices: [
        { x: -4, z: -8 }, { x: 4, z: -8 }, { x: 4, z: -2 }, { x: -4, z: -2 },
      ]},
      { id: "rm-l2-corridor", name: "Corridor", vertices: [
        { x: -2, z: -2 }, { x: 2, z: -2 }, { x: 2, z: 4 }, { x: -2, z: 4 },
      ]},
      { id: "rm-l2-lift-lobby", name: "Lift Lobby", vertices: [
        { x: -3, z: 5.5 }, { x: 3, z: 5.5 }, { x: 3, z: 9.5 }, { x: -3, z: 9.5 },
      ]},
      { id: "rm-l2-server", name: "Server Room", vertices: [
        { x: -13, z: 5.5 }, { x: -7, z: 5.5 }, { x: -7, z: 9.5 }, { x: -13, z: 9.5 },
      ]},
      { id: "rm-l2-terrace", name: "Roof Terrace", vertices: [
        { x: -12, z: -10 }, { x: -4, z: -10 }, { x: -4, z: -7 }, { x: -12, z: -7 },
      ]},
    ],
  },
  {
    level: 3,
    name: "Roof Plant & MEP",
    shortLabel: "L3",
    yBase: FLOOR_H * 2,
    height: FLOOR_H,
    zones: [
      { id: "zone-l3-chillers", name: "Chiller Plant", cx: -5, cz: 0, w: 12, d: 10 },
      { id: "zone-l3-ahu", name: "AHU Deck", cx: 6, cz: 1, w: 10, d: 8 },
      { id: "zone-l3-elevator-overhead", name: "Elevator Machine Room", cx: 0, cz: -6, w: 6, d: 4 },
    ],
    rooms: [
      { id: "rm-l3-chillers", name: "Chiller Plant", vertices: [
        { x: -11, z: -5 }, { x: 1, z: -5 }, { x: 1, z: 5 }, { x: -11, z: 5 },
      ]},
      { id: "rm-l3-ahu", name: "AHU Deck", vertices: [
        { x: 1, z: -3 }, { x: 11, z: -3 }, { x: 11, z: 5 }, { x: 1, z: 5 },
      ]},
      { id: "rm-l3-elevator-overhead", name: "Elevator Machine Room", vertices: [
        { x: -3, z: -8 }, { x: 3, z: -8 }, { x: 3, z: -4 }, { x: -3, z: -4 },
      ]},
    ],
  },
  {
    level: 4,
    name: "Upper Roof & Sky Garden",
    shortLabel: "L4",
    yBase: FLOOR_H * 3,
    height: FLOOR_H,
    zones: [
      { id: "zone-l4-terrace", name: "Sky Terrace", cx: 0, cz: -2, w: 12, d: 10 },
      { id: "zone-l4-penthouse", name: "Elevator Penthouse", cx: 0, cz: 7, w: 6, d: 4 },
    ],
    rooms: [
      { id: "rm-l4-terrace", name: "Sky Terrace", vertices: [
        { x: -6, z: -7 }, { x: 6, z: -7 }, { x: 6, z: 3 }, { x: -6, z: 3 },
      ]},
      { id: "rm-l4-penthouse", name: "Elevator Penthouse", vertices: [
        { x: -3, z: 5 }, { x: 3, z: 5 }, { x: 3, z: 9 }, { x: -3, z: 9 },
      ]},
    ],
  },
];

/**
 * Generate procedural floors for generic buildings.
 * Useful for testing or for customer buildings without pre-defined geometry.
 */
export function buildDefaultFloors(count: number): FloorData[] {
  return Array.from({ length: count }, (_, i) => ({
    level: i + 1,
    name: i === 0 ? "Ground Floor" : `Floor ${i + 1}`,
    yBase: i * FLOOR_H,
    height: FLOOR_H,
    zones: [
      { id: `zone-f${i}-centre`, name: `Zone ${i + 1}A`, cx: 0, cz: 0, w: 8, d: 8 },
      { id: `zone-f${i}-side`, name: `Zone ${i + 1}B`, cx: 0, cz: -6, w: 6, d: 4 },
    ],
  }));
}
