"use client";

/**
 * Digital Twin FM — Three.js viewer
 *
 * Raw Three.js (no @react-three/fiber) component that:
 *   - Mounts a WebGL canvas into a div (next/dynamic ssr:false in panel.tsx)
 *   - Builds a Singapore Expo convention centre (2 exhibition levels,
 *     white panel facade, signature sawtooth roof, large entrance atrium)
 *   - Places 20 typed asset markers with per-type geometry:
 *       Air Handler → BoxGeometry cabinet + grille detail meshes
 *       Chiller     → CylinderGeometry vessel + flanged caps
 *       Boiler      → tapered CylinderGeometry + flue pipe
 *       Pump        → SphereGeometry body + inlet/outlet pipes
 *       Fan         → CylinderGeometry disc + 4 BoxGeometry blades
 *     Each marker: TorusGeometry status ring (emissive), transparent
 *     SphereGeometry fault glow (pulsed in RAF), CanvasTexture Sprite
 *     name label above.
 *   - Glass observation elevator with animated cab, cables, rails
 *   - Escalators crossing the entrance atrium
 *   - Exposed HVAC ductwork + VAV boxes on roof and in ceiling
 *   - OrbitControls: full vertical orbit, damping 0.05
 *   - Raycaster: hover (float + cursor + emissive), click (inspect panel)
 *   - Floor + type filters toggle group.visible
 *   - Optional homepage mode (showMarkers=false, autoRotate=true)
 *
 * Cleanup: renderer.dispose, controls.dispose, cancelAnimationFrame,
 * ResizeObserver.disconnect, all geometries/materials/CanvasTextures
 * freed, DOM canvas removed.
 */

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { useViewerStore } from "./viewer-store";
import {
  type Asset,
  type AssetStatus,
  type AssetType,
  SEED_ASSETS,
  floorLabel,
  METRIC_LABEL,
  DETAIL_LABEL,
  STATUS_DISPLAY,
} from "./viewer-data";
import type { FloorFilter, TypeFilter } from "./viewer-store";
import {
  colors,
  shadow,
  building as B,
  camera as CAM,
  light as LIGHT,
  fog as FOG,
} from "@/design-system/tokens";

const STATUS_HEX = colors.status;
const TYPE_HEX = colors.type;
const STATUS_HEX_INT = colors.statusHex;
const TYPE_HEX_INT: Record<AssetType, number> = {
  "Air Handler": 0x3b82f6,
  Chiller: 0x06b6d4,
  Boiler: 0xf97316,
  Pump: 0xa855f7,
  Fan: 0x10b981,
};

// ─── CanvasTexture Sprite name label ──────────────────────────────
function makeNameLabelSprite(name: string, type: AssetType): THREE.Sprite {
  const FONT_SIZE = 36;
  const tmp = document.createElement("canvas");
  const tmpCtx = tmp.getContext("2d")!;
  tmpCtx.font = `600 ${FONT_SIZE}px system-ui, -apple-system, sans-serif`;
  const textW = tmpCtx.measureText(name).width;
  const PAD = 24;
  const W = Math.max(256, Math.ceil(textW + PAD * 2));
  const H = 64;

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  // Rounded-pill background (light theme, matches dashboard cards)
  const r = H / 2;
  ctx.beginPath();
  ctx.moveTo(r, 0);
  ctx.lineTo(W - r, 0);
  ctx.quadraticCurveTo(W, 0, W, r);
  ctx.lineTo(W, H - r);
  ctx.quadraticCurveTo(W, H, W - r, H);
  ctx.lineTo(r, H);
  ctx.quadraticCurveTo(0, H, 0, H - r);
  ctx.lineTo(0, r);
  ctx.quadraticCurveTo(0, 0, r, 0);
  ctx.closePath();
  ctx.fillStyle = colors.bg.surface;
  ctx.fill();
  ctx.strokeStyle = colors.border.light;
  ctx.lineWidth = 2;
  ctx.stroke();

  // Small type-color dot at the left
  ctx.beginPath();
  ctx.arc(22, H / 2, 5, 0, Math.PI * 2);
  ctx.fillStyle = TYPE_HEX[type];
  ctx.fill();

  // Name
  ctx.fillStyle = colors.text.primary;
  ctx.font = `600 ${FONT_SIZE}px system-ui, -apple-system, sans-serif`;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(name, 38, H / 2 + 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: texture, transparent: true }),
  );
  sprite.scale.set(4, 1.2, 1);
  return sprite;
}

// ─── Marker handles ────────────────────────────────────────────────
interface MarkerHandles {
  group: THREE.Group;        // root group (positioned, visible toggled)
  body: THREE.Mesh;          // main body mesh (emissive highlight on select)
  ring: THREE.Mesh;          // TorusGeometry status ring
  glow: THREE.Mesh;          // transparent SphereGeometry fault glow
  label: THREE.Sprite;       // CanvasTexture name label above
  blades?: THREE.Group;      // Fan only — animated blades
  isFault: boolean;
  baseY: number;
}

// ─── Per-type marker body geometry ────────────────────────────────
function buildMarkerBody(asset: Asset): {
  body: THREE.Mesh;
  blades?: THREE.Group;
} {
  const typeColor = TYPE_HEX_INT[asset.type];
  const isFan = asset.type === "Fan";

  if (asset.type === "Air Handler") {
    // BoxGeometry cabinet + 3 grille slats
    const cabinet = new THREE.Mesh(
      new THREE.BoxGeometry(1.4, 1.2, 1.0),
      new THREE.MeshStandardMaterial({
        color: typeColor,
        roughness: 0.5,
        metalness: 0.4,
      }),
    );
    cabinet.castShadow = true;
    // Grille slats
    for (let i = 0; i < 3; i++) {
      const slat = new THREE.Mesh(
        new THREE.BoxGeometry(1.0, 0.06, 0.04),
        new THREE.MeshStandardMaterial({
          color: 0x1e293b,
          metalness: 0.6,
          roughness: 0.3,
        }),
      );
      slat.position.set(0, -0.25 + i * 0.25, 0.52);
      cabinet.add(slat);
    }
    return { body: cabinet };
  }

  if (asset.type === "Chiller") {
    // CylinderGeometry vessel + 2 flanged caps
    const vessel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.55, 0.55, 1.6, 24),
      new THREE.MeshStandardMaterial({
        color: typeColor,
        roughness: 0.4,
        metalness: 0.6,
      }),
    );
    vessel.castShadow = true;
    [-0.8, 0.8].forEach((y) => {
      const cap = new THREE.Mesh(
        new THREE.CylinderGeometry(0.7, 0.7, 0.1, 24),
        new THREE.MeshStandardMaterial({
          color: 0x64748b,
          metalness: 0.7,
          roughness: 0.3,
        }),
      );
      cap.position.y = y;
      vessel.add(cap);
    });
    return { body: vessel };
  }

  if (asset.type === "Boiler") {
    // Tapered CylinderGeometry + flue pipe
    const tapered = new THREE.Mesh(
      new THREE.CylinderGeometry(0.35, 0.55, 1.4, 16),
      new THREE.MeshStandardMaterial({
        color: typeColor,
        roughness: 0.5,
        metalness: 0.4,
      }),
    );
    tapered.castShadow = true;
    const flue = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.12, 1.0, 12),
      new THREE.MeshStandardMaterial({
        color: 0x475569,
        metalness: 0.8,
        roughness: 0.2,
      }),
    );
    flue.position.y = 1.2;
    tapered.add(flue);
    return { body: tapered };
  }

  if (asset.type === "Pump") {
    // SphereGeometry body + 2 inlet/outlet CylinderGeometry pipes
    const sphere = new THREE.Mesh(
      new THREE.SphereGeometry(0.55, 20, 16),
      new THREE.MeshStandardMaterial({
        color: typeColor,
        roughness: 0.3,
        metalness: 0.7,
      }),
    );
    sphere.castShadow = true;
    [-1, 1].forEach((side) => {
      const pipe = new THREE.Mesh(
        new THREE.CylinderGeometry(0.15, 0.15, 0.6, 12),
        new THREE.MeshStandardMaterial({
          color: 0x94a3b8,
          metalness: 0.7,
          roughness: 0.3,
        }),
      );
      pipe.rotation.z = Math.PI / 2;
      pipe.position.set(side * 0.7, 0, 0);
      sphere.add(pipe);
    });
    return { body: sphere };
  }

  // Fan: CylinderGeometry disc + 4 BoxGeometry blades (animated)
  const disc = new THREE.Mesh(
    new THREE.CylinderGeometry(0.7, 0.7, 0.15, 24),
    new THREE.MeshStandardMaterial({
      color: typeColor,
      roughness: 0.4,
      metalness: 0.5,
    }),
  );
  disc.castShadow = true;
  const blades = new THREE.Group();
  for (let i = 0; i < 4; i++) {
    const blade = new THREE.Mesh(
      new THREE.BoxGeometry(0.6, 0.05, 0.15),
      new THREE.MeshStandardMaterial({
        color: 0xe2e8f0,
        roughness: 0.5,
        metalness: 0.3,
      }),
    );
    blade.position.set(
      Math.cos((i * Math.PI) / 2) * 0.35,
      0,
      Math.sin((i * Math.PI) / 2) * 0.35,
    );
    blade.rotation.y = (i * Math.PI) / 2;
    blades.add(blade);
  }
  return { body: disc, blades };
}

// ─── Marker factory ───────────────────────────────────────────────
function buildMarker(asset: Asset): MarkerHandles {
  const group = new THREE.Group();
  group.name = `Asset-${asset.id}`;
  const baseY = asset.floor * B.floorH + B.podiumH + 1.0;
  group.position.set(asset.x, baseY, asset.z);
  group.userData = { assetId: asset.id, asset };

  const { body, blades } = buildMarkerBody(asset);
  group.add(body);

  // Status ring (TorusGeometry, emissive)
  const statusColor = STATUS_HEX_INT[asset.status];
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.9, 0.04, 8, 32),
    new THREE.MeshStandardMaterial({
      color: statusColor,
      emissive: statusColor,
      emissiveIntensity: 1.2,
      toneMapped: false,
    }),
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = -0.7;
  group.add(ring);

  // Fault glow (transparent SphereGeometry)
  const glow = new THREE.Mesh(
    new THREE.SphereGeometry(1.1, 16, 12),
    new THREE.MeshBasicMaterial({
      color: statusColor,
      transparent: true,
      opacity: asset.status === "fault" ? 0.18 : 0.0,
      depthWrite: false,
    }),
  );
  group.add(glow);

  // Name label sprite above
  const label = makeNameLabelSprite(asset.name, asset.type);
  label.position.set(0, 1.6, 0);
  group.add(label);

  // Fan blades (animated)
  if (blades) {
    blades.position.y = 0;
    group.add(blades);
  }

  return {
    group,
    body,
    ring,
    glow,
    label,
    blades,
    isFault: asset.status === "fault",
    baseY,
  };
}

