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

  // ── Building (3D model materials) ──
  building: {
    ground: 0xe8eef7,
    podium: 0x94a3b8,
    slab: 0xe2e8f0,
    glass: 0x5b8fd9,
    mullion: 0x94a3b8,
    column: 0x64748b,
    penthouse: 0xcbd5e1,
    mechanical: 0x94a3b8,
    antenna: 0x64748b,
    canopy: 0x64748b,
    entrancePanel: 0x475569,
    window: 0x88ccff,        // emissive accent
    windowEmissive: 0x4488cc,
    wireframe: 0x2a4070,
    gridCell: 0xd4dce8,
    gridSection: 0xc2cbdc,
  },

  // ── Status (operational / warning / fault) ──
  status: {
    operational: "#22c55e",
    warning: "#eab308",
    fault: "#ef4444",
  },
  statusHex: {
    operational: 0x22c55e,
    warning: 0xeab308,
    fault: 0xef4444,
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

/** Building geometry constants (3D model only). */
export const building = {
  towerW: 18,
  towerD: 14,
  floorH: 4.2,
  floorCount: 4,
  podiumH: 2.2,
  mullionCols: 5,
  mullionRows: 3,
  slabT: 0.35,
  mullionT: 0.12,
  columnSize: 0.5,
  glassTransmission: 0.6,
  glassOpacity: 0.55,
} as const;

export const camera = {
  fov: 50,
  near: 0.1,
  far: 200,
  defaultPosition: [30, 25, 30] as [number, number, number],
  defaultTarget: [0, 8, 0] as [number, number, number],
  minDistance: 8,
  maxDistance: 80,
  minPolarAngle: 0,
  maxPolarAngle: Math.PI * 0.85,
  dampingFactor: 0.05,
  autoRotateSpeed: 0.6,
} as const;

export const light = {
  ambient: { color: 0xffffff, intensity: 0.5 },
  sun: { color: 0xffffff, intensity: 1.2, position: [15, 25, 10] as [number, number, number] },
  fill: { color: 0xb4c8ff, intensity: 0.5, position: [-10, 15, -10] as [number, number, number] },
  shadow: {
    mapSize: 2048,
    bounds: 25,
    near: 1,
    far: 60,
  },
} as const;

export const fog = {
  color: 0xf7f9fd,
  near: 60,
  far: 140,
} as const;

/** Marker sprite defaults (2D CanvasTexture billboards). */
export const marker = {
  size: 2.5,
  hoverScale: 1.3,
  faultPulseAmplitude: 0.075,   // 1.0 ± 0.075 → 0.925–1.075
  labelScale: [4, 1.2, 1] as [number, number, number],
} as const;
