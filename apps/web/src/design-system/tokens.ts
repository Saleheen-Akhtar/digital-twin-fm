/**
 * Digital Twin FM — Design System Tokens
 *
 * Single source of truth for all visual constants. Everything that
 * renders (3D scene materials, React panel backgrounds, text colors,
 * spacing, shadows, radius) reads from here so the building model,
 * the dashboard panels, and the homepage preview all stay consistent.
 *
 * Color naming follows the dashboard's existing palette (found in
 * `apps/web/src/app/dashboard/page.tsx`): `#f7f9fd` page bg, `#ffffff`
 * surfaces, `#355fe5`/`#3c73ff` accent gradient, `#1e4fd8` link/accent,
 * `#c9d6ff` border, `#0f172a` text, `#475569`/`#94a3b8` muted text.
 *
 * SCENE: the `scene` namespace holds dark-theme colors for the 3D
 * viewer overlays, which render over a dark radial background.
 */

export const colors = {
  // ── Backgrounds (light theme — matches dashboard) ──
  bg: {
    canvas: "#f7f9fd",       // dashboard page bg, used as 3D scene background
    surface: "#ffffff",      // cards, panels
    surfaceTranslucent: "rgba(255,255,255,0.85)",
    ground: "#e8eef7",       // 3D ground plane
    subtle: "#f1f5f9",       // dividers, muted surface
  },

  // ── Scene (light theme — 3D viewer overlays over light grey bg) ──
  scene: {
    surface: "rgba(255,255,255,0.90)",         // white glass card bg
    surfaceSolid: "#ffffff",                     // solid white bg
    border: "rgba(15,23,42,0.08)",               // scene panel borders
    borderStrong: "rgba(15,23,42,0.15)",         // hover/active borders
    text: "#0f172a",                             // primary text on light
    textMuted: "#475569",                        // secondary text on light
    textDim: "#94a3b8",                          // tertiary/meta text on light
    accent: "#3b82f6",                           // blue accent
    accentBg: "rgba(59,130,246,0.10)",           // accent hover bg
    glassBg: "rgba(255,255,255,0.80)",           // heavy glass backdrop
    glassBorder: "rgba(15,23,42,0.06)",          // subtle glass border
    backdropBlur: "blur(12px)",
  },

  // ── Building (3D model materials) ──
  // Light corporate theme — matches the dashboard's light aesthetic
  building: {
    ground: 0xe8eef7,
    podium: 0xdfe6f0,
    slab: 0xd1d9e8,
    glass: 0xa8d8f0,
    mullion: 0xc8d6e5,
    column: 0xd1d9e8,
    penthouse: 0xd1d9e8,
    mechanical: 0xb8c6d5,
    antenna: 0xc8d6e5,
    canopy: 0xd1d9e8,
    entrancePanel: 0xc8d6e5,
    window: 0x88ccff,        // emissive accent
    windowEmissive: 0x4488cc,
    wireframe: 0x94a3b8,
    gridCell: 0xd1d9e8,
    gridSection: 0xc8d6e5,
  },

  // ── Status (operational / warning / fault) ──
  status: {
    operational: "#22c55e",
    warning: "#eab308",
    fault: "#ef4444",
    // Convenience aliases used across the codebase
    ok: "#22c55e",
    critical: "#ef4444",
    info: "#38bdf8",
    offline: "#64748b",
  },
  statusHex: {
    operational: 0x22c55e,
    warning: 0xeab308,
    fault: 0xef4444,
    ok: 0x22c55e,
    critical: 0xef4444,
    info: 0x38bdf8,
    offline: 0x64748b,
  },

  // ── Asset types (color-coded legend + marker tint) ──
  type: {
    "Air Handler": "#3b82f6",
    Chiller: "#06b6d4",
    Boiler: "#f97316",
    Pump: "#a855f7",
    Fan: "#10b981",
  },
  typeHex: {
    "Air Handler": 0x3b82f6,
    Chiller: 0x06b6d4,
    Boiler: 0xf97316,
    Pump: 0xa855f7,
    Fan: 0x10b981,
  },

  // ── Text (dashboard slate scale) ──
  text: {
    primary: "#0f172a",
    secondary: "#475569",
    muted: "#94a3b8",
    onSurface: "#0f172a",
    onDark: "#f1f5f9",
    accent: "#1e4fd8",
  },

  // ── Borders ──
  border: {
    light: "#c9d6ff",
    subtle: "rgba(15,23,42,0.08)",
    panel: "1px solid #c9d6ff",
    card: "1px solid rgba(15,23,42,0.08)",
  },

  // ── Accent (dashboard blue gradient) ──
  accent: {
    from: "#355fe5",
    to: "#3c73ff",
  },
} as const;

