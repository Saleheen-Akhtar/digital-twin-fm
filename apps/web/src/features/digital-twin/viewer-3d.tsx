"use client";

/**
 * Digital Twin FM — Three.js viewer
 *
 * A raw Three.js implementation (no @react-three/fiber) that mounts
 * a WebGL canvas into a div, builds a 4-floor curtain-wall building
 * with concrete slabs, glass facade, structural columns, mullion grids,
 * suspended ceilings, duct runs, and rooftop RTU units, then places
 * 20 typed asset markers (Air Handler / Chiller / Boiler / Pump / Fan)
 * with per-type geometry, status rings, fault glows, and CanvasTexture
 * sprite labels.
 *
 * Interaction:
 *   - OrbitControls for drag-rotate + scroll-zoom
 *   - Raycaster for hover (cursor + float) and click (inspect panel)
 *   - ResizeObserver for responsive canvas sizing
 *   - Floor + type filters toggle group.visible
 *
 * Cleanup:
 *   - renderer.dispose(), controls.dispose(), cancelAnimationFrame,
 *     ResizeObserver.disconnect(), all material/geometries freed
 */

import { useEffect, useRef, useState, useCallback } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { useViewerStore } from "./viewer-store";
import {
  type Asset,
  type AssetStatus,
  type AssetType,
  SEED_ASSETS,
  floorLabel,
} from "./viewer-data";
import type { FloorFilter, TypeFilter } from "./viewer-store";

// ─── Status colors (emissive rings + glow + panel swatches) ─────────
const STATUS_COLOR: Record<AssetStatus, number> = {
  operational: 0x22c55e,
  warning: 0xeab308,
  fault: 0xef4444,
};
const STATUS_HEX: Record<AssetStatus, string> = {
  operational: "#22c55e",
  warning: "#eab308",
  fault: "#ef4444",
};

// ─── Type colors (legend rows + marker body tint) ──────────────────
const TYPE_COLOR: Record<AssetType, number> = {
  "Air Handler": 0x3b82f6,
  Chiller: 0x06b6d4,
  Boiler: 0xf97316,
  Pump: 0xa855f7,
  Fan: 0x10b981,
};
const TYPE_HEX: Record<AssetType, string> = {
  "Air Handler": "#3b82f6",
  Chiller: "#06b6d4",
  Boiler: "#f97316",
  Pump: "#a855f7",
  Fan: "#10b981",
};

// ─── Building dimensions ───────────────────────────────────────────
const TOWER_W = 18;
const TOWER_D = 14;
const FLOOR_H = 3.6;
const FLOOR_COUNT = 4; // GF + F1 + F2 + F3
const SLAB_T = 0.3;
const WALL_T = 0.25;
const MULLION_COLS = 6;
const MULLION_ROWS = 2;

// ─── CanvasTexture label sprite helper ──────────────────────────────
function makeLabelSprite(
  text: string,
  subtext: string,
  color: string,
): THREE.Sprite {
  const W = 256;
  const H = 96;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  // Background pill
  ctx.fillStyle = "rgba(10, 14, 26, 0.92)";
  roundRect(ctx, 4, 4, W - 8, H - 8, 14);
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  roundRect(ctx, 4, 4, W - 8, H - 8, 14);
  ctx.stroke();

  // Name
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 28px system-ui, -apple-system, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, W / 2, 36);

  // Subtext
  ctx.fillStyle = color;
  ctx.font = "600 18px system-ui, -apple-system, sans-serif";
  ctx.fillText(subtext, W / 2, 68);

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(2.4, 0.9, 1);
  return sprite;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