// ─── Building construction — Singapore Expo convention centre ───
// A wide, low-rise exhibition hall with signature sawtooth roof,
// light panel facade, and large entrance atrium.
function buildBuilding(): THREE.Group {
  const group = new THREE.Group();
  group.name = "Building";

  const halfW = B.towerW / 2;
  const halfD = B.towerD / 2;
  const totalH = B.floorH * B.floorCount;

  // Ground plane (light, matches dashboard bg)
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(140, 140),
    new THREE.MeshStandardMaterial({
      color: colors.building.ground,
      roughness: 0.95,
      metalness: 0,
    }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  group.add(ground);

  // Subtle architectural grid
  const grid = new THREE.GridHelper(
    140, 60,
    colors.building.gridSection,
    colors.building.gridCell,
  );
  grid.position.y = 0.01;
  group.add(grid);

  // Low podium — wide base, convention centre sits near ground
  const podiumW = B.towerW + 6;
  const podiumD = B.towerD + 6;
  const podiumMat = new THREE.MeshStandardMaterial({
    color: colors.building.podium,
    roughness: 0.7,
    metalness: 0.1,
  });
  const podium = new THREE.Mesh(
    new THREE.BoxGeometry(podiumW, B.podiumH, podiumD),
    podiumMat,
  );
  podium.position.set(0, B.podiumH / 2, 0);
  podium.castShadow = true;
  podium.receiveShadow = true;
  group.add(podium);

  // ── Shared materials ──
  // Singapore Expo: crisp white metal cladding panels with generous glazing
  const panelMat = new THREE.MeshStandardMaterial({
    color: 0xf8fafc,       // pure white — matches Expo white metal cladding
    roughness: 0.6,
    metalness: 0.1,
  });
  const accentPanelMat = new THREE.MeshStandardMaterial({
    color: 0xf1f5f9,       // very subtle warm white for panel joints
    roughness: 0.55,
    metalness: 0.15,
  });
  const colMat = new THREE.MeshStandardMaterial({
    color: colors.building.column,
    metalness: 0.5,
    roughness: 0.4,
  });
  // Larger, clearer glass areas for Expo-style generous glazing
  const windowMat = new THREE.MeshPhysicalMaterial({
    color: 0x7ab8e0,
    metalness: 0.12,
    roughness: 0.05,
    transmission: 0.7,
    transparent: true,
    opacity: 0.2,
    ior: 1.5,
    side: THREE.DoubleSide,
  });
  const frameMat = new THREE.MeshStandardMaterial({
    color: 0x64748b,
    metalness: 0.6,
    roughness: 0.3,
  });
  // Dark frame for structural grid expression
  const mullionMat = new THREE.MeshStandardMaterial({
    color: 0x475569,
    metalness: 0.5,
    roughness: 0.4,
  });

  // ─── Per-floor construction ───
  for (let floor = 0; floor < B.floorCount; floor++) {
    const yBase = B.podiumH + floor * B.floorH;
    const yCenter = yBase + B.floorH / 2;
    const floorGroup = new THREE.Group();
    floorGroup.name = `Floor-${floor}`;

    // Concrete slab
    const slab = new THREE.Mesh(
      new THREE.BoxGeometry(B.towerW + 0.5, B.slabT, B.towerD + 0.5),
      new THREE.MeshStandardMaterial({
        color: colors.building.slab,
        roughness: 0.85,
        metalness: 0.05,
      }),
    );
    slab.position.set(0, yBase, 0);
    slab.castShadow = true;
    slab.receiveShadow = true;
    floorGroup.add(slab);

    // Suspended ceiling (thin band below slab) — exhibition halls have
    // exposed structure but some ceiling border band is visible
    const ceilingBand = new THREE.Mesh(
      new THREE.BoxGeometry(B.towerW - 0.3, 0.08, B.towerD - 0.3),
      new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.6, metalness: 0.1 }),
    );
    ceilingBand.position.set(0, yBase + B.floorH - 0.25, 0);
    floorGroup.add(ceilingBand);

    // ── Large structural columns — exhibition hall spans ──
    // Front and back rows (9 columns each for wider building)
    const colCount = 11;
    for (let i = 0; i < colCount; i++) {
      const t = i / (colCount - 1);
      const x = -halfW + B.towerW * t;
      const col = new THREE.Mesh(
        new THREE.BoxGeometry(B.columnSize, B.floorH, B.columnSize),
        colMat,
      );
      col.castShadow = true;
      // Front row
      const colF = col.clone();
      colF.position.set(x, yCenter, halfD - 0.3);
      floorGroup.add(colF);
      // Back row
      const colB = col.clone();
      colB.position.set(x, yCenter, -halfD + 0.3);
      floorGroup.add(colB);
    }
    // Side columns (7 each side)
    for (let i = 0; i < 9; i++) {
      const t = i / 8;
      const z = -halfD + B.towerD * t;
      const sideCol = new THREE.Mesh(
        new THREE.BoxGeometry(B.columnSize, B.floorH, B.columnSize),
        colMat,
      );
      sideCol.castShadow = true;
      const colL = sideCol.clone();
      colL.position.set(-halfW + 0.3, yCenter, z);
      floorGroup.add(colL);
      const colR = sideCol.clone();
      colR.position.set(halfW - 0.3, yCenter, z);
      floorGroup.add(colR);
    }

    // ── Exterior wall panels (NOT glass curtain wall) ──
    // Singapore Expo: solid white/light wall panels broken by
    // recessed horizontal window strips and vertical articulation
    const panelCols = B.panelCols;
    const panelRows = B.panelRows;
    const usableH = B.floorH - B.slabT;
    const panelH = usableH / panelRows;
    const panelW = B.towerW / (panelCols - 1);

    // Back wall — panel facade with generous window strips
    for (let row = 0; row < panelRows; row++) {
      for (let col = 0; col < panelCols; col++) {
        const x = -halfW + panelW * col;
        const y = yBase + B.slabT / 2 + panelH * (row + 0.5);
        // Expo-style: alternate wide window bands with solid panels
        const isWindowRow = row === 1; // middle row = wide window band
        if (isWindowRow) {
          // Generous continuous window strip spanning bay width
          const win = new THREE.Mesh(
            new THREE.BoxGeometry(panelW * 0.8, panelH * 0.65, 0.06),
            windowMat,
          );
          win.position.set(x, y, -halfD);
          floorGroup.add(win);
        } else {
          // Solid white panel
          const panel = new THREE.Mesh(
            new THREE.BoxGeometry(panelW * 0.92, panelH * 0.88, 0.1),
            col % 2 === 0 ? panelMat : accentPanelMat,
          );
          panel.position.set(x, y, -halfD);
          floorGroup.add(panel);
        }
      }
    }
    // Vertical mullion strips between panel bays (back wall)
    for (let col = 0; col <= panelCols; col++) {
      const x = -halfW + panelW * col - panelW / 2;
      const mullion = new THREE.Mesh(
        new THREE.BoxGeometry(0.04, panelH * panelRows * 0.9, 0.12),
        mullionMat,
      );
      mullion.position.set(x, yBase + B.slabT / 2 + (panelH * panelRows) / 2, -halfD);
      floorGroup.add(mullion);
    }

    // Side walls — panel facade with generous glazing
    for (let row = 0; row < panelRows; row++) {
      for (let col = 0; col < panelCols; col++) {
        const x = -halfW + panelW * col;
        const y = yBase + B.slabT / 2 + panelH * (row + 0.5);
        const isWindowRow = row === 1; // middle row = window band
        const panelW2 = B.towerD / (panelCols - 1);
        const zSide = -halfD + panelW2 * col;

        // Left side wall
        const wallL = new THREE.Mesh(
          new THREE.BoxGeometry(
            0.08,
            isWindowRow ? panelH * 0.65 : panelH * 0.88,
            panelW2 * 0.85,
          ),
          isWindowRow ? windowMat : (col % 2 === 0 ? panelMat : accentPanelMat),
        );
        wallL.position.set(-halfW, y, zSide);
        floorGroup.add(wallL);
        // Right side wall
        const wallR = wallL.clone();
        wallR.position.set(halfW, y, zSide);
        floorGroup.add(wallR);
      }
    }
    // Vertical mullion strips (side walls)
    for (let col = 0; col <= panelCols; col++) {
      const zSide = -halfD + (B.towerD / (panelCols - 1)) * col - (B.towerD / (panelCols - 1)) / 2;
      for (const sideX of [-1, 1]) {
        const mullion = new THREE.Mesh(
          new THREE.BoxGeometry(0.12, panelH * panelRows * 0.9, 0.04),
          mullionMat,
        );
        mullion.position.set(sideX * halfW, yBase + B.slabT / 2 + (panelH * panelRows) / 2, zSide);
        floorGroup.add(mullion);
      }
    }

    // Front wall — generous glazing with white panel bands
    if (floor === 0) {
      // Level 1: full glass atrium front — large glass panels with minimal framing
      for (let col = 0; col < panelCols; col++) {
        const x = -halfW + panelW * col;
        // Skip center section for atrium opening
        if (Math.abs(x) < B.atriumW / 2 + 0.5) continue;
        for (let row = 0; row < panelRows; row++) {
          const y = yBase + B.slabT / 2 + panelH * (row + 0.5);
          const isWindowRow = row === 1;
          const gf = new THREE.Mesh(
            new THREE.BoxGeometry(
              panelW * 0.88,
              isWindowRow ? panelH * 0.65 : panelH * 0.85,
              0.06,
            ),
            isWindowRow ? windowMat : (col % 2 === 0 ? panelMat : accentPanelMat),
          );
          gf.position.set(x, y, halfD);
          floorGroup.add(gf);
        }
      }
      // Atrium opening — large glass panels spanning the entrance
      const atGlassMat = new THREE.MeshPhysicalMaterial({
        color: 0x7ab8e0,
        metalness: 0.12,
        roughness: 0.05,
        transmission: 0.75,
        transparent: true,
        opacity: 0.15,
        ior: 1.5,
        side: THREE.DoubleSide,
      });
      const atPanels = 7;
      for (let i = 0; i < atPanels; i++) {
        const x = -B.atriumW / 2 + (B.atriumW / (atPanels - 1)) * i;
        const panelH2 = B.atriumH / panelRows;
        for (let row = 0; row < panelRows; row++) {
          const y = yBase + B.slabT / 2 + panelH2 * (row + 0.5);
          const atP = new THREE.Mesh(
            new THREE.BoxGeometry((B.atriumW / (atPanels - 1)) * 0.88, panelH2 * 0.88, 0.05),
            atGlassMat,
          );
          atP.position.set(x, y, halfD);
          floorGroup.add(atP);
        }
      }
    } else {
      // Upper floor: generous window band across full width
      for (let col = 0; col < panelCols; col++) {
        const x = -halfW + panelW * col;
        for (let row = 0; row < panelRows; row++) {
          const y = yBase + B.slabT / 2 + panelH * (row + 0.5);
          const isWindowRow = row === 1;
          const mat = isWindowRow ? windowMat : (col % 2 === 0 ? panelMat : accentPanelMat);
          // Skip if this would overlap atrium void
          if (Math.abs(x) < B.atriumW / 2 && row < 2) continue;
          const gf = new THREE.Mesh(
            new THREE.BoxGeometry(
              panelW * 0.88,
              isWindowRow ? panelH * 0.65 : panelH * 0.85,
              isWindowRow ? 0.06 : 0.1,
            ),
            mat,
          );
          gf.position.set(x, y, halfD);
          floorGroup.add(gf);
        }
      }
    }
    // Front facade vertical mullions
    for (let col = 0; col <= panelCols; col++) {
      const x = -halfW + panelW * col - panelW / 2;
      // Skip mullions in atrium zone
      if (Math.abs(x) < B.atriumW / 2 + 0.3) continue;
      const mullion = new THREE.Mesh(
        new THREE.BoxGeometry(0.04, panelH * panelRows * 0.9, 0.12),
        mullionMat,
      );
      mullion.position.set(x, yBase + B.slabT / 2 + (panelH * panelRows) / 2, halfD);
      floorGroup.add(mullion);
    }

    // ── Horizontal spandrel bands — prominent architectural feature ──
    // Deep concrete fascia that wraps around the building at each floor
    // level, giving the Expo facade its distinctive layered look
    const spandrelMat = new THREE.MeshStandardMaterial({
      color: 0xcbd5e1,
      roughness: 0.6,
      metalness: 0.1,
    });
    const spandrelShadowMat = new THREE.MeshStandardMaterial({
      color: 0x94a3b8,
      roughness: 0.7,
      metalness: 0.05,
    });
    // Main spandrel band (front face only — deep horizontal line)
    const spandrelFront = new THREE.Mesh(
      new THREE.BoxGeometry(B.towerW + 0.6, 0.25, 0.4),
      spandrelMat,
    );
    spandrelFront.position.set(0, yBase + B.slabT - 0.05, halfD + 0.1);
    spandrelFront.castShadow = true;
    floorGroup.add(spandrelFront);
    // Shadow band below
    const shadowBand = new THREE.Mesh(
      new THREE.BoxGeometry(B.towerW + 0.6, 0.08, 0.3),
      spandrelShadowMat,
    );
    shadowBand.position.set(0, yBase + B.slabT - 0.22, halfD + 0.15);
    floorGroup.add(shadowBand);

    // Secondary spandrel at the top of each floor (front)
    const spandrelTop = new THREE.Mesh(
      new THREE.BoxGeometry(B.towerW + 0.6, 0.15, 0.3),
      spandrelMat,
    );
    spandrelTop.position.set(0, yBase + B.floorH - 0.05, halfD + 0.1);
    floorGroup.add(spandrelTop);

    group.add(floorGroup);
  }

  // ─── Entrance Atrium — large glass feature at front ───
  const entranceGroup = new THREE.Group();
  entranceGroup.name = "Entrance";
  
  // "SINGAPORE EXPO" branding on the facade above the atrium
  const expoCanvas = document.createElement("canvas");
  expoCanvas.width = 512;
  expoCanvas.height = 96;
  const expoCtx = expoCanvas.getContext("2d")!;
  expoCtx.clearRect(0, 0, 512, 96);
  // Subtle dark background pill
  expoCtx.fillStyle = "rgba(15, 23, 42, 0.55)";
  expoCtx.beginPath();
  expoCtx.roundRect(10, 10, 492, 76, 14);
  expoCtx.fill();
  // Top line: "SINGAPORE"
  expoCtx.fillStyle = "#ffffff";
  expoCtx.font = "bold 34px system-ui, -apple-system, sans-serif";
  expoCtx.textAlign = "center";
  expoCtx.textBaseline = "middle";
  expoCtx.fillText("SINGAPORE", 256, 34);
  // Bottom line: "EXPO"
  expoCtx.fillStyle = "#ffb347";
  expoCtx.font = "bold 46px system-ui, -apple-system, sans-serif";
  expoCtx.fillText("EXPO", 256, 72);
  const expoTex = new THREE.CanvasTexture(expoCanvas);
  expoTex.minFilter = THREE.LinearFilter;
  expoTex.magFilter = THREE.LinearFilter;
  const expoSprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: expoTex, transparent: true, depthTest: false }),
  );
  expoSprite.scale.set(12, 2.4, 1);
  expoSprite.position.set(0, B.podiumH + B.floorH * B.floorCount + 0.5, halfD + 0.3);
  entranceGroup.add(expoSprite);

  const atGlassMat = new THREE.MeshPhysicalMaterial({
    color: 0x7ab8e0,
    metalness: 0.12,
    roughness: 0.05,
    transmission: 0.75,
    transparent: true,
    opacity: 0.12,
    ior: 1.5,
    side: THREE.DoubleSide,
  });
  const darkFrameMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.5, roughness: 0.4 });
  const canopyMat = new THREE.MeshStandardMaterial({
    color: 0x94a3b8,
    metalness: 0.4,
    roughness: 0.5,
  });

  // Entrance doors at ground level
  for (const side of [-1, 1]) {
    const doorPanel = new THREE.Mesh(
      new THREE.BoxGeometry(2.5, 3.5, 0.06),
      darkFrameMat,
    );
    doorPanel.position.set(side * 3.5, B.podiumH + 1.75, halfD + 0.05);
    entranceGroup.add(doorPanel);
  }
  // Door header
  const doorHeader = new THREE.Mesh(
    new THREE.BoxGeometry(8.0, 0.2, 0.12),
    frameMat,
  );
  doorHeader.position.set(0, B.podiumH + 3.6, halfD + 0.05);
  entranceGroup.add(doorHeader);

  // Sweeping entrance canopy / porte-cochère — wide overhang like actual Expo
  const canopy = new THREE.Mesh(
    new THREE.BoxGeometry(B.atriumW + 9, 0.3, 8.0),
    canopyMat,
  );
  canopy.position.set(0, B.podiumH + 4.5, halfD + 5.0);
  canopy.castShadow = true;
  entranceGroup.add(canopy);

  // Canopy support columns — more dramatic V-shaped aesthetic
  for (const xc of [-B.atriumW / 2 - 2.5, -6, -2, 2, 6, B.atriumW / 2 + 2.5]) {
    const leg = new THREE.Mesh(
      new THREE.BoxGeometry(0.25, B.podiumH + 4.5, 0.25),
      new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.6, roughness: 0.3 }),
    );
    leg.position.set(xc, (B.podiumH + 4.5) / 2, halfD + 5.0);
    leg.castShadow = true;
    entranceGroup.add(leg);
  }

  // Canopy underside lighting (warm glow on ceiling of canopy)
  const canopyLight = new THREE.Mesh(
    new THREE.PlaneGeometry(B.atriumW + 7, 7.0),
    new THREE.MeshBasicMaterial({
      color: 0xffee88,
      transparent: true,
      opacity: 0.08,
      side: THREE.DoubleSide,
      toneMapped: false,
    }),
  );
  canopyLight.position.set(0, B.podiumH + 4.4, halfD + 5.0);
  canopyLight.rotation.x = -Math.PI / 2;
  entranceGroup.add(canopyLight);

  // Canopy top accent stripe
  const accentStripe = new THREE.Mesh(
    new THREE.BoxGeometry(B.atriumW + 9, 0.04, 0.3),
    new THREE.MeshBasicMaterial({ color: 0x355fe5, toneMapped: false, transparent: true, opacity: 0.4 }),
  );
  accentStripe.position.set(0, B.podiumH + 4.65, halfD + 5.0);
  entranceGroup.add(accentStripe);

  group.add(entranceGroup);

  // ─── Front facade structural fins / pilasters ────────────
  // Tall concrete piers between panel bays — gives the Expo its distinctive
  // rhythmic facade with deep shadow lines
  const finMat = new THREE.MeshStandardMaterial({
    color: 0xd1d5db,
    roughness: 0.7,
    metalness: 0.05,
  });
  const finShadowMat = new THREE.MeshStandardMaterial({
    color: 0x9ca3af,
    roughness: 0.8,
    metalness: 0.0,
  });
  for (let fi = 0; fi < 10; fi++) {
    const fx = -halfW + (B.towerW / 9) * fi;
    // Skip fins that would block the atrium entrance
    if (Math.abs(fx) < B.atriumW / 2 + 0.5) continue;
    const finH = totalH + 1.0;
    const fin = new THREE.Mesh(
      new THREE.BoxGeometry(0.3, finH, 0.4),
      finMat,
    );
    fin.position.set(fx, B.podiumH + finH / 2, halfD + 0.15);
    fin.castShadow = true;
    group.add(fin);

    // Shadow line / reveal on each side of the fin
    for (const side of [-1, 1]) {
      const reveal = new THREE.Mesh(
        new THREE.BoxGeometry(0.04, finH, 0.1),
        finShadowMat,
      );
      reveal.position.set(fx + side * 0.2, B.podiumH + finH / 2, halfD + 0.35);
      group.add(reveal);
    }
  }

  // ─── Sawtooth Roof — signature Singapore Expo feature ───
  const roofGroup = new THREE.Group();
  roofGroup.name = "SawtoothRoof";
  const roofBaseY = B.podiumH + totalH;

  const roofMatLight = new THREE.MeshStandardMaterial({
    color: 0xf1f5f9,     // white/light — matches actual Expo roof
    roughness: 0.7,
    metalness: 0.1,
  });
  const roofMatDark = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    roughness: 0.6,
    metalness: 0.2,
  });

  for (let r = 0; r < B.roofRidgeCount; r++) {
    const ridgeX = -halfW + B.roofRidgeW * (r + 0.5);
    // Triangular cross-section extruded across building depth
    const ridgeShape = new THREE.Shape();
    ridgeShape.moveTo(-B.roofRidgeW / 2, 0);
    ridgeShape.lineTo(0, B.roofRidgeH);
    ridgeShape.lineTo(B.roofRidgeW / 2, 0);
    ridgeShape.closePath();

    const ridge = new THREE.Mesh(
      new THREE.ExtrudeGeometry(ridgeShape, { depth: B.towerD + 6.0, bevelEnabled: false }),  // 6m overhang — sawtooth profile visible from front
      r % 2 === 0 ? roofMatLight : roofMatDark,
    );
    ridge.position.set(ridgeX, roofBaseY, -halfD);
    ridge.castShadow = true;
    ridge.receiveShadow = true;
    roofGroup.add(ridge);
  }

  // Ridge cap beams
  for (let r = 0; r < B.roofRidgeCount; r++) {
    const ridgeX = -halfW + B.roofRidgeW * (r + 0.5);
    const cap = new THREE.Mesh(
      new THREE.BoxGeometry(0.15, 0.12, B.towerD + 6.6),
      new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.7, roughness: 0.3 }),
    );
    cap.position.set(ridgeX, roofBaseY + B.roofRidgeH + 0.06, 0);
    roofGroup.add(cap);
  }

  // Roof parapet wall at the overhang front edge
  const parapet = new THREE.Mesh(
    new THREE.BoxGeometry(B.towerW + 0.5, 0.6, 0.12),
    new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.7, metalness: 0.05 }),
  );
  parapet.position.set(0, roofBaseY + 0.3, halfD + 6.0);
  roofGroup.add(parapet);

  // Roof edge fascia — clean trim line along the overhang
  const fasciaMat = new THREE.MeshStandardMaterial({
    color: 0x9ca3af,
    roughness: 0.5,
    metalness: 0.3,
  });
  const fascia = new THREE.Mesh(
    new THREE.BoxGeometry(B.towerW + 0.5, 0.15, 0.2),
    fasciaMat,
  );
  fascia.position.set(0, roofBaseY - 0.05, halfD + 6.0);
  roofGroup.add(fascia);

  // ── Roof overhang support columns — makes the sawtooth canopy read as an architectural feature ──
  const supportMat = new THREE.MeshStandardMaterial({
    color: 0x94a3b8,
    metalness: 0.5,
    roughness: 0.4,
  });
  for (let c = 0; c < 7; c++) {
    const cx = -halfW + 1.5 + c * 5.5;
    const support = new THREE.Mesh(
      new THREE.BoxGeometry(0.2, B.floorH * B.floorCount - 1.0, 0.2),
      supportMat,
    );
    support.position.set(cx, B.podiumH + (B.floorH * B.floorCount - 1.0) / 2, halfD + 3.5);
    roofGroup.add(support);
  }

  group.add(roofGroup);

  return group;
}