export const spacing = {
  xxs: "2px",
  xs: "4px",
  sm: "8px",
  md: "12px",
  lg: "16px",
  xl: "24px",
  xxl: "32px",
  xxxl: "48px",
} as const;

export const radius = {
  sm: "6px",
  md: "12px",
  lg: "16px",
  xl: "20px",
  xxl: "24px",
  pill: "9999px",
} as const;

export const shadow = {
  sm: "0 1px 2px rgba(15,23,42,0.04)",
  md: "0 4px 12px rgba(15,23,42,0.06)",
  lg: "0 8px 24px rgba(15,23,42,0.08)",
  xl: "0 12px 32px rgba(15,23,42,0.12)",
  glow: (c: string) => `0 0 12px ${c}44`,
  // Scene shadows (for overlays on dark background)
  sceneSm: "0 2px 8px rgba(0,0,0,0.32)",
  sceneMd: "0 4px 16px rgba(0,0,0,0.40)",
} as const;

export const fontSize = {
  xs: "10px",
  sm: "11px",
  base: "12px",
  md: "13px",
  lg: "14px",
  xl: "16px",
  xxl: "20px",
  display: "24px",
  hero: "32px",
} as const;

export const fontWeight = {
  regular: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
} as const;

export const pbr = {
  concreteFloor: { color: '#bcc9d4', roughness: 0.85, metalness: 0, clearcoat: 0.02 },
  polishedConcrete: { color: '#c8d4dd', roughness: 0.3, metalness: 0.05, clearcoat: 0.3, clearcoatRoughness: 0.1 },
  galvanizedSteel: { color: '#8a9baa', roughness: 0.35, metalness: 0.75, clearcoat: 0.1, envMapIntensity: 0.6 },
  industrialMetal: { color: '#5a7080', roughness: 0.45, metalness: 0.85, envMapIntensity: 0.5 },
  glassPhysical: { color: '#aad4ee', roughness: 0.02, metalness: 0, clearcoat: 0.5, clearcoatRoughness: 0.1, transmission: 0.28, opacity: 0.38, ior: 1.52, envMapIntensity: 0.6 },
  mullion: { color: '#7a8c9e', roughness: 0.2, metalness: 0.7, envMapIntensity: 0.5 },
  asphalt: { color: '#4a525b', roughness: 0.92, metalness: 0 },
  woodOak: { color: '#d97706', roughness: 0.7, metalness: 0 },
  rubberMat: { color: '#1e293b', roughness: 0.9, metalness: 0 },
} as const;

export const thermal = {
  cold: '#3b82f6', // (22°C and below)
  cool: '#22c55e', // (22-24°C normal)
  warm: '#f59e0b', // (24-27°C elevated)
  hot: '#ef4444', // (27°C+ alarm)
  stops: [0.0, 0.33, 0.66, 1.0], // (normalized gradient stops)
} as const;

export const postProcessing = {
  bloom: { strength: 0.45, radius: 0.55, threshold: 0.78 },
  ssao: { radius: 0.12, bias: 0.001, intensity: 1.2 },
  toneMapping: { exposure: 1.65 },
  vignette: { offset: 0.75, darkness: 0.6 },
} as const;