// ─── Building construction ─────────────────────────────────────────
function buildBuilding(): THREE.Group {
  const group = new THREE.Group();
  group.name = "Building";

  const halfW = TOWER_W / 2;
  const halfD = TOWER_D / 2;

  // Ground plane
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(120, 120),
    new THREE.MeshStandardMaterial({
      color: 0x1f2937,
      roughness: 0.95,
      metalness: 0,
    }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  group.add(ground);

  // Per-floor construction
  for (let floor = 0; floor < FLOOR_COUNT; floor++) {
    const yBase = floor * FLOOR_H;
    const yCenter = yBase + FLOOR_H / 2;
    const floorGroup = new THREE.Group();
    floorGroup.name = `Floor-${floor}`;

    // ─── Concrete slab (floor + ceiling of this level) ───
    const slab = new THREE.Mesh(
      new THREE.BoxGeometry(TOWER_W + 0.4, SLAB_T, TOWER_D + 0.4),
      new THREE.MeshStandardMaterial({
        color: 0xcbd5e1,
        roughness: 0.85,
        metalness: 0.05,
      }),
    );
    slab.position.set(0, yBase, 0);
    slab.castShadow = true;
    slab.receiveShadow = true;
    floorGroup.add(slab);

    // ─── Suspended ceiling (slightly below slab, thin) ───
    const ceiling = new THREE.Mesh(
      new THREE.BoxGeometry(TOWER_W - 0.2, 0.08, TOWER_D - 0.2),
      new THREE.MeshStandardMaterial({
        color: 0xe2e8f0,
        roughness: 0.6,
        metalness: 0.1,
      }),
    );
    ceiling.position.set(0, yBase + FLOOR_H - 0.3, 0);
    floorGroup.add(ceiling);

    // ─── Glass facade panels (4 sides) ───
    const panelH = (FLOOR_H - SLAB_T) / MULLION_ROWS;
    const panelW = TOWER_W / MULLION_COLS;
    const glassMat = new THREE.MeshPhysicalMaterial({
      color: 0x5b8fd9,
      metalness: 0.1,
      roughness: 0.05,
      transmission: 0.6,
      transparent: true,
      opacity: 0.55,
      ior: 1.5,
    });
    for (let row = 0; row < MULLION_ROWS; row++) {
      for (let col = 0; col < MULLION_COLS; col++) {
        const x = -halfW + panelW * (col + 0.5);
        const y = yBase + SLAB_T / 2 + panelH * (row + 0.5);
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

    // ─── Mullion grid (vertical + horizontal frames) ───
    const mullionMat = new THREE.MeshStandardMaterial({
      color: 0x94a3b8,
      metalness: 0.7,
      roughness: 0.3,
    });
    // Vertical mullions on all 4 sides
    for (let i = 0; i <= MULLION_COLS; i++) {
      const x = -halfW + panelW * i;
      // Front + Back
      [-halfD, halfD].forEach((z) => {
        const m = new THREE.Mesh(
          new THREE.BoxGeometry(0.12, FLOOR_H - SLAB_T, 0.12),
          mullionMat,
        );
        m.position.set(x, yCenter, z);
        floorGroup.add(m);
      });
      const z = -halfD + panelW * i;
      [-halfW, halfW].forEach((xSide) => {
        const m = new THREE.Mesh(
          new THREE.BoxGeometry(0.12, FLOOR_H - SLAB_T, 0.12),
          mullionMat,
        );
        m.position.set(xSide, yCenter, z);
        floorGroup.add(m);
      });
    }
    // Horizontal mullions
    for (let row = 1; row < MULLION_ROWS; row++) {
      const y = yBase + SLAB_T / 2 + panelH * row;
      // Front + Back (full width)
      [-halfD, halfD].forEach((z) => {
        const m = new THREE.Mesh(
          new THREE.BoxGeometry(TOWER_W, 0.1, 0.1),
          mullionMat,
        );
        m.position.set(0, y, z);
        floorGroup.add(m);
      });
      // Left + Right (full depth)
      [-halfW, halfW].forEach((xSide) => {
        const m = new THREE.Mesh(
          new THREE.BoxGeometry(0.1, 0.1, TOWER_D),
          mullionMat,
        );
        m.position.set(xSide, y, 0);
        floorGroup.add(m);
      });
    }

    // ─── Structural corner columns ───
    const colMat = new THREE.MeshStandardMaterial({
      color: 0x64748b,
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
        new THREE.BoxGeometry(0.4, FLOOR_H, 0.4),
        colMat,
      );
      col.position.set(x, yCenter, z);
      col.castShadow = true;
      floorGroup.add(col);
    });

    // ─── Duct runs (cylindrical, silver, along the ceiling) ───
    const ductMat = new THREE.MeshStandardMaterial({
      color: 0xcbd5e1,
      metalness: 0.6,
      roughness: 0.4,
    });
    for (let duct = 0; duct < 2; duct++) {
      const ductMesh = new THREE.Mesh(
        new THREE.CylinderGeometry(0.25, 0.25, TOWER_D - 2, 12),
        ductMat,
      );
      ductMesh.rotation.x = Math.PI / 2;
      ductMesh.position.set(
        duct === 0 ? -TOWER_W / 4 : TOWER_W / 4,
        yBase + FLOOR_H - 0.6,
        0,
      );
      ductMesh.castShadow = true;
      floorGroup.add(ductMesh);
    }

    group.add(floorGroup);
  }

  // ─── Rooftop RTU units ───
  const rtuMat = new THREE.MeshStandardMaterial({
    color: 0x94a3b8,
    metalness: 0.5,
    roughness: 0.5,
  });
  const rtuPositions: [number, number][] = [
    [-5, -3],
    [5, -3],
    [-5, 3],
    [5, 3],
  ];
  rtuPositions.forEach(([x, z]) => {
    const rtu = new THREE.Mesh(new THREE.BoxGeometry(2, 1.2, 2), rtuMat);
    rtu.position.set(x, FLOOR_COUNT * FLOOR_H + 0.6, z);
    rtu.castShadow = true;
    group.add(rtu);
    // Fan cowl on top
    const cowl = new THREE.Mesh(
      new THREE.CylinderGeometry(0.6, 0.6, 0.4, 16),
      rtuMat,
    );
    cowl.position.set(x, FLOOR_COUNT * FLOOR_H + 1.4, z);
    group.add(cowl);
  });

  return group;
}

// ─── Marker factory: returns a Group with the typed geometry + ring + glow + label ─
interface MarkerHandles {
  group: THREE.Group;
  body: THREE.Mesh;           // main body mesh (for emissive highlight on select)
  ring: THREE.Mesh;           // TorusGeometry status ring
  glow: THREE.Mesh;           // transparent SphereGeometry fault glow
  blades?: THREE.Group;       // Fan only — animated blades group
}

function buildMarker(asset: Asset): MarkerHandles {
  const group = new THREE.Group();
  group.name = `Asset-${asset.id}`;
  group.position.set(asset.x, asset.floor * FLOOR_H + 0.6, asset.z);
  group.userData = { assetId: asset.id, asset };

  const bodyColor = TYPE_COLOR[asset.type];
  const statusColor = STATUS_COLOR[asset.status];

  let body: THREE.Mesh;
  let blades: THREE.Group | undefined;

  // ─── Per-type body geometry ───
  if (asset.type === "Air Handler") {
    // BoxGeometry cabinet + grille detail meshes
    const cabinet = new THREE.Mesh(
      new THREE.BoxGeometry(1.4, 1.2, 1.0),
      new THREE.MeshStandardMaterial({
        color: bodyColor,
        roughness: 0.5,
        metalness: 0.4,
      }),
    );
    cabinet.castShadow = true;
    group.add(cabinet);
    // Grille slats (3 thin boxes on the front)
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
      group.add(slat);
    }
    body = cabinet;
  } else if (asset.type === "Chiller") {
    // CylinderGeometry vessel + flanged caps
    const vessel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.55, 0.55, 1.6, 24),
      new THREE.MeshStandardMaterial({
        color: bodyColor,
        roughness: 0.4,
        metalness: 0.6,
      }),
    );
    vessel.castShadow = true;
    group.add(vessel);
    // Flanged caps (top + bottom discs, wider)
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
      group.add(cap);
    });
    body = vessel;
  } else if (asset.type === "Boiler") {
    // Tapered CylinderGeometry + flue pipe
    const body3 = new THREE.Mesh(
      new THREE.CylinderGeometry(0.35, 0.55, 1.4, 16),
      new THREE.MeshStandardMaterial({
        color: bodyColor,
        roughness: 0.5,
        metalness: 0.4,
      }),
    );
    body3.castShadow = true;
    group.add(body3);
    // Flue pipe (thin cylinder rising from the top)
    const flue = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.12, 1.0, 12),
      new THREE.MeshStandardMaterial({
        color: 0x475569,
        metalness: 0.8,
        roughness: 0.2,
      }),
    );
    flue.position.y = 1.2;
    group.add(flue);
    body = body3;
  } else if (asset.type === "Pump") {
    // SphereGeometry body + inlet/outlet CylinderGeometry pipes
    const sphere = new THREE.Mesh(
      new THREE.SphereGeometry(0.55, 20, 16),
      new THREE.MeshStandardMaterial({
        color: bodyColor,
        roughness: 0.3,
        metalness: 0.7,
      }),
    );
    sphere.castShadow = true;
    group.add(sphere);
    // Inlet (left) + outlet (right) pipes
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
      group.add(pipe);
    });
    body = sphere;
  } else {
    // Fan: CylinderGeometry disc + 4 BoxGeometry blades (animated)
    const disc = new THREE.Mesh(
      new THREE.CylinderGeometry(0.7, 0.7, 0.15, 24),
      new THREE.MeshStandardMaterial({
        color: bodyColor,
        roughness: 0.4,
        metalness: 0.5,
      }),
    );
    disc.castShadow = true;
    group.add(disc);
    blades = new THREE.Group();
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
    group.add(blades);
    body = disc;
  }

  // ─── Status ring (TorusGeometry, emissive) ───
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

  // ─── Fault glow (transparent SphereGeometry) ───
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

  // ─── CanvasTexture label sprite ───
  const label = makeLabelSprite(
    asset.name,
    asset.status.toUpperCase(),
    STATUS_HEX[asset.status],
  );
  label.position.set(0, 1.5, 0);
  group.add(label);

  return { group, body, ring, glow, blades };
}