// ─── Elevator — prominent glass observation elevator ──────────────
// Positioned on the exterior facade so it's clearly visible and
// differentiated from mechanical equipment.
interface ElevatorCabAnim {
  group: THREE.Group;
  bottomY: number;
  topY: number;
  phase: number;
}

interface ElevatorData {
  group: THREE.Group;
  cabs: ElevatorCabAnim[];
}

function buildElevators(): ElevatorData {
  const group = new THREE.Group();
  group.name = "Elevators";
  const totalH = B.podiumH + B.floorH * B.floorCount;
  const halfW = B.towerW / 2;
  const halfD = B.towerD / 2;
  const cabs: ElevatorCabAnim[] = [];

  // Elevator-specific warm/premium materials — completely distinct from mechanical greys/blues
  const glassShaft = new THREE.MeshPhysicalMaterial({
    color: 0xd4e8ff,
    metalness: 0.05,
    roughness: 0.02,
    transparent: true,
    opacity: 0.06,              // barely visible — lets the glowing cab be the star
    side: THREE.DoubleSide,
    depthWrite: false,
    transmission: 0.85,
    ior: 1.4,
  });
  // Warm gold/champagne metal frame — completely distinct from grey mechanical
  const frameMat = new THREE.MeshStandardMaterial({
    color: 0xc9a84c,        // warm gold/champagne
    metalness: 0.8,
    roughness: 0.2,
  });
  const darkFrameMat = new THREE.MeshStandardMaterial({
    color: 0x8b7333,        // dark gold
    metalness: 0.7,
    roughness: 0.3,
  });
  // Bright gold LED material
  const ledMat = new THREE.MeshBasicMaterial({
    color: 0xffb347,        // warm amber/gold — NOT cyan/blue like everything else
    toneMapped: false,
    transparent: true,
    opacity: 0.9,
  });
  const railMat = new THREE.MeshStandardMaterial({
    color: 0xbfa55a,
    metalness: 0.8,
    roughness: 0.2,
  });

  // Two elevator shafts — prominent at front-right of building
  for (let i = 0; i < 2; i++) {
    const xPos = halfW - 2.5 - i * 4.2;  // slightly wider spacing
    const shaftH = totalH + 0.8;

    const shaft = new THREE.Group();
    shaft.position.set(xPos, 0, halfD - 0.5);
    shaft.name = `Elevator-${i}`;

    const shW = B.elevatorShaftW + 0.3;  // slightly wider
    const shD = B.elevatorShaftD + 0.3;

    // Glass walls — 4 sides, almost invisible to show the glowing cab
    const glassF = new THREE.Mesh(new THREE.BoxGeometry(shW, shaftH, 0.03), glassShaft);
    glassF.position.set(0, shaftH / 2, shD / 2);
    shaft.add(glassF);
    const glassB = new THREE.Mesh(new THREE.BoxGeometry(shW, shaftH, 0.03), glassShaft);
    glassB.position.set(0, shaftH / 2, -shD / 2);
    shaft.add(glassB);
    const glassL = new THREE.Mesh(new THREE.BoxGeometry(0.03, shaftH, shD), glassShaft);
    glassL.position.set(-shW / 2, shaftH / 2, 0);
    shaft.add(glassL);
    const glassR = new THREE.Mesh(new THREE.BoxGeometry(0.03, shaftH, shD), glassShaft);
    glassR.position.set(shW / 2, shaftH / 2, 0);
    shaft.add(glassR);

    // Gold corner extrusions — premium architectural detailing
    for (const [sx, sz] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) {
      const corner = new THREE.Mesh(
        new THREE.BoxGeometry(0.1, shaftH, 0.1),
        frameMat,
      );
      corner.position.set(sx * shW / 2, shaftH / 2, sz * shD / 2);
      shaft.add(corner);
    }

    // Warm gold LED vertical strips along all 4 front corners
    // Makes the elevator instantly identifiable as a premium glass lift
    for (const [ledX, ledZ] of [
      [-shW / 2 + 0.08, shD / 2],
      [shW / 2 - 0.08, shD / 2],
    ]) {
      const ledStrip = new THREE.Mesh(
        new THREE.BoxGeometry(0.03, shaftH * 0.8, 0.03),
        ledMat,
      );
      ledStrip.position.set(ledX, shaftH * 0.5 + B.podiumH, ledZ + 0.05);
      shaft.add(ledStrip);
    }

    // Guide rails — gold tone
    for (const [rx, rz] of [[-0.6, -0.6], [-0.6, 0.6], [0.6, -0.6], [0.6, 0.6]]) {
      const rail = new THREE.Mesh(
        new THREE.BoxGeometry(0.03, shaftH * 0.85, 0.03),
        railMat,
      );
      rail.position.set(rx, shaftH / 2 + 0.3, rz);
      shaft.add(rail);
    }

    // ── Elevator cables (barely visible thin strands) ──
    for (let ci = 0; ci < 3; ci++) {
      const cx = -0.3 + ci * 0.3;
      const cable = new THREE.Mesh(
        new THREE.CylinderGeometry(0.008, 0.008, shaftH, 4),
        new THREE.MeshStandardMaterial({ color: 0x8b7333, metalness: 0.8, roughness: 0.3 }),
      );
      cable.position.set(cx, shaftH / 2, 0);
      shaft.add(cable);
    }

    // ── Top decorative crown — elegant glass+framed cap, NOT a boxy machine room ──
    // This replaces the mechanical-looking machine room with an architectural feature
    const crownMat = new THREE.MeshPhysicalMaterial({
      color: 0xd4e8ff,
      metalness: 0.1,
      roughness: 0.02,
      transparent: true,
      opacity: 0.15,
      transmission: 0.6,
      side: THREE.DoubleSide,
    });
    // Crown glass enclosure
    const crown = new THREE.Mesh(
      new THREE.BoxGeometry(shW + 0.3, 0.8, shD + 0.3),
      crownMat,
    );
    crown.position.set(0, shaftH + 0.4, 0);
    shaft.add(crown);
    // Crown gold trim
    for (const edge of [
      [-1, -1], [-1, 1], [1, -1], [1, 1],
    ]) {
      const trim = new THREE.Mesh(
        new THREE.BoxGeometry(0.08, 0.8, 0.08),
        frameMat,
      );
      trim.position.set(edge[0] * (shW / 2 + 0.15), shaftH + 0.4, edge[1] * (shD / 2 + 0.15));
      shaft.add(trim);
    }
    // Crown top accent light
    const crownLight = new THREE.Mesh(
      new THREE.BoxGeometry(shW - 0.2, 0.04, shD - 0.2),
      new THREE.MeshBasicMaterial({ color: 0xffb347, toneMapped: false, transparent: true, opacity: 0.6 }),
    );
    crownLight.position.set(0, shaftH + 0.8, 0);
    shaft.add(crownLight);

    // ── Floor-level door frames — gold tone ──
    for (let f = 0; f < B.floorCount; f++) {
      const y = B.podiumH + f * B.floorH + B.floorH / 2 - 0.3;

      // Door frame
      const doorFrame = new THREE.Mesh(
        new THREE.BoxGeometry(1.6, 2.8, 0.05),
        darkFrameMat,
      );
      doorFrame.position.set(0, y, shD / 2 + 0.04);
      shaft.add(doorFrame);

      // Door gap (center slit)
      const doorGap = new THREE.Mesh(
        new THREE.BoxGeometry(0.02, 2.6, 0.06),
        new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.2 }),
      );
      doorGap.position.set(0, y, shD / 2 + 0.07);
      shaft.add(doorGap);

      // Floor number display — bright amber LED digits
      const floorNumMat = new THREE.MeshBasicMaterial({
        color: 0xffb347,
        toneMapped: false,
        transparent: true,
        opacity: 0.9,
      });
      const floorDisplay = new THREE.Mesh(
        new THREE.BoxGeometry(0.4, 0.3, 0.02),
        floorNumMat,
      );
      floorDisplay.position.set(shW / 2 + 0.06, y + 0.4, shD / 2 + 0.05);
      shaft.add(floorDisplay);

      // Floor number "digit" dots (simulating a 7-segment display)
      for (let di = 0; di < 3; di++) {
        const dot = new THREE.Mesh(
          new THREE.BoxGeometry(0.02, 0.08, 0.02),
          floorNumMat,
        );
        dot.position.set(
          shW / 2 + 0.06 + 0.08 * (di - 1),
          y + 0.04,
          shD / 2 + 0.07,
        );
        shaft.add(dot);
      }
    }

    // ── Floor divider bands ──
    for (let f = 0; f <= B.floorCount; f++) {
      const y = B.podiumH + f * B.floorH;
      const band = new THREE.Mesh(
        new THREE.BoxGeometry(shW + 0.2, 0.04, shD + 0.2),
        frameMat,
      );
      band.position.set(0, y, 0);
      shaft.add(band);
    }

    // ── ELEVATOR label sprite at the base (premium gold branding) ──
    const elevLabelCanvas = document.createElement("canvas");
    elevLabelCanvas.width = 256;
    elevLabelCanvas.height = 48;
    const elCtx = elevLabelCanvas.getContext("2d")!;
    elCtx.fillStyle = "#1a1410";  // warm dark brown
    elCtx.beginPath();
    elCtx.roundRect(4, 4, 248, 40, 20);
    elCtx.fill();
    // Gold border
    elCtx.strokeStyle = "#c9a84c";
    elCtx.lineWidth = 2;
    elCtx.beginPath();
    elCtx.roundRect(6, 6, 244, 36, 18);
    elCtx.stroke();
    elCtx.fillStyle = "#ffb347";
    elCtx.font = "bold 26px system-ui, -apple-system, sans-serif";
    elCtx.textAlign = "center";
    elCtx.textBaseline = "middle";
    elCtx.fillText("✦ ELEVATOR ✦", 128, 26);
    const elevLabelTex = new THREE.CanvasTexture(elevLabelCanvas);
    elevLabelTex.minFilter = THREE.LinearFilter;
    const elevLabel = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: elevLabelTex, transparent: true, depthTest: false }),
    );
    elevLabel.scale.set(3.5, 0.7, 1);
    elevLabel.position.set(0, B.podiumH + 0.1, shD / 2 + 0.5);
    shaft.add(elevLabel);

    // ─── CAB — super-visible with warm glow ───
    const cabGrp = new THREE.Group();
    const cabH = B.elevatorCabH + 0.2;
    // Cab body — translucent warm glass so glow shows through from all sides
    const cabBody = new THREE.Mesh(
      new THREE.BoxGeometry(B.elevatorCabW, cabH, B.elevatorCabD),
      new THREE.MeshPhysicalMaterial({
        color: 0xf5e6c8,      // warm cream — illuminated interior
        metalness: 0.05,
        roughness: 0.3,
        transparent: true,
        opacity: 0.35,         // semi-transparent so inner glow bleeds through
        side: THREE.DoubleSide,
      }),
    );
    cabBody.position.y = cabH / 2;
    cabBody.castShadow = true;
    cabGrp.add(cabBody);

    // Cab ceiling light panel (very bright)
    const cabLightPanel = new THREE.Mesh(
      new THREE.PlaneGeometry(1.4, 1.4),
      new THREE.MeshBasicMaterial({
        color: 0xfff8e1,
        transparent: true,
        opacity: 0.95,
        side: THREE.DoubleSide,
        toneMapped: false,
      }),
    );
    cabLightPanel.position.set(0, cabH - 0.04, 0);
    cabLightPanel.rotation.x = -Math.PI / 2;
    cabGrp.add(cabLightPanel);

    // Cab gold LED base strip
    const ledBase = new THREE.Mesh(
      new THREE.BoxGeometry(B.elevatorCabW + 0.04, 0.05, B.elevatorCabD + 0.04),
      new THREE.MeshBasicMaterial({
        color: 0xffb347,
        toneMapped: false,
        transparent: true,
        opacity: 0.8,
      }),
    );
    ledBase.position.y = 0.08;
    cabGrp.add(ledBase);

    // ── MAJOR: Warm glow that EXTENDS BEYOND the cab — visible through shaft glass ──
    // These use AdditiveBlending so they show through ANYTHING in front, including
    // the semi-transparent cab body and the shaft glass walls.
    
    // Large outer glow sphere — extends past cab front face
    const warmGlow = new THREE.Mesh(
      new THREE.SphereGeometry(1.1, 16, 14),
      new THREE.MeshBasicMaterial({
        color: 0xffaa33,
        transparent: true,
        opacity: 0.55,
        toneMapped: false,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    warmGlow.position.set(0, cabH * 0.45, B.elevatorCabD / 2 + 0.3);  // PROTRUDES past cab front
    cabGrp.add(warmGlow);
    
    // Secondary warm glow — centered inside cab
    const midGlow = new THREE.Mesh(
      new THREE.SphereGeometry(0.75, 14, 12),
      new THREE.MeshBasicMaterial({
        color: 0xffcc44,
        transparent: true,
        opacity: 0.65,
        toneMapped: false,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    midGlow.position.set(0, cabH * 0.5, B.elevatorCabD / 4);  // toward front
    cabGrp.add(midGlow);

    // Bright inner core glow
    const innerGlow = new THREE.Mesh(
      new THREE.SphereGeometry(0.4, 12, 10),
      new THREE.MeshBasicMaterial({
        color: 0xffee66,
        transparent: true,
        opacity: 0.85,
        toneMapped: false,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    innerGlow.position.set(0, cabH * 0.5, B.elevatorCabD / 3);
    cabGrp.add(innerGlow);

    // ── Real PointLight inside the cab — casts warm light onto shaft glass ──
    const cabPointLight = new THREE.PointLight(0xffaa33, 0.8, 8);
    cabPointLight.position.set(0, cabH * 0.5, 0);
    cabGrp.add(cabPointLight);

    // Front glass panel (transparent) instead of opaque cab door
    const frontGlassMat = new THREE.MeshPhysicalMaterial({
      color: 0xffdd99,
      metalness: 0.05,
      roughness: 0.1,
      transparent: true,
      opacity: 0.2,
      side: THREE.DoubleSide,
      envMapIntensity: 0.5,
    });
    const cabFront = new THREE.Mesh(
      new THREE.BoxGeometry(1.6, cabH * 0.8, 0.02),
      frontGlassMat,
    );
    cabFront.position.set(0, cabH * 0.4, B.elevatorCabD / 2 + 0.01);
    cabGrp.add(cabFront);

    // Door center slit (subtle)
    const doorSlit = new THREE.Mesh(
      new THREE.BoxGeometry(0.015, cabH * 0.6, 0.03),
      new THREE.MeshBasicMaterial({ color: 0x553322, transparent: true, opacity: 0.3 }),
    );
    doorSlit.position.set(0, cabH * 0.4, B.elevatorCabD / 2 + 0.03);
    cabGrp.add(doorSlit);

    // Cab handrail inside (gold bar visible through glass)
    const handrail = new THREE.Mesh(
      new THREE.CylinderGeometry(0.025, 0.025, B.elevatorCabW - 0.2, 8),
      new THREE.MeshStandardMaterial({ color: 0xc9a84c, metalness: 0.8, roughness: 0.2 }),
    );
    handrail.rotation.z = Math.PI / 2;
    handrail.position.set(0, cabH * 0.3, B.elevatorCabD / 2 - 0.1);
    cabGrp.add(handrail);

    // Cab position
    const bottomY = B.podiumH + 0.8;
    const topY = B.podiumH + (B.floorCount - 0.5) * B.floorH - cabH;
    cabGrp.position.y = bottomY;
    shaft.add(cabGrp);
    group.add(shaft);

    cabs.push({
      group: cabGrp,
      bottomY,
      topY,
      phase: i * Math.PI + (i === 1 ? Math.PI / 2 : 0),
    });
  }

  return { group, cabs };
}

// ─── Escalators (atrium circulation) ──────────────────────────────
function buildEscalators(): THREE.Group {
  const group = new THREE.Group();
  group.name = "Escalators";
  const halfD = B.towerD / 2;

  const stepMat = new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.5, roughness: 0.4 });
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0x94a3b8, metalness: 0.1, roughness: 0.05,
    transparent: true, opacity: 0.2, side: THREE.DoubleSide,
  });
  const railMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.7, roughness: 0.2 });

  // Two escalator banks crossing the atrium from ground to upper floor
  for (let bank = 0; bank < 2; bank++) {
    const side = bank === 0 ? -1 : 1;
    const esGroup = new THREE.Group();
    esGroup.name = `Escalator-${bank}`;

    // Escalator truss (inclined bridge)
    const trussLen = 14;
    const trussH = 2.0;
    const incline = 0.3; // radians
    const xPos = side * 3.0;
    const yBot = B.podiumH + 0.2;
    const yTop = B.podiumH + B.floorH / 2;

    // Main truss beam
    const truss = new THREE.Mesh(
      new THREE.BoxGeometry(trussLen, trussH, 1.6),
      new THREE.MeshStandardMaterial({ color: 0x9ca3af, metalness: 0.4, roughness: 0.5 }),
    );
    truss.position.set(xPos, (yBot + yTop) / 2, halfD - 3);
    // Tilt the truss
    truss.rotation.z = side * incline;
    truss.castShadow = true;
    esGroup.add(truss);

    // Glass balustrade panels on each side
    for (const gz of [-0.85, 0.85]) {
      const balustrade = new THREE.Mesh(
        new THREE.BoxGeometry(trussLen * 0.9, 1.0, 0.04),
        glassMat,
      );
      balustrade.position.set(xPos, (yBot + yTop) / 2 + trussH / 2, halfD - 3 + gz);
      balustrade.rotation.z = side * incline;
      esGroup.add(balustrade);
    }

    // Handrail (thin cylinder along the top edge)
    for (const hz of [-0.82, 0.82]) {
      const handrail = new THREE.Mesh(
        new THREE.CylinderGeometry(0.025, 0.025, trussLen * 0.9, 6),
        railMat,
      );
      handrail.position.set(xPos, (yBot + yTop) / 2 + trussH / 2 + 0.5, halfD - 3 + hz);
      handrail.rotation.z = side * Math.PI / 2;
      esGroup.add(handrail);
    }

    // Step treads visible along the inclined surface
    const stepCount = 20;
    for (let s = 0; s < stepCount; s++) {
      const t = s / stepCount;
      const sx = xPos;
      const sy = yBot + t * (yTop - yBot);
      const sz = halfD - 3 + 0.5;
      const step = new THREE.Mesh(
        new THREE.BoxGeometry(1.2, 0.04, 0.3),
        stepMat,
      );
      step.position.set(sx, sy + trussH / 2 + 0.02, sz);
      step.rotation.z = side * incline * 0.5;
      step.castShadow = true;
      esGroup.add(step);
    }

    group.add(esGroup);
  }

  return group;
}

// ─── Stairwells (4 corners) ─────────────────────────────────────
function buildStairwells(): THREE.Group {
  const group = new THREE.Group();
  group.name = "Stairwells";
  const totalH = B.podiumH + B.floorH * B.floorCount;
  const halfW = B.towerW / 2;
  const halfD = B.towerD / 2;
  const sw = B.stairwellW;
  const sd = B.stairwellD;

  const wallMat = new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.4, roughness: 0.6 });
  const treadMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.3, roughness: 0.5 });

  // 4 corners — inset from the wider building edges
  const inset = 0.8;
  const corners = [
    [-halfW + inset, -halfD + inset],
    [halfW - inset, -halfD + inset],
    [-halfW + inset, halfD - inset * 0.5],
    [halfW - inset * 0.5, halfD - inset],
  ] as const;

  for (const [cx, cz] of corners) {
    const stair = new THREE.Group();
    stair.position.set(cx, 0, cz);
    stair.name = `Stairwell@${cx},${cz}`;

    // Shaft walls (solid, with a vertical slit for a window)
    const wallBack = new THREE.Mesh(new THREE.BoxGeometry(sw, totalH, 0.06), wallMat);
    wallBack.position.set(0, totalH / 2, -sd / 2);
    wallBack.castShadow = true;
    stair.add(wallBack);

    const wallSide = new THREE.Mesh(new THREE.BoxGeometry(0.06, totalH, sd), wallMat);
    wallSide.position.set(-sw / 2, totalH / 2, 0);
    wallSide.castShadow = true;
    stair.add(wallSide);

    // Window slit on the other side (glass)
    const windowMat = new THREE.MeshPhysicalMaterial({
      color: 0x88ccff, transparent: true, opacity: 0.15,
      metalness: 0.1, roughness: 0.05,
    });
    const win = new THREE.Mesh(new THREE.BoxGeometry(0.03, totalH * 0.7, sd * 0.6), windowMat);
    win.position.set(sw / 2 + 0.02, B.podiumH + totalH * 0.35, 0);
    stair.add(win);

    // Open side (front) — no wall, visible from interior

    // Stair treads (visible through the open side)
    const treadCount = Math.floor(totalH / B.stairRiserH);
    for (let t = 0; t < treadCount; t++) {
      const tread = new THREE.Mesh(
        new THREE.BoxGeometry(sw * 0.6, B.stairTreadT, sd * 0.4),
        treadMat,
      );
      const y = t * B.stairRiserH;
      // Zigzag: alternating position so it looks like stairs
      const zOff = (t % 2 === 0 ? -0.25 : 0.25);
      tread.position.set(-sw * 0.15, y + B.stairTreadT / 2, zOff);
      tread.castShadow = true;
      stair.add(tread);
    }

    // Floor landing markers
    for (let f = 0; f <= B.floorCount; f++) {
      const y = B.podiumH + f * B.floorH;
      const landing = new THREE.Mesh(
        new THREE.BoxGeometry(sw * 0.5, 0.04, sd * 0.4),
        new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.5, roughness: 0.4 }),
      );
      landing.position.set(-sw * 0.15, y + 0.02, 0);
      stair.add(landing);
    }

    group.add(stair);
  }

  return group;
}