/** Building geometry constants (3D model only). */
export const building = {
  // Convention centre proportions
  // Wide, low-rise — exhibition hall scale, NOT an office tower
  towerW: 36,           // wide exhibition hall footprint
  towerD: 24,           // deep — column-free hall depth
  floorH: 8.5,          // exhibition hall ceiling height (was 4.8 tower)
  floorCount: 4,        // 4 levels: L1-L2 exhibition, L3 roof plant, L4 sky garden
  podiumH: 0.5,         // low base, convention centre sits near ground
  
  groundPadW: 52,       // wider ground pad
  groundPadD: 38,
  siteW: 80,
  siteD: 60,

  // ── Exterior wall system (light panels + strategic glass, no full curtain wall) ──
  // White/light panel facade with recessed windows
  panelCols: 9,         // number of vertical wall panels along width
  panelRows: 3,         // horizontal panel divisions per floor
  
  mullionCols: 9,       // per wall
  mullionRows: 3,       // per floor
  glassTransmission: 0.28,
  glassOpacity: 0.38,

  slabT: 0.4,           // thicker slabs for exhibition hall spans
  columnSize: 0.6,      // larger columns for column-free spans

  // ── Sawtooth roof (signature feature) ──
  roofRidgeCount: 6,    // more ridges for wider building
  roofRidgeH: 3.0,      // taller ridge peaks (more dramatic)
  roofRidgeW: 6.0,      // width of each ridge base (towerW / ridgeCount)

  // ── Entrance atrium (large glass front feature) ──
  atriumW: 14,          // wider entrance - spans multiple bays
  atriumH: 8.0,         // full height of lower exhibition hall floor

  // ── Elevators — prominent external glass observation elevator ──
  elevatorShaftW: 2.5,
  elevatorShaftD: 2.5,
  elevatorCabW: 2.0,
  elevatorCabD: 2.0,
  elevatorCabH: 3.4,

  // ── Escalators (convention centre essential) ──
  escalatorWidth: 1.2,
  escalatorLength: 6.0,
  escalatorAngle: Math.PI / 6,  // 30 degrees

  // ── Interior ──
  interiorWallH: 4.0,
  interiorWallT: 0.08,

  // ── Stairwell ──
  stairwellW: 2.5,
  stairwellD: 3.0,
  stairTreadT: 0.1,
  stairRiserH: 0.18,

  // ── Ceiling grid ──
  lightPanelW: 0.8,
  lightPanelD: 0.8,
  lightPanelCols: 8,
  lightPanelRows: 6,
} as const;

export const camera = {
  fov: 45,
  near: 0.1,
  far: 250,
  /** Isometric corner view — frames both floors of the convention hall. */
  defaultPosition: [38, 14, 38] as [number, number, number],
  /** Look at the building volume center (midway between L1 and L2). */
  defaultTarget: [0, 8.75, 0] as [number, number, number],
  minDistance: 2,
  maxDistance: 120,
  /** Minimum polar angle ~27° — camera can never dip below the building's
   * horizontal plane, eliminating the "floor underside" glitch. */
  minPolarAngle: Math.PI * 0.15,  // ~27° — maintains isometric-ish downward angle
  maxPolarAngle: Math.PI * 0.85,
  dampingFactor: 0.05,
  autoRotateSpeed: 1.8,
} as const;

export const light = {
  ambient: { color: 0xffffff, intensity: 0.6 },
  sun: { color: 0xffffff, intensity: 1.4, position: [20, 30, 15] as [number, number, number] },
  fill: { color: 0xb4c8ff, intensity: 0.6, position: [-15, 20, -15] as [number, number, number] },
  shadow: {
    mapSize: 2048,
    bounds: 35,
    near: 1,
    far: 80,
  },
} as const;

export const fog = {
  color: 0xd8e2f0,      // matches light grey scene bg
  near: 60,
  far: 165,
} as const;

/** Marker sprite defaults (2D CanvasTexture billboards). */
export const marker = {
  size: 2.5,
  hoverScale: 1.3,
  faultPulseAmplitude: 0.075,   // 1.0 ± 0.075 → 0.925–1.075
  labelScale: [4, 1.2, 1] as [number, number, number],
} as const;

/** Scene overlay glass panel style — shared across all overlay components */
export const scenePanel = {
  base: "backdrop-blur-xl border shadow-lg",
  border: "border-slate-200",
  bg: "bg-white/90",
  bgLighter: "bg-white/75",
  text: "text-slate-900",
  textMuted: "text-slate-500",
  textDim: "text-slate-400",
  radius: "rounded-xl",
} as const;
