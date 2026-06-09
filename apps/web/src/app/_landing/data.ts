/**
 * Landing page content — all text lives here so copy changes are one-file edits.
 */

export const NAV = {
  logo: "DT",
  title: "Digital Twin FM",
  subtitle: "Facility intelligence, in real time",
  links: [
    { label: "Features", href: "#features" },
    { label: "Dashboard", href: "/dashboard" },
    { label: "About", href: "#how-it-works" },
  ],
} as const;

export const HERO = {
  badge: "Singapore Expo MVP",
  headline: "One building.\nEvery system.\nAlways live.",
  subtitle:
    "Monitor HVAC, chillers, boilers, pumps, and exhaust fans across every floor — with real-time sensor data, AI-powered insights, and instant fault alerts.",
  cta: { label: "View Live Demo", href: "/dashboard" },
  secondaryCta: { label: "Sign In", href: "/login" },
} as const;

export const STATS = {
  title: "Built for the Singapore Expo",
  subtitle: "Live from production infrastructure",
  items: [
    { value: "5.3M+", label: "Sensor Readings" },
    { value: "63", label: "Active Sensors" },
    { value: "20", label: "Assets Monitored" },
    { value: "5", label: "Building Floors" },
  ],
} as const;

export const FEATURES = {
  title: "Everything you need to run your building",
  subtitle: "Real-time facility intelligence, designed for operations teams.",
  items: [
    {
      title: "Live Sensors",
      body: "Temperature, humidity, CO₂, vibration, flow, power — every metric updated in real time through a Valkey pub/sub pipeline.",
      color: "#3b82f6",
      icon: "activity",
    },
    {
      title: "3D Digital Twin",
      body: "Full interactive Three.js building model with floor-by-floor asset markers, status colors, and orbital controls.",
      color: "#06b6d4",
      icon: "cube",
    },
    {
      title: "AI Copilot",
      body: "Ask plain-English questions about building health, energy usage, and recent alerts. Answers cite real data sources.",
      color: "#a855f7",
      icon: "sparkles",
    },
    {
      title: "Smart Alerts",
      body: "Threshold-based alerts with severity levels (low, medium, high, critical). Never miss a fault with real-time Valkey pub/sub.",
      color: "#f97316",
      icon: "bell",
    },
    {
      title: "Work Orders",
      body: "Track maintenance tasks per asset with full CRUD. Filter by status, priority, and assigned team.",
      color: "#10b981",
      icon: "clipboard",
    },
    {
      title: "Live Monitoring",
      body: "Dashboard with KPI strip, real-time charts, and per-floor sensor overview — all connected to live API data.",
      color: "#ef4444",
      icon: "monitor",
    },
  ],
} as const;

export const HOW_IT_WORKS = {
  title: "From deploy to insight in minutes",
  subtitle: "Three steps — no black magic.",
  steps: [
    {
      step: 1,
      title: "Deploy",
      body: "One `docker compose up` starts Postgres (TimescaleDB), Valkey, and all microservices. Infisical handles secrets.",
    },
    {
      step: 2,
      title: "Connect",
      body: "IoT / sensor simulator publishes readings to Valkey pub/sub. The ingestion worker validates, stores, and checks thresholds.",
    },
    {
      step: 3,
      title: "Monitor",
      body: "WebSocket gateway streams live updates to the 3D viewer. AI Copilot answers questions from real data. Alerts land instantly.",
    },
  ],
} as const;

export const FOOTER = {
  copyright: "Digital Twin FM — Singapore Expo MVP",
  links: [
    { label: "GitHub", href: "https://github.com/Saleheen-Akhtar/digital-twin-fm" },
    { label: "License", href: "/LICENSES.md" },
    { label: "Security", href: "/documents/mvp/SECURITY_AUDIT.md" },
  ],
} as const;