// ─── Camera positions per floor ────────────────────────────────────
const CAMERA_BY_FLOOR: Record<FloorFilter, [number, number, number]> = {
  ALL: [26, 18, 26],
  0: [22, 6, 22],
  1: [22, 10, 22],
  2: [22, 14, 22],
  3: [22, 18, 22],
};

const LOOKAT_BY_FLOOR: Record<FloorFilter, [number, number, number]> = {
  ALL: [0, 6, 0],
  0: [0, 2, 0],
  1: [0, 5, 0],
  2: [0, 9, 0],
  3: [0, 13, 0],
};

// ─── Component ────────────────────────────────────────────────────
export function DigitalTwinViewer3D() {
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

  // Local state (re-renders only the UI overlays, not the canvas)
  const [tick, setTick] = useState(0);
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
    renderer.setClearColor(0x000000, 0);
    mount.appendChild(renderer.domElement);
    renderer.domElement.style.cursor = "grab";

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0e1a);
    scene.fog = new THREE.Fog(0x0a0e1a, 30, 90);

    // Camera
    const camera = new THREE.PerspectiveCamera(50, W / H, 0.1, 200);
    camera.position.set(26, 18, 26);
    camera.lookAt(0, 6, 0);

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2.2;
    controls.minDistance = 8;
    controls.maxDistance = 60;
    controls.target.set(0, 6, 0);

    // ─── Lights ───
    const ambient = new THREE.AmbientLight(0xc8d4ff, 0.4);
    scene.add(ambient);

    const sun = new THREE.DirectionalLight(0xffffff, 1.5);
    sun.position.set(15, 25, 10);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -25;
    sun.shadow.camera.right = 25;
    sun.shadow.camera.top = 25;
    sun.shadow.camera.bottom = -25;
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 60;
    scene.add(sun);

    // Fill light (cooler, opposite side)
    const fill = new THREE.DirectionalLight(0x6688ff, 0.4);
    fill.position.set(-10, 15, -10);
    scene.add(fill);

    // ─── Building ───
    const building = buildBuilding();
    scene.add(building);

    // ─── Markers ───
    const handles = SEED_ASSETS.map(buildMarker);
    handles.forEach((h) => scene.add(h.group));

    // ─── Raycaster ───
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const clock = new THREE.Clock();

    // ─── ResizeObserver ───
    const resizeObserver = new ResizeObserver(() => {
      const w = mount.clientWidth;
      const h = mount.clientHeight;
      if (w === 0 || h === 0) return;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    });
    resizeObserver.observe(mount);

    // ─── Pointer handlers ───
    const onPointerMove = (e: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      setTooltipPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    };
    const onClick = () => {
      raycaster.setFromCamera(pointer, camera);
      const intersects: { handle: MarkerHandles; distance: number }[] = [];
      handles.forEach((h) => {
        const hits = raycaster.intersectObject(h.group, true);
        if (hits.length > 0) {
          intersects.push({ handle: h, distance: hits[0].distance });
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

    // ─── Animation loop ───
    let rafId = 0;
    const animate = () => {
      rafId = requestAnimationFrame(animate);
      const dt = clock.getDelta();
      const t = clock.getElapsedTime();

      // Raycast for hover
      raycaster.setFromCamera(pointer, camera);
      let closestId: string | null = null;
      let closestDist = Infinity;
      handles.forEach((h) => {
        const hits = raycaster.intersectObject(h.group, true);
        if (hits.length > 0 && hits[0].distance < closestDist) {
          closestDist = hits[0].distance;
          closestId = h.group.userData.assetId as string;
        }
      });

      // Update hover state
      if (closestId !== sceneStateRef.current.hoverId) {
        sceneStateRef.current.hoverId = closestId;
        const hovered = closestId
          ? (handles.find((h) => h.group.userData.assetId === closestId)?.group
              .userData.asset as Asset | undefined) ?? null
          : null;
        setHoveredAsset(hovered);
        renderer.domElement.style.cursor = hovered ? "pointer" : "grab";
      }

      // Float animation + fault glow pulse
      handles.forEach((h) => {
        const asset = h.group.userData.asset as Asset;
        const isHovered = closestId === asset.id;
        const baseY = asset.floor * FLOOR_H + 0.6;
        const targetY = isHovered ? baseY + 0.15 : baseY;
        h.group.position.y += (targetY - h.group.position.y) * 0.15;
        // Fan blade rotation
        if (h.blades) {
          h.blades.rotation.y += dt * 4;
        }
        // Fault glow pulse
        if (asset.status === "fault") {
          const pulse = 0.15 + Math.sin(t * 3) * 0.08;
          (h.glow.material as THREE.MeshBasicMaterial).opacity = pulse;
          h.glow.scale.setScalar(1 + Math.sin(t * 3) * 0.1);
        }
        // Emissive highlight on selected
        if (selectedAsset && selectedAsset.id === asset.id) {
          (h.body.material as THREE.MeshStandardMaterial).emissive.setHex(
            STATUS_COLOR[asset.status],
          );
          (h.body.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.6;
        } else if (!isHovered) {
          (h.body.material as THREE.MeshStandardMaterial).emissive.setHex(0x000000);
          (h.body.material as THREE.MeshStandardMaterial).emissiveIntensity = 0;
        } else {
          (h.body.material as THREE.MeshStandardMaterial).emissive.setHex(
            TYPE_COLOR[asset.type],
          );
          (h.body.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.25;
        }
      });

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

    // ─── Cleanup ───
    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener("pointermove", onPointerMove);
      renderer.domElement.removeEventListener("pointerdown", onPointerDown);
      renderer.domElement.removeEventListener("pointerup", onPointerUp);
      renderer.domElement.removeEventListener("click", onClick);
      controls.dispose();
      // Free geometries + materials
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
      });
      renderer.dispose();
      if (renderer.domElement.parentNode === mount) {
        mount.removeChild(renderer.domElement);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Apply floor + type filters (visibility + camera re-center) ───
  useEffect(() => {
    const s = sceneStateRef.current;
    if (!s.handles || !s.camera || !s.controls) return;
    s.handles.forEach((h) => {
      const asset = h.group.userData.asset as Asset;
      const floorOk = selectedFloor === "ALL" || asset.floor === selectedFloor;
      const typeOk = selectedType === "ALL" || asset.type === selectedType;
      h.group.visible = floorOk && typeOk;
    });
    // Re-center camera
    const [cx, cy, cz] = CAMERA_BY_FLOOR[selectedFloor];
    s.camera.position.set(cx, cy, cz);
    const [lx, ly, lz] = LOOKAT_BY_FLOOR[selectedFloor];
    s.controls.target.set(lx, ly, lz);
    s.controls.update();
  }, [selectedFloor, selectedType]);

  // ─── Apply selected asset highlight (re-render frame) ───
  useEffect(() => {
    setTick((t) => t + 1);
  }, [selectedAsset]);

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

  return (
    <div
      ref={mountRef}
      className="w-full h-[640px] rounded-lg overflow-hidden relative"
      style={{ background: "#0a0e1a" }}
      data-testid="digital-twin-viewer-3d"
    >
      {/* ─── Floor selector (top-left) ─── */}
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
              className={`px-3 py-1.5 text-xs font-semibold rounded transition-colors backdrop-blur ${
                active
                  ? "bg-white text-slate-900"
                  : "text-white/80 hover:text-white"
              }`}
              style={{
                background: active ? "white" : "rgba(10,14,26,0.92)",
                border: `1px solid ${active ? "white" : "rgba(255,255,255,0.12)"}`,
                backdropFilter: "blur(8px)",
                minWidth: "52px",
              }}
            >
              {f === "ALL" ? "ALL" : floorLabel(f)}
            </button>
          );
        })}
      </div>

      {/* ─── Type legend (top-right) ─── */}
      <div
        className="absolute top-3 right-3 z-10 flex flex-col gap-1 p-2 rounded"
        style={{
          background: "rgba(10,14,26,0.92)",
          border: "1px solid rgba(255,255,255,0.08)",
          backdropFilter: "blur(8px)",
        }}
        data-testid="type-legend"
      >
        {(
          [
            "ALL",
            "Air Handler",
            "Chiller",
            "Boiler",
            "Pump",
            "Fan",
          ] as TypeFilter[]
        ).map((t) => {
          const active = selectedType === t;
          const color = t === "ALL" ? "#ffffff" : TYPE_HEX[t];
          return (
            <button
              key={t}
              type="button"
              onClick={() => setSelectedType(t)}
              className="flex items-center gap-2 px-2 py-1 rounded text-xs font-medium transition-colors"
              style={{
                background: active ? `${color}22` : "transparent",
                color: active ? color : "rgba(255,255,255,0.6)",
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

      {/* ─── Status panel (bottom-left) ─── */}
      <div
        className="absolute bottom-3 left-3 z-10 p-3 rounded-lg w-[260px]"
        style={{
          background: "rgba(10,14,26,0.92)",
          border: "1px solid rgba(255,255,255,0.08)",
          backdropFilter: "blur(8px)",
        }}
        data-testid="status-panel"
      >
        <div className="text-[10px] uppercase tracking-[0.16em] text-white/50 mb-2">
          Status
        </div>
        <div className="grid grid-cols-4 gap-2 mb-3">
          <StatPill label="OK" value={counts.operational} color="#22c55e" />
          <StatPill label="Warn" value={counts.warning} color="#eab308" />
          <StatPill label="Fault" value={counts.fault} color="#ef4444" />
          <StatPill label="Total" value={counts.total} color="#94a3b8" />
        </div>
        <div className="text-[10px] uppercase tracking-[0.16em] text-white/50 mb-1">
          Alerts
        </div>
        <div
          className="flex flex-col gap-1 overflow-y-auto pr-1"
          style={{ maxHeight: "160px" }}
        >
          {alerts.length === 0 ? (
            <div className="text-xs text-white/40 py-2 text-center">
              No active alerts
            </div>
          ) : (
            alerts.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => setSelectedAsset(a)}
                className="flex items-center gap-2 px-2 py-1.5 rounded text-left hover:bg-white/5 transition-colors"
                style={{
                  border: `1px solid ${STATUS_HEX[a.status]}33`,
                  background: `${STATUS_HEX[a.status]}0a`,
                }}
              >
                <span
                  className="inline-block h-1.5 w-1.5 rounded-full"
                  style={{ background: STATUS_HEX[a.status] }}
                />
                <span className="text-xs font-medium text-white/90 flex-1 truncate">
                  {a.name}
                </span>
                <span className="text-[10px] text-white/50">
                  {floorLabel(a.floor)}
                </span>
              </button>
            ))
          )}
        </div>
      </div>

      {/* ─── Inspect panel (bottom-right, slides in) ─── */}
      <div
        className="absolute bottom-3 right-3 z-10 rounded-lg transition-all duration-300"
        style={{
          width: "300px",
          maxHeight: selectedAsset ? "480px" : "0",
          opacity: selectedAsset ? 1 : 0,
          transform: selectedAsset ? "translateY(0)" : "translateY(20px)",
          background: "rgba(10,14,26,0.92)",
          border: selectedAsset ? "1px solid rgba(255,255,255,0.08)" : "none",
          backdropFilter: "blur(8px)",
          overflow: "hidden",
        }}
        data-testid="inspect-panel"
      >
        {selectedAsset && (
          <div className="p-3">
            <div className="flex items-start justify-between mb-2">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className="inline-block h-2 w-2 rounded-full"
                    style={{ background: TYPE_HEX[selectedAsset.type] }}
                  />
                  <span className="text-[10px] uppercase tracking-[0.12em] text-white/50">
                    {selectedAsset.type}
                  </span>
                </div>
                <div className="text-sm font-semibold text-white">
                  {selectedAsset.name}
                </div>
                <div className="text-[11px] text-white/50">
                  {floorLabel(selectedAsset.floor)}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedAsset(null)}
                className="text-white/50 hover:text-white text-sm leading-none px-1"
                aria-label="Close inspect panel"
              >
                ✕
              </button>
            </div>

            <div
              className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider mb-3"
              style={{
                background: `${STATUS_HEX[selectedAsset.status]}22`,
                color: STATUS_HEX[selectedAsset.status],
                border: `1px solid ${STATUS_HEX[selectedAsset.status]}44`,
              }}
            >
              {selectedAsset.status}
            </div>

            <div className="text-[10px] uppercase tracking-[0.16em] text-white/50 mb-1">
              Metrics
            </div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 mb-3">
              {Object.entries(selectedAsset.metrics).map(([k, v]) => (
                <div key={k} className="text-[11px]">
                  <div className="text-white/50">{k}</div>
                  <div className="text-white font-mono">{v}</div>
                </div>
              ))}
            </div>

            <div className="text-[10px] uppercase tracking-[0.16em] text-white/50 mb-1">
              Service Details
            </div>
            <div className="flex flex-col gap-1">
              {Object.entries(selectedAsset.details).map(([k, v]) => (
                <div key={k} className="flex justify-between text-[11px]">
                  <span className="text-white/50">{k}</span>
                  <span className="text-white/90 font-mono">{v}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ─── Hover tooltip ─── */}
      {hoveredAsset && tooltipPos && !selectedAsset && (
        <div
          className="absolute z-20 pointer-events-none px-2 py-1 rounded text-[11px] font-medium"
          style={{
            left: tooltipPos.x + 12,
            top: tooltipPos.y + 12,
            background: "rgba(10,14,26,0.95)",
            border: `1px solid ${STATUS_HEX[hoveredAsset.status]}`,
            color: "white",
            backdropFilter: "blur(8px)",
            whiteSpace: "nowrap",
          }}
        >
          <div className="flex items-center gap-1.5">
            <span
              className="inline-block h-1.5 w-1.5 rounded-full"
              style={{ background: STATUS_HEX[hoveredAsset.status] }}
            />
            {hoveredAsset.name} · {hoveredAsset.status}
          </div>
        </div>
      )}

      {/* ─── Controls hint (bottom-center) ─── */}
      <div
        className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 px-3 py-1.5 rounded text-[10px] text-white/50"
        style={{
          background: "rgba(10,14,26,0.7)",
          backdropFilter: "blur(8px)",
        }}
      >
        Drag to rotate · Scroll to zoom · Click marker to inspect
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
      <div
        className="text-base font-bold font-mono"
        style={{ color }}
      >
        {value}
      </div>
      <div className="text-[9px] uppercase tracking-wider text-white/40">
        {label}
      </div>
    </div>
  );
}