// ─── Ceiling grid lights (recessed emissive panels per floor) ──
function buildCeilingLights(): THREE.Group {
  const group = new THREE.Group();
  group.name = "CeilingLights";
  const lightMat = new THREE.MeshBasicMaterial({
    color: 0xfffde7,
    transparent: true,
    opacity: 0.2,
    side: THREE.DoubleSide,
    toneMapped: false,
  });

  for (let f = 0; f < B.floorCount; f++) {
    const yBase = B.podiumH + f * B.floorH;
    const ceilY = yBase + B.floorH - 0.04;
    const halfW = B.towerW / 2 - 2;
    const halfD = B.towerD / 2 - 2;
    const cols = B.lightPanelCols;
    const rows = B.lightPanelRows;

    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows; r++) {
        const x = c === 0 ? -halfW : c === cols - 1 ? halfW : -halfW + (halfW * 2 / (cols - 1)) * c;
        const z = r === 0 ? -halfD : r === rows - 1 ? halfD : -halfD + (halfD * 2 / (rows - 1)) * r;
        const panel = new THREE.Mesh(
          new THREE.PlaneGeometry(B.lightPanelW, B.lightPanelD),
          lightMat,
        );
        panel.position.set(x, ceilY, z);
        panel.rotation.x = -Math.PI / 2;
        group.add(panel);
      }
    }
  }

  return group;
}

