/**
 * Digital Twin FM — Design System Tokens (Brutalist / Minimalist Redesign)
 *
 * Single source of truth for all visual constants.
 * Embracing a bold, stark, high-contrast aesthetic.
 */

export const colors = {
  // ── Backgrounds (Brutalist theme) ──
  bg: {
    canvas: "#f4f4f0",       // Off-white/beige canvas common in brutalism
    surface: "#ffffff",      // Pure white cards, panels
    surfaceTranslucent: "rgba(255,255,255,0.9)",
    ground: "#e0e0e0",       // 3D ground plane
    subtle: "#eaeaea",       // dividers
    dark: "#111111",         // deep almost-black for stark contrast
  },

  // ── Building (3D model materials) - kept relatively similar for 3D legibility but more desaturated ──
  building: {
    ground: 0xe0e0e0,
    podium: 0x888888,
    slab: 0xdddddd,
    glass: 0x333333,
    mullion: 0x222222,
    column: 0x000000,
    penthouse: 0xa0a0a0,
    mechanical: 0x555555,
    antenna: 0x111111,
    canopy: 0x333333,
    entrancePanel: 0x000000,
    window: 0xe0e0e0,
    windowEmissive: 0xffffff,
    wireframe: 0x000000,
    gridCell: 0xcccccc,
    gridSection: 0x999999,
  },

  // ── Status (operational / warning / fault) ──
  status: {
    operational: "#000000", // using pure black for success in brutalist
    warning: "#ffeb3b",     // bright stark yellow
    fault: "#ff0000",       // bright stark red
  },
  statusHex: {
    operational: 0x000000,
    warning: 0xffeb3b,
    fault: 0xff0000,
  },

  // ── Asset types (color-coded legend + marker tint) ──
  type: {
    "Air Handler": "#0000ff", // stark blue
    Chiller: "#00ffff",       // stark cyan
    Boiler: "#ff0000",        // stark red
    Pump: "#ff00ff",          // stark magenta
    Fan: "#00ff00",           // stark green
  },
  typeHex: {
    "Air Handler": 0x0000ff,
    Chiller: 0x00ffff,
    Boiler: 0xff0000,
    Pump: 0xff00ff,
    Fan: 0x00ff00,
  },

  // ── Text ──
  text: {
    primary: "#111111",
    secondary: "#555555",
    muted: "#888888",
    onSurface: "#111111",
    onDark: "#ffffff",
    accent: "#ff0000", // Strong red accent for brutalism
  },

  // ── Borders ──
  border: {
    light: "#111111", // Hard black borders
    subtle: "rgba(17,17,17,0.2)",
    panel: "2px solid #111111",
    card: "2px solid #111111",
  },

  // ── Accent ──
  accent: {
    from: "#111111",
    to: "#111111",
    brand: "#ff3300", // Bright accent color if needed
  },
} as const;

export const spacing = {
  xxs: "4px",
  xs: "8px",
  sm: "16px",
  md: "24px",
  lg: "32px",
  xl: "48px",
  xxl: "64px",
  xxxl: "128px",
} as const;

// Minimal/No border radius for brutalist aesthetic
export const radius = {
  sm: "0px",
  md: "0px",
  lg: "0px",
  xl: "0px",
  xxl: "0px",
  pill: "9999px", // might still use pill for some badges
} as const;

// Hard, stark shadows instead of soft blurs
export const shadow = {
  sm: "2px 2px 0px #111111",
  md: "4px 4px 0px #111111",
  lg: "8px 8px 0px #111111",
  xl: "12px 12px 0px #111111",
  glow: (c: string) => `0 0 0px 4px ${c}`,
} as const;

export const fontSize = {
  xs: "12px",
  sm: "14px",
  base: "16px",
  md: "18px",
  lg: "24px",
  xl: "32px",
  xxl: "48px",
  display: "64px",
  hero: "96px", // massive hero text
} as const;

export const fontWeight = {
  regular: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
  black: 900,
} as const;

/** Building geometry constants (3D model only). */
export const building = {
  towerW: 36,
  towerD: 24,
  floorH: 8.5,
  floorCount: 2,
  podiumH: 0.5,
  panelCols: 9,
  panelRows: 3,
  slabT: 0.4,
  columnSize: 0.6,
  roofRidgeCount: 6,
  roofRidgeH: 3.0,
  roofRidgeW: 6.0,
  atriumW: 14,
  atriumH: 8.0,
  elevatorShaftW: 2.5,
  elevatorShaftD: 2.5,
  elevatorCabW: 2.0,
  elevatorCabD: 2.0,
  elevatorCabH: 3.4,
  escalatorWidth: 1.2,
  escalatorLength: 6.0,
  escalatorAngle: Math.PI / 6,
  interiorWallH: 4.0,
  interiorWallT: 0.08,
  stairwellW: 2.5,
  stairwellD: 3.0,
  stairTreadT: 0.1,
  stairRiserH: 0.18,
  lightPanelW: 0.8,
  lightPanelD: 0.8,
  lightPanelCols: 8,
  lightPanelRows: 6,
} as const;

export const camera = {
  fov: 45,
  near: 0.1,
  far: 250,
  defaultPosition: [35, 12, 35] as [number, number, number],
  defaultTarget: [0, 8.75, 0] as [number, number, number],
  minDistance: 2,
  maxDistance: 120,
  minPolarAngle: Math.PI * 0.15,
  maxPolarAngle: Math.PI * 0.85,
  dampingFactor: 0.05,
  autoRotateSpeed: 0.5,
} as const;

export const light = {
  ambient: { color: 0xffffff, intensity: 0.8 },
  sun: { color: 0xffffff, intensity: 1.5, position: [20, 30, 15] as [number, number, number] },
  fill: { color: 0xffffff, intensity: 0.8, position: [-15, 20, -15] as [number, number, number] },
  shadow: {
    mapSize: 2048,
    bounds: 35,
    near: 1,
    far: 80,
  },
} as const;

export const fog = {
  color: 0xf4f4f0,
  near: 80,
  far: 180,
} as const;

export const marker = {
  size: 2.5,
  hoverScale: 1.3,
  faultPulseAmplitude: 0.075,
  labelScale: [4, 1.2, 1] as [number, number, number],
} as const;
