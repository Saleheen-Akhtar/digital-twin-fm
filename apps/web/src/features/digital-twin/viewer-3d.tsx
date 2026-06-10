"use client";

/**
 * Digital Twin FM — Three.js viewer
 *
 * Raw Three.js (no @react-three/fiber) component that:
 *   - Mounts a WebGL canvas into a div (next/dynamic ssr:false in panel.tsx)
 *   - Builds a 4-floor curtain-wall glass office tower (concrete slabs,
 *     glass facade, mullion grid, structural columns, suspended ceilings,
 *     duct runs, rooftop RTU units)
 *   - Places 20 typed asset markers with per-type geometry:
 *       Air Handler → BoxGeometry cabinet + grille detail meshes
 *       Chiller     → CylinderGeometry vessel + flanged caps
 *       Boiler      → tapered CylinderGeometry + flue pipe
 *       Pump        → SphereGeometry body + inlet/outlet pipes
 *       Fan         → CylinderGeometry disc + 4 BoxGeometry blades
 *     Each marker: TorusGeometry status ring (emissive), transparent
 *     SphereGeometry fault glow (pulsed in RAF), CanvasTexture Sprite
 *     name label above.
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

// ─── Building construction — glass office tower on light theme ────
function buildBuilding(): THREE.Group {
  const group = new THREE.Group();
  group.name = "Building";

  const halfW = B.towerW / 2;
  const halfD = B.towerD / 2;
  const podiumW = B.towerW + 3;
  const podiumD = B.towerD + 3;
  const halfPodiumW = podiumW / 2;
  const halfPodiumD = podiumD / 2;
  const totalH = B.floorH * B.floorCount;

  // Ground plane (light, matches dashboard bg)
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(120, 120),
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
    120,
    60,
    colors.building.gridSection,
    colors.building.gridCell,
  );
  grid.position.y = 0.01;
  group.add(grid);

  // Podium (base, slightly wider than tower)
  const podium = new THREE.Mesh(
    new THREE.BoxGeometry(podiumW, B.podiumH, podiumD),
    new THREE.MeshStandardMaterial({
      color: colors.building.podium,
      roughness: 0.7,
      metalness: 0.1,
    }),
  );
  podium.position.set(0, B.podiumH / 2, 0);
  podium.castShadow = true;
  podium.receiveShadow = true;
  group.add(podium);

  // Recessed entrance panel
  const entrancePanel = new THREE.Mesh(
    new THREE.BoxGeometry(6, 1.6, 0.1),
    new THREE.MeshStandardMaterial({
      color: colors.building.entrancePanel,
      roughness: 0.4,
      metalness: 0.3,
    }),
  );
  entrancePanel.position.set(0, B.podiumH / 2, halfPodiumD - 0.05);
  group.add(entrancePanel);

  // Entrance canopy + 2 support columns
  const canopy = new THREE.Mesh(
    new THREE.BoxGeometry(7, 0.15, 2.5),
    new THREE.MeshStandardMaterial({
      color: colors.building.canopy,
      roughness: 0.5,
      metalness: 0.2,
    }),
  );
  canopy.position.set(0, B.podiumH - 0.15, halfPodiumD + 1.5);
  canopy.castShadow = true;
  group.add(canopy);
  [-3, 3].forEach((x) => {
    const col = new THREE.Mesh(
      new THREE.BoxGeometry(0.2, B.podiumH - 0.3, 0.2),
      new THREE.MeshStandardMaterial({ color: colors.building.entrancePanel }),
    );
    col.position.set(x, B.podiumH / 2 - 0.15, halfPodiumD + 1.5);
    col.castShadow = true;
    group.add(col);
  });

  // ─── Per-floor construction ───
  for (let floor = 0; floor < B.floorCount; floor++) {
    const yBase = B.podiumH + floor * B.floorH;
    const yCenter = yBase + B.floorH / 2;
    const floorGroup = new THREE.Group();
    floorGroup.name = `Floor-${floor}`;

    // Concrete slab (floor)
    const slab = new THREE.Mesh(
      new THREE.BoxGeometry(B.towerW + 0.3, B.slabT, B.towerD + 0.3),
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

    // Suspended ceiling (thin band below the slab)
    const ceiling = new THREE.Mesh(
      new THREE.BoxGeometry(B.towerW - 0.2, 0.08, B.towerD - 0.2),
      new THREE.MeshStandardMaterial({
        color: 0xe2e8f0,
        roughness: 0.6,
        metalness: 0.1,
      }),
    );
    ceiling.position.set(0, yBase + B.floorH - 0.3, 0);
    floorGroup.add(ceiling);

    // Duct runs (cylindrical, silver, along the ceiling)
    const ductMat = new THREE.MeshStandardMaterial({
      color: 0xcbd5e1,
      metalness: 0.6,
      roughness: 0.4,
    });
    [-B.towerW / 4, B.towerW / 4].forEach((x) => {
      const duct = new THREE.Mesh(
        new THREE.CylinderGeometry(0.25, 0.25, B.towerD - 2, 12),
        ductMat,
      );
      duct.rotation.x = Math.PI / 2;
      duct.position.set(x, yBase + B.floorH - 0.6, 0);
      duct.castShadow = true;
      floorGroup.add(duct);
    });

    // Glass facade — 5 cols × 3 rows on all 4 sides
    const panelH = (B.floorH - B.slabT) / B.mullionRows;
    const panelW = B.towerW / B.mullionCols;
    const glassMat = new THREE.MeshPhysicalMaterial({
      color: colors.building.glass,
      metalness: 0.1,
      roughness: 0.05,
      transmission: B.glassTransmission,
      transparent: true,
      opacity: B.glassOpacity,
      ior: 1.5,
    });
    for (let row = 0; row < B.mullionRows; row++) {
      for (let col = 0; col < B.mullionCols; col++) {
        const x = -halfW + panelW * (col + 0.5);
        const y = yBase + B.slabT / 2 + panelH * (row + 0.5);
        // Front
        const gf = new THREE.Mesh(
          new THREE.BoxGeometry(panelW * 0.92, panelH * 0.88, 0.08),
          glassMat,
        );
        gf.position.set(x, y, halfD);
        floorGroup.add(gf);
        // Back
        const gb = new THREE.Mesh(
          new THREE.BoxGeometry(panelW * 0.92, panelH * 0.88, 0.08),
          glassMat,
        );
        gb.position.set(x, y, -halfD);
        floorGroup.add(gb);
        // Left
        const gl = new THREE.Mesh(
          new THREE.BoxGeometry(0.08, panelH * 0.88, panelW * 0.92),
          glassMat,
        );
        gl.position.set(-halfW, y, -halfD + panelW * (col + 0.5));
        floorGroup.add(gl);
        // Right
        const gr = new THREE.Mesh(
          new THREE.BoxGeometry(0.08, panelH * 0.88, panelW * 0.92),
          glassMat,
        );
        gr.position.set(halfW, y, -halfD + panelW * (col + 0.5));
        floorGroup.add(gr);
      }
    }

    // Mullion grid — vertical + horizontal
    const mullionMat = new THREE.MeshStandardMaterial({
      color: colors.building.mullion,
      metalness: 0.7,
      roughness: 0.3,
    });
    for (let i = 0; i <= B.mullionCols; i++) {
      const x = -halfW + panelW * i;
      [-halfD, halfD].forEach((z) => {
        const m = new THREE.Mesh(
          new THREE.BoxGeometry(B.mullionT, B.floorH - B.slabT, B.mullionT),
          mullionMat,
        );
        m.position.set(x, yCenter, z);
        floorGroup.add(m);
      });
      const z = -halfD + panelW * i;
      [-halfW, halfW].forEach((xSide) => {
        const m = new THREE.Mesh(
          new THREE.BoxGeometry(B.mullionT, B.floorH - B.slabT, B.mullionT),
          mullionMat,
        );
        m.position.set(xSide, yCenter, z);
        floorGroup.add(m);
      });
    }
    for (let row = 1; row < B.mullionRows; row++) {
      const y = yBase + B.slabT / 2 + panelH * row;
      [-halfD, halfD].forEach((z) => {
        const m = new THREE.Mesh(
          new THREE.BoxGeometry(B.towerW, B.mullionT * 0.8, B.mullionT),
          mullionMat,
        );
        m.position.set(0, y, z);
        floorGroup.add(m);
      });
      [-halfW, halfW].forEach((xSide) => {
        const m = new THREE.Mesh(
          new THREE.BoxGeometry(B.mullionT, B.mullionT * 0.8, B.towerD),
          mullionMat,
        );
        m.position.set(xSide, y, 0);
        floorGroup.add(m);
      });
    }

    // Structural corner columns
    const colMat = new THREE.MeshStandardMaterial({
      color: colors.building.column,
      metalness: 0.5,
      roughness: 0.4,
    });
    [
      [-halfW, -halfD],
      [halfW, -halfD],
      [-halfW, halfD],
      [halfW, halfD],
    ].forEach(([x, z]) => {
      const col = new THREE.Mesh(
        new THREE.BoxGeometry(B.columnSize, B.floorH, B.columnSize),
        colMat,
      );
      col.position.set(x, yCenter, z);
      col.castShadow = true;
      floorGroup.add(col);
    });

    group.add(floorGroup);
  }

  // Rooftop penthouse
  const penthouse = new THREE.Mesh(
    new THREE.BoxGeometry(B.towerW + 1, 1.2, B.towerD + 1),
    new THREE.MeshStandardMaterial({
      color: colors.building.penthouse,
      roughness: 0.7,
      metalness: 0.1,
    }),
  );
  penthouse.position.set(0, B.podiumH + totalH + 0.6, 0);
  penthouse.castShadow = true;
  group.add(penthouse);

  // Rooftop RTU units (4 boxes + fan cowls)
  const rtuMat = new THREE.MeshStandardMaterial({
    color: colors.building.mechanical,
    roughness: 0.5,
    metalness: 0.4,
  });
  [
    [-5, -3],
    [5, -3],
    [-5, 3],
    [5, 3],
  ].forEach(([x, z]) => {
    const rtu = new THREE.Mesh(new THREE.BoxGeometry(2, 1.2, 2), rtuMat);
    rtu.position.set(x, B.podiumH + totalH + 0.6, z);
    rtu.castShadow = true;
    group.add(rtu);
    const cowl = new THREE.Mesh(
      new THREE.CylinderGeometry(0.6, 0.6, 0.4, 16),
      rtuMat,
    );
    cowl.position.set(x, B.podiumH + totalH + 1.4, z);
    group.add(cowl);
  });

  // Antenna
  const antenna = new THREE.Mesh(
    new THREE.CylinderGeometry(0.05, 0.05, 3, 8),
    new THREE.MeshStandardMaterial({
      color: colors.building.antenna,
      metalness: 0.8,
      roughness: 0.2,
    }),
  );
  antenna.position.set(0, B.podiumH + totalH + 3.5, 0);
  antenna.castShadow = true;
  group.add(antenna);

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
    setSelectedFloor,
    setSelectedType,
    setSelectedAsset,
  } = useViewerStore();

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
          if (selectedAsset && selectedAsset.id === asset.id) {
            bodyMat.emissive.setHex(STATUS_HEX_INT[asset.status]);
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

  // ─── Filtered assets for status panel ───
  const visibleAssets = SEED_ASSETS.filter((a) => {
    const floorOk = selectedFloor === "ALL" || a.floor === selectedFloor;
    const typeOk = selectedType === "ALL" || a.type === selectedType;
    return floorOk && typeOk;
  });
  const counts = {
    operational: visibleAssets.filter((a) => a.status === "operational").length,
    warning: visibleAssets.filter((a) => a.status === "warning").length,
    fault: visibleAssets.filter((a) => a.status === "fault").length,
    total: visibleAssets.length,
  };
  const alerts = visibleAssets.filter(
    (a) => a.status === "warning" || a.status === "fault",
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
                  background: `${STATUS_HEX[selectedAsset.status]}22`,
                  color: STATUS_HEX[selectedAsset.status],
                  border: `1px solid ${STATUS_HEX[selectedAsset.status]}44`,
                  borderRadius: "0.5rem",
                }}
              >
                {STATUS_DISPLAY[selectedAsset.status]}
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
            border: `1px solid ${STATUS_HEX[hoveredAsset.status]}`,
            color: colors.text.primary,
            borderRadius: "0.5rem",
            backdropFilter: "blur(8px)",
            boxShadow: shadow.md,
            whiteSpace: "nowrap",
          }}
        >
          <div className="flex items-center gap-1.5">
            <span>{hoveredAsset.name}</span>
            <span style={{ color: STATUS_HEX[hoveredAsset.status] }}>
              · {STATUS_DISPLAY[hoveredAsset.status]}
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