// ─── Interior partitions — exhibition hall layout ───────────────
// Large column-free exhibition spaces divided by movable partitions,
// back-of-house corridors, and meeting room walls.
function buildInteriorWalls(): THREE.Group {
  const group = new THREE.Group();
  group.name = "InteriorWalls";
  const halfW = B.towerW / 2;
  const halfD = B.towerD / 2;

  const wallMat = new THREE.MeshStandardMaterial({
    color: 0xf1f5f9,
    roughness: 0.8,
    metalness: 0.05,
    transparent: true,
    opacity: 0.35,
  });
  const partitionMat = new THREE.MeshStandardMaterial({
    color: 0xdbeafe,
    roughness: 0.6,
    metalness: 0.1,
    transparent: true,
    opacity: 0.2,
  });
  const frameMat = new THREE.MeshStandardMaterial({
    color: 0x475569,
    metalness: 0.5,
    roughness: 0.3,
  });

  for (let f = 0; f < B.floorCount; f++) {
    const yBase = B.podiumH + f * B.floorH;

    // ── Exhibition hall dividers (movable partition wall look) ──
    // Convention centres have movable walls to subdivide halls.
    // We create 3 exhibition bays per floor.
    for (let bay = -1; bay <= 1; bay += 2) {
      // Hall divider wall (x-direction)
      const divW = new THREE.Mesh(
        new THREE.BoxGeometry(halfD * 1.5, B.interiorWallH, B.interiorWallT),
        partitionMat,
      );
      divW.position.set(bay * halfW * 0.55, yBase + 1.5 + B.interiorWallH / 2, -1);
      divW.castShadow = true;
      group.add(divW);
    }

    // ── Back-of-house corridor wall (near the back of the hall) ──
    const bohWall = new THREE.Mesh(
      new THREE.BoxGeometry(halfW * 1.5, B.interiorWallH, B.interiorWallT),
      wallMat,
    );
    bohWall.position.set(0, yBase + 1.5 + B.interiorWallH / 2, -halfD + 3);
    bohWall.castShadow = true;
    group.add(bohWall);

    // ── Meeting room / office walls at the back corners ──
    for (const [cx] of [[-1], [1]] as const) {
      const sideWall = new THREE.Mesh(
        new THREE.BoxGeometry(B.interiorWallT, B.interiorWallH, 3),
        wallMat,
      );
      sideWall.position.set(cx * (halfW - 4), yBase + 1.5 + B.interiorWallH / 2, -halfD + 3.5);
      sideWall.castShadow = true;
      group.add(sideWall);

      const frontWall = new THREE.Mesh(
        new THREE.BoxGeometry(4, B.interiorWallH, B.interiorWallT),
        wallMat,
      );
      frontWall.position.set(cx * (halfW - 4), yBase + 1.5 + B.interiorWallH / 2, -halfD + 6);
      frontWall.castShadow = true;
      group.add(frontWall);
    }

    // ── Service core walls (elevator lobby area) ──
    const coreWall = new THREE.Mesh(
      new THREE.BoxGeometry(4, B.interiorWallH, B.interiorWallT),
      wallMat,
    );
    coreWall.position.set(halfW - 8, yBase + 1.5 + B.interiorWallH / 2, halfD - 3);
    coreWall.castShadow = true;
    group.add(coreWall);
  }

  return group;
}

// ─── Rooftop equipment (low profile, sits between sawtooth ridges) ──
function buildEnhancedRooftop(): THREE.Group {
  const group = new THREE.Group();
  group.name = "RooftopEquipment";
  const roofBaseY = B.podiumH + B.floorH * B.floorCount + B.roofRidgeH;
  const halfW = B.towerW / 2;
  const halfD = B.towerD / 2;

  const mechMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.4, roughness: 0.5 });
  const fanMat = new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.6, roughness: 0.3 });

  // Cooling towers (low profile, between ridge valleys)
  for (const [x, z] of [[-3, -4], [3, -4]] as const) {
    const ct = new THREE.Group();
    ct.position.set(x, roofBaseY, z);

    // Main body
    const base = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.2, 1.8), mechMat);
    base.position.y = 0.6;
    base.castShadow = true;
    ct.add(base);

    // Top fan cowl
    const fanCyl = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.8, 0.3, 16), fanMat);
    fanCyl.position.y = 1.4;
    ct.add(fanCyl);

    // Intake grille (thin strip near base)
    const grille = new THREE.Mesh(
      new THREE.BoxGeometry(1.9, 0.04, 1.9),
      new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.5, roughness: 0.4 }),
    );
    grille.position.y = 0.1;
    ct.add(grille);

    group.add(ct);
  }

  // Exhaust fans (spread out along the roof edges)
  const fanPositions = [[-8, 3], [8, 3], [-7, -2], [7, -2]] as const;
  for (const [fx, fz] of fanPositions) {
    const fan = new THREE.Group();
    fan.position.set(fx, roofBaseY, fz);
    const fanBase = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.55, 0.5, 12), fanMat);
    fanBase.position.y = 0.25;
    fanBase.castShadow = true;
    fan.add(fanBase);
    const fanCowl = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.4, 0.2, 12), fanMat);
    fanCowl.position.y = 0.6;
    fan.add(fanCowl);
    group.add(fan);
  }

  // Pipe runs connecting equipment
  const pipeMat = new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.7, roughness: 0.2 });
  const pipePoints = [[-3, -4, 3, -4], [-3, -4, -8, 3], [3, -4, 8, 3]] as const;
  for (const [x1, z1, x2, z2] of pipePoints) {
    const dx = x2 - x1;
    const dz = z2 - z1;
    const len = Math.sqrt(dx * dx + dz * dz);
    if (len < 0.1) continue;
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, len, 8), pipeMat);
    pipe.position.set((x1 + x2) / 2, roofBaseY + 0.1, (z1 + z2) / 2);
    pipe.rotation.x = Math.PI / 2;
    pipe.rotation.z = Math.atan2(dz, -dx);
    group.add(pipe);
  }

  return group;
}

// ─── Exposed HVAC ductwork + VAV boxes + ceiling diffusers ──────
// Convention centres have exposed ductwork visible in ceiling voids
// and on the roof. Ducts run from rooftop equipment down through
// shafts and across the ceiling of each exhibition hall.
function buildHVAC(): THREE.Group {
  const group = new THREE.Group();
  group.name = "HVAC";
  const halfW = B.towerW / 2;
  const halfD = B.towerD / 2;
  const totalH = B.podiumH + B.floorH * B.floorCount;

  const ductMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.5, roughness: 0.4 });
  const insulMat = new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.3, roughness: 0.7 });
  const vavMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.6, roughness: 0.3 });
  const diffuserMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.4, roughness: 0.5 });
  const flexMat = new THREE.MeshStandardMaterial({ color: 0x9ca3af, metalness: 0.3, roughness: 0.6 });

  // ── Rooftop ductwork ──
  // Horizontal trunk ducts connecting RTU/equipment to vertical shafts
  for (const [x, z] of [[-2, 1], [2, 1], [-5, -3], [5, -3]] as const) {
    const dh = 0.25;
    const dw = 0.4;
    const dl = 4 + Math.random() * 3;
    const duct = new THREE.Mesh(
      new THREE.BoxGeometry(dw, dh, dl),
      ductMat,
    );
    duct.position.set(x, totalH + 0.8, z);
    duct.castShadow = true;
    group.add(duct);
  }

  // Vertical duct shafts from roof to each floor ceiling void
  for (let f = 0; f < B.floorCount; f++) {
    const yBase = B.podiumH + f * B.floorH;
    const ceilY = yBase + B.floorH - 0.6;

    // Main supply duct running lengthwise down the centre of the hall
    const mainDuct = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.3, halfD * 1.2),
      ductMat,
    );
    mainDuct.position.set(0, ceilY, 0);
    mainDuct.castShadow = true;
    group.add(mainDuct);

    // Insulated duct sections
    for (let i = -1; i <= 1; i += 2) {
      const insul = new THREE.Mesh(
        new THREE.BoxGeometry(0.6, 0.35, halfD * 0.5),
        insulMat,
      );
      insul.position.set(i * 3, ceilY + 0.02, -halfD * 0.25);
      group.add(insul);
    }

    // ── Duct branches (lateral runs to each zone) ──
    for (let z = -halfD + 2; z <= halfD - 2; z += 3) {
      for (const side of [-1, 1]) {
        const branch = new THREE.Mesh(
          new THREE.BoxGeometry(3, 0.15, 0.25),
          flexMat,
        );
        branch.position.set(side * halfW * 0.35, ceilY + 0.05, z);
        group.add(branch);
      }
    }

    // ── VAV boxes (metal boxes where branch ducts meet main) ──
    const vavPositions = [
      [-4, -halfD * 0.3], [4, -halfD * 0.3],
      [-4, halfD * 0.3], [4, halfD * 0.3],
      [-2, -halfD * 0.6], [2, halfD * 0.6],
    ] as const;
    for (const [vx, vz] of vavPositions) {
      const vav = new THREE.Mesh(
        new THREE.BoxGeometry(0.5, 0.35, 0.6),
        vavMat,
      );
      vav.position.set(vx, ceilY + 0.05, vz);
      vav.castShadow = true;
      group.add(vav);

      // Small control box on top
      const ctrl = new THREE.Mesh(
        new THREE.BoxGeometry(0.15, 0.08, 0.15),
        new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.3, roughness: 0.4 }),
      );
      ctrl.position.set(vx, ceilY + 0.22, vz);
      group.add(ctrl);
    }

    // ── Ceiling diffusers (linear slot diffusers in ceiling grid) ──
    const diffCols = Math.floor(halfW / 3);
    const diffRows = Math.floor(halfD / 3);
    for (let dc = 0; dc < diffCols; dc++) {
      for (let dr = 0; dr < diffRows; dr++) {
        const x = -halfW + 3 + dc * 5;
        const z = -halfD + 3 + dr * 5;
        if (Math.abs(x) < 2 && Math.abs(z) < 2) continue; // skip centre (main duct)
        // Linear diffuser strip
        const diff = new THREE.Mesh(
          new THREE.BoxGeometry(0.8, 0.03, 0.06),
          diffuserMat,
        );
        diff.position.set(x, ceilY - 0.02, z);
        group.add(diff);
        // Second parallel slot
        const diff2 = diff.clone();
        diff2.position.set(x, ceilY - 0.02, z + 0.12);
        group.add(diff2);
      }
    }
  }

  return group;
}

// ─── Component ────────────────────────────────────────────────────
export interface DigitalTwinViewer3DProps {
  /** When false, the viewer hides all asset markers (used on the homepage). */
  showMarkers?: boolean;
  /** When true, the camera slowly orbits the building. */
  autoRotate?: boolean;
}

export function DigitalTwinViewer3D({
  showMarkers = true,
  autoRotate = false,
}: DigitalTwinViewer3DProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneStateRef = useRef<{
    renderer?: THREE.WebGLRenderer;
    scene?: THREE.Scene;
    camera?: THREE.PerspectiveCamera;
    controls?: OrbitControls;
    handles?: MarkerHandles[];
    elevatorCabs?: ElevatorCabAnim[];
    raycaster?: THREE.Raycaster;
    pointer?: THREE.Vector2;
    rafId?: number;
    resizeObserver?: ResizeObserver;
    hoverId?: string | null;
    clock?: THREE.Clock;
  }>({});

  const [hoveredAsset, setHoveredAsset] = useState<Asset | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(
    null,
  );

  const {
    selectedFloor,
    selectedType,
    selectedAsset,
    assetStatuses,
    setSelectedFloor,
    setSelectedType,
    setSelectedAsset,
  } = useViewerStore();

  /** Ref to assetStatuses so the animation loop can read the latest values. */
  const statusMapRef = useRef<Record<string, AssetStatus>>({});
  statusMapRef.current = assetStatuses;

  /** Resolve the effective status: live override from WebSocket, or default. */
  function getLiveStatus(asset: Asset): AssetStatus {
    return assetStatuses[asset.id] ?? asset.status;
  }

  // ─── Mount Three.js scene ───
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const W = mount.clientWidth || 800;
    const H = mount.clientHeight || 640;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(W, H);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setClearColor(FOG.color, 1);
    mount.appendChild(renderer.domElement);
    renderer.domElement.style.cursor = "grab";

    // Scene (light theme — matches dashboard bg)
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(FOG.color);
    scene.fog = new THREE.Fog(FOG.color, FOG.near, FOG.far);

    // Camera
    const camera = new THREE.PerspectiveCamera(CAM.fov, W / H, CAM.near, CAM.far);
    camera.position.set(...CAM.defaultPosition);
    camera.lookAt(...CAM.defaultTarget);

    // OrbitControls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = CAM.dampingFactor;
    controls.minPolarAngle = CAM.minPolarAngle;
    controls.maxPolarAngle = CAM.maxPolarAngle;
    controls.minDistance = CAM.minDistance;
    controls.maxDistance = CAM.maxDistance;
    controls.target.set(...CAM.defaultTarget);
    controls.autoRotate = autoRotate;
    controls.autoRotateSpeed = CAM.autoRotateSpeed;

    // Lights
    scene.add(
      new THREE.AmbientLight(LIGHT.ambient.color, LIGHT.ambient.intensity),
    );
    const sun = new THREE.DirectionalLight(LIGHT.sun.color, LIGHT.sun.intensity);
    sun.position.set(...LIGHT.sun.position);
    sun.castShadow = true;
    sun.shadow.mapSize.set(LIGHT.shadow.mapSize, LIGHT.shadow.mapSize);
    sun.shadow.camera.left = -LIGHT.shadow.bounds;
    sun.shadow.camera.right = LIGHT.shadow.bounds;
    sun.shadow.camera.top = LIGHT.shadow.bounds;
    sun.shadow.camera.bottom = -LIGHT.shadow.bounds;
    sun.shadow.camera.near = LIGHT.shadow.near;
    sun.shadow.camera.far = LIGHT.shadow.far;
    scene.add(sun);
    const fill = new THREE.DirectionalLight(
      LIGHT.fill.color,
      LIGHT.fill.intensity,
    );
    fill.position.set(...LIGHT.fill.position);
    scene.add(fill);

    // Building
    const building = buildBuilding();
    scene.add(building);

    // Elevators (with animated cabs)
    const elevatorData = buildElevators();
    scene.add(elevatorData.group);

    // Escalators (atrium circulation)
    scene.add(buildEscalators());

    // Stairwells
    scene.add(buildStairwells());

    // Ceiling grid lights
    scene.add(buildCeilingLights());

    // Interior partitions (exhibition hall layout)
    scene.add(buildInteriorWalls());

    // Enhanced rooftop equipment
    scene.add(buildEnhancedRooftop());

    // Exposed HVAC ductwork + VAV boxes + ceiling diffusers
    scene.add(buildHVAC());

    // Markers (only when showMarkers=true)
    const handles = showMarkers ? SEED_ASSETS.map(buildMarker) : [];
    handles.forEach((h) => scene.add(h.group));

    // Raycaster
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const clock = new THREE.Clock();

    // ResizeObserver
    const resizeObserver = new ResizeObserver(() => {
      const w = mount.clientWidth;
      const h = mount.clientHeight;
      if (w === 0 || h === 0) return;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    });
    resizeObserver.observe(mount);

    // Pointer handlers
    const onPointerMove = (e: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      setTooltipPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    };
    const onClick = () => {
      if (!showMarkers || handles.length === 0) return;
      raycaster.setFromCamera(pointer, camera);
      const intersects: { handle: MarkerHandles; distance: number }[] = [];
      handles.forEach((h) => {
        // Skip invisible markers
        if (!h.group.visible) return;
        const hits = raycaster.intersectObject(h.group, true);
        // Filter out label sprite + glow sphere hits (we want body/ring)
        const bodyHit = hits.find(
          (hit) =>
            hit.object !== h.label &&
            hit.object !== h.glow,
        );
        if (bodyHit) {
          intersects.push({ handle: h, distance: bodyHit.distance });
        }
      });
      if (intersects.length > 0) {
        intersects.sort((a, b) => a.distance - b.distance);
        const hit = intersects[0].handle;
        const asset = hit.group.userData.asset as Asset;
        setSelectedAsset(asset);
      } else {
        setSelectedAsset(null);
      }
    };
    const onPointerDown = () => {
      renderer.domElement.style.cursor = "grabbing";
    };
    const onPointerUp = () => {
      renderer.domElement.style.cursor = "grab";
    };
    renderer.domElement.addEventListener("pointermove", onPointerMove);
    renderer.domElement.addEventListener("pointerdown", onPointerDown);
    renderer.domElement.addEventListener("pointerup", onPointerUp);
    renderer.domElement.addEventListener("click", onClick);

    // Animation loop
    let rafId = 0;
    const animate = () => {
      rafId = requestAnimationFrame(animate);
      const dt = clock.getDelta();
      const t = clock.getElapsedTime();

      if (showMarkers && handles.length > 0) {
        // Raycast for hover
        raycaster.setFromCamera(pointer, camera);
        let closestId: string | null = null;
        let closestDist = Infinity;
        handles.forEach((h) => {
          if (!h.group.visible) return;
          const hits = raycaster.intersectObject(h.group, true);
          const bodyHit = hits.find(
            (hit) => hit.object !== h.label && hit.object !== h.glow,
          );
          if (bodyHit && bodyHit.distance < closestDist) {
            closestDist = bodyHit.distance;
            closestId = h.group.userData.assetId as string;
          }
        });
        if (closestId !== sceneStateRef.current.hoverId) {
          sceneStateRef.current.hoverId = closestId;
          const hovered = closestId
            ? (handles.find((h) => h.group.userData.assetId === closestId)?.group
                .userData.asset as Asset | undefined) ?? null
            : null;
          setHoveredAsset(hovered);
          renderer.domElement.style.cursor = hovered ? "pointer" : "grab";
        }

        // Animate each marker
        handles.forEach((h) => {
          const asset = h.group.userData.asset as Asset;
          const isHovered = closestId === asset.id;

          // Float (Y position) on hover
          const targetY = h.baseY + (isHovered ? 0.2 : 0);
          h.group.position.y += (targetY - h.group.position.y) * 0.15;

          // Fan blade rotation (RAF)
          if (h.blades) {
            h.blades.rotation.y += dt * 4;
          }

          // Fault glow pulse (sin wave)
          if (h.isFault) {
            const pulse = 0.15 + Math.sin(t * 3) * 0.08;
            (h.glow.material as THREE.MeshBasicMaterial).opacity = pulse;
            h.glow.scale.setScalar(1 + Math.sin(t * 3) * 0.1);
          }

          // Emissive highlight: selected > hover > none
          const bodyMat = h.body.material as THREE.MeshStandardMaterial;
          const liveStatus = statusMapRef.current[asset.id] ?? asset.status;
          if (selectedAsset && selectedAsset.id === asset.id) {
            bodyMat.emissive.setHex(STATUS_HEX_INT[liveStatus]);
            bodyMat.emissiveIntensity = 0.6;
          } else if (isHovered) {
            bodyMat.emissive.setHex(TYPE_HEX_INT[asset.type]);
            bodyMat.emissiveIntensity = 0.25;
          } else {
            bodyMat.emissive.setHex(0x000000);
            bodyMat.emissiveIntensity = 0;
          }
        });
      }

      // Animate elevator cabs
      const eCabs = sceneStateRef.current.elevatorCabs;
      if (eCabs) {
        for (const cab of eCabs) {
          const cycle = (Math.sin(t * 0.5 + cab.phase) + 1) / 2;
          cab.group.position.y = cab.bottomY + cycle * (cab.topY - cab.bottomY);
        }
      }

      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    sceneStateRef.current = {
      renderer,
      scene,
      camera,
      controls,
      handles,
      elevatorCabs: elevatorData.cabs,
      raycaster,
      pointer,
      rafId,
      resizeObserver,
      clock,
    };

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener("pointermove", onPointerMove);
      renderer.domElement.removeEventListener("pointerdown", onPointerDown);
      renderer.domElement.removeEventListener("pointerup", onPointerUp);
      renderer.domElement.removeEventListener("click", onClick);
      controls.dispose();
      scene.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
        if (mesh.material) {
          const mats = Array.isArray(mesh.material)
            ? mesh.material
            : [mesh.material];
          mats.forEach((m) => {
            const tex = (m as THREE.MeshStandardMaterial).map;
            if (tex) tex.dispose();
            m.dispose();
          });
        }
        // Sprites carry a CanvasTexture on their material
        if ((obj as THREE.Sprite).isSprite) {
          const sp = obj as THREE.Sprite;
          const mat = sp.material as THREE.SpriteMaterial;
          if (mat.map) mat.map.dispose();
        }
      });
      renderer.dispose();
      if (renderer.domElement.parentNode === mount) {
        mount.removeChild(renderer.domElement);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showMarkers, autoRotate]);

  // Reset emissive on selectedAsset clear
  useEffect(() => {
    const s = sceneStateRef.current;
    if (!s.handles) return;
    if (selectedAsset) return; // animate loop handles it
    s.handles.forEach((h) => {
      const mat = h.body.material as THREE.MeshStandardMaterial;
      mat.emissive.setHex(0x000000);
      mat.emissiveIntensity = 0;
    });
  }, [selectedAsset]);

  // ─── Apply floor + type filters (group.visible = false) ───
  useEffect(() => {
    const s = sceneStateRef.current;
    if (!s.handles) return;
    s.handles.forEach((h) => {
      const asset = h.group.userData.asset as Asset;
      const floorOk = selectedFloor === "ALL" || asset.floor === selectedFloor;
      const typeOk = selectedType === "ALL" || asset.type === selectedType;
      h.group.visible = floorOk && typeOk;
    });
  }, [selectedFloor, selectedType, showMarkers]);

  // ─── Apply live asset status changes to Three.js markers ───
  useEffect(() => {
    const s = sceneStateRef.current;
    if (!s.handles) return;
    s.handles.forEach((h) => {
      const asset = h.group.userData.asset as Asset;
      const liveStatus = getLiveStatus(asset);

      // Update status ring color
      const newColor = STATUS_HEX_INT[liveStatus];
      const ringMat = h.ring.material as THREE.MeshStandardMaterial;
      ringMat.color.setHex(newColor);
      ringMat.emissive.setHex(newColor);

      // Update fault glow
      const isFault = liveStatus === "fault";
      h.isFault = isFault;
      const glowMat = h.glow.material as THREE.MeshBasicMaterial;
      glowMat.color.setHex(newColor);
      if (!isFault) {
        glowMat.opacity = 0;
        h.glow.scale.setScalar(1);
      }
      // If fault, the animation loop handles the pulse
    });
  }, [assetStatuses]);

  // ─── Filtered assets for status panel (live status aware) ───
  const visibleAssets = SEED_ASSETS.filter((a) => {
    const floorOk = selectedFloor === "ALL" || a.floor === selectedFloor;
    const typeOk = selectedType === "ALL" || a.type === selectedType;
    return floorOk && typeOk;
  });
  const counts = {
    operational: visibleAssets.filter((a) => getLiveStatus(a) === "operational").length,
    warning: visibleAssets.filter((a) => getLiveStatus(a) === "warning").length,
    fault: visibleAssets.filter((a) => getLiveStatus(a) === "fault").length,
    total: visibleAssets.length,
  };
  const alerts = visibleAssets.filter(
    (a) => {
      const s = getLiveStatus(a);
      return s === "warning" || s === "fault";
    },
  );

  // ─── Homepage: live counts ───
  return (
    <div
      ref={mountRef}
      className="w-full h-[640px] overflow-hidden relative"
      style={{ background: colors.bg.canvas, borderRadius: "1rem" }}
      data-testid="digital-twin-viewer-3d"
    >
      {/* ─── Floor selector (top-left) ─── */}
      {showMarkers && (
      <div
        className="absolute top-3 left-3 z-10 flex flex-col gap-1"
        data-testid="floor-selector"
      >
        {(["ALL", 0, 1, 2, 3] as FloorFilter[]).map((f) => {
          const active = selectedFloor === f;
          return (
            <button
              key={f}
              type="button"
              onClick={() => setSelectedFloor(f)}
              className="px-3 py-1.5 text-xs font-semibold transition-colors"
              style={{
                background: active ? colors.text.accent : colors.bg.surface,
                color: active ? "#ffffff" : colors.text.primary,
                border: `1px solid ${active ? colors.text.accent : colors.border.light}`,
                borderRadius: "1rem",
                backdropFilter: "blur(8px)",
                minWidth: "52px",
                boxShadow: shadow.sm,
              }}
            >
              {f === "ALL" ? "ALL" : floorLabel(f)}
            </button>
          );
        })}
      </div>
      )}

      {/* ─── Type legend (top-right, only when markers shown) ─── */}
      {showMarkers && (
        <div
          className="absolute top-3 right-3 z-10 flex flex-col gap-1 p-2"
          style={{
            background: colors.bg.surfaceTranslucent,
            border: colors.border.card,
            borderRadius: "1rem",
            backdropFilter: "blur(8px)",
            boxShadow: shadow.md,
          }}
          data-testid="type-legend"
        >
          {(
            ["ALL", "Air Handler", "Chiller", "Boiler", "Pump", "Fan"] as TypeFilter[]
          ).map((t) => {
            const active = selectedType === t;
            const color = t === "ALL" ? colors.text.primary : TYPE_HEX[t];
            return (
              <button
                key={t}
                type="button"
                onClick={() => setSelectedType(t)}
                className="flex items-center gap-2 px-2 py-1 text-xs font-medium transition-colors"
                style={{
                  background: active ? `${color}22` : "transparent",
                  color: active ? color : colors.text.secondary,
                  borderRadius: "0.5rem",
                  minWidth: "110px",
                  textAlign: "left",
                }}
              >
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full"
                  style={{ background: color }}
                />
                {t === "ALL" ? "All Types" : t}
              </button>
            );
          })}
        </div>
      )}

      {/* ─── Status panel (bottom-left, only when markers shown) ─── */}
      {showMarkers && (
        <div
          className="absolute bottom-3 left-3 z-10 p-3 w-[260px]"
          style={{
            background: colors.bg.surfaceTranslucent,
            border: colors.border.card,
            borderRadius: "1rem",
            backdropFilter: "blur(8px)",
            boxShadow: shadow.md,
          }}
          data-testid="status-panel"
        >
          <div
            className="text-[10px] uppercase tracking-[0.16em] mb-2"
            style={{ color: colors.text.secondary }}
          >
            Status
          </div>
          <div className="grid grid-cols-4 gap-2 mb-3">
            <StatPill label="OK" value={counts.operational} color={colors.status.operational} />
            <StatPill label="Warn" value={counts.warning} color={colors.status.warning} />
            <StatPill label="Fault" value={counts.fault} color={colors.status.fault} />
            <StatPill label="Total" value={counts.total} color={colors.text.secondary} />
          </div>
          <div
            className="text-[10px] uppercase tracking-[0.16em] mb-1"
            style={{ color: colors.text.secondary }}
          >
            Alerts
          </div>
          <div
            className="flex flex-col gap-1 overflow-y-auto pr-1"
            style={{ maxHeight: "160px" }}
          >
            {alerts.length === 0 ? (
              <div
                className="text-xs py-2 text-center"
                style={{ color: colors.text.muted }}
              >
                No active alerts
              </div>
            ) : (
              alerts.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setSelectedAsset(a)}
                  className="flex items-center gap-2 px-2 py-1.5 text-left transition-colors"
                  style={{
                    border: `1px solid ${STATUS_HEX[a.status]}33`,
                    background: `${STATUS_HEX[a.status]}0a`,
                    borderRadius: "0.5rem",
                  }}
                >
                  <span
                    className="inline-block h-1.5 w-1.5 rounded-full"
                    style={{ background: STATUS_HEX[a.status] }}
                  />
                  <span
                    className="text-xs font-medium flex-1 truncate"
                    style={{ color: colors.text.primary }}
                  >
                    {a.name}
                  </span>
                  <span
                    className="text-[10px]"
                    style={{ color: colors.text.secondary }}
                  >
                    {floorLabel(a.floor)}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {/* ─── Inspect panel (bottom-right, slides in) ─── */}
      {showMarkers && (
        <div
          className="absolute bottom-3 right-3 z-10 transition-all duration-300"
          style={{
            width: "300px",
            maxHeight: selectedAsset ? "520px" : "0",
            opacity: selectedAsset ? 1 : 0,
            transform: selectedAsset ? "translateY(0)" : "translateY(20px)",
            background: colors.bg.surfaceTranslucent,
            border: selectedAsset ? colors.border.card : "none",
            borderRadius: "1rem",
            backdropFilter: "blur(8px)",
            overflow: "hidden",
            boxShadow: shadow.lg,
          }}
          data-testid="inspect-panel"
        >
          {selectedAsset && (
            <div className="p-3 overflow-y-auto" style={{ maxHeight: "520px" }}>
              <div className="flex items-start justify-between mb-2">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className="inline-block h-2 w-2 rounded-full"
                      style={{ background: TYPE_HEX[selectedAsset.type] }}
                    />
                    <span
                      className="text-[10px] uppercase tracking-[0.12em]"
                      style={{ color: colors.text.secondary }}
                    >
                      {selectedAsset.type}
                    </span>
                  </div>
                  <div
                    className="text-sm font-semibold"
                    style={{ color: colors.text.primary }}
                  >
                    {selectedAsset.name}
                  </div>
                  <div
                    className="text-[11px]"
                    style={{ color: colors.text.secondary }}
                  >
                    {floorLabel(selectedAsset.floor)}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedAsset(null)}
                  className="text-sm leading-none px-1"
                  style={{ color: colors.text.secondary }}
                  aria-label="Close inspect panel"
                >
                  ✕
                </button>
              </div>

              <div
                className="inline-block px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider mb-3"
                style={{
                  background: `${STATUS_HEX[getLiveStatus(selectedAsset)]}22`,
                  color: STATUS_HEX[getLiveStatus(selectedAsset)],
                  border: `1px solid ${STATUS_HEX[getLiveStatus(selectedAsset)]}44`,
                  borderRadius: "0.5rem",
                }}
              >
                {STATUS_DISPLAY[getLiveStatus(selectedAsset)]}
              </div>

              <div
                className="text-[10px] uppercase tracking-[0.16em] mb-1"
                style={{ color: colors.text.secondary }}
              >
                Metrics
              </div>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 mb-3">
                {Object.entries(selectedAsset.metrics).map(([k, v]) => {
                  const label = METRIC_LABEL[k] ?? k;
                  return (
                    <div key={k} className="text-[11px]">
                      <div style={{ color: colors.text.secondary }}>{label}</div>
                      <div
                        className="font-mono"
                        style={{ color: colors.text.primary }}
                      >
                        {v}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div
                className="text-[10px] uppercase tracking-[0.16em] mb-1"
                style={{ color: colors.text.secondary }}
              >
                Service Details
              </div>
              <div className="flex flex-col gap-1">
                {Object.entries(selectedAsset.details).map(([k, v]) => {
                  const label = DETAIL_LABEL[k] ?? k;
                  return (
                    <div
                      key={k}
                      className="flex justify-between text-[11px]"
                    >
                      <span style={{ color: colors.text.secondary }}>
                        {label}
                      </span>
                      <span
                        className="font-mono"
                        style={{ color: colors.text.primary }}
                      >
                        {v}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── Hover tooltip ─── */}
      {showMarkers && hoveredAsset && tooltipPos && !selectedAsset && (
        <div
          className="absolute z-20 pointer-events-none px-2 py-1 text-[11px] font-medium"
          style={{
            left: tooltipPos.x + 12,
            top: tooltipPos.y + 12,
            background: colors.bg.surface,
            border: `1px solid ${STATUS_HEX[getLiveStatus(hoveredAsset)]}`,
            color: colors.text.primary,
            borderRadius: "0.5rem",
            backdropFilter: "blur(8px)",
            boxShadow: shadow.md,
            whiteSpace: "nowrap",
          }}
          >
          <div className="flex items-center gap-1.5">
            <span>{hoveredAsset.name}</span>
            <span style={{ color: STATUS_HEX[getLiveStatus(hoveredAsset)] }}>
              · {STATUS_DISPLAY[getLiveStatus(hoveredAsset)]}
            </span>
          </div>
        </div>
      )}

      {/* ─── Controls hint (bottom-center) ─── */}
      <div
        className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 px-3 py-1.5 text-[10px]"
        style={{
          background: "rgba(255,255,255,0.85)",
          color: colors.text.secondary,
          border: colors.border.card,
          borderRadius: "1rem",
          backdropFilter: "blur(8px)",
          boxShadow: shadow.sm,
        }}
      >
        {showMarkers
          ? "Drag to rotate · Scroll to zoom · Click marker to inspect"
          : "Drag to rotate · Scroll to zoom"}
      </div>
    </div>
  );
}

function StatPill({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="flex flex-col items-center">
      <div className="text-base font-bold font-mono" style={{ color }}>
        {value}
      </div>
      <div
        className="text-[9px] uppercase tracking-wider"
        style={{ color: colors.text.muted }}
      >
        {label}
      </div>
    </div>
  );
}
