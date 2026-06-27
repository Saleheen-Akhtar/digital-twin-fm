/**
 * Landing page content — all text lives here so copy changes are one-file edits.
 */
import { building as B } from "@/design-system/tokens";

export const NAV = {
  logo: "DT",
  title: "Digital Twin FM",
  subtitle: "Facility intelligence, in real time",
  links: [
    { label: "Features", href: "#features" },
    { label: "Live Demo", href: "/dashboard" },
    { label: "How it works", href: "#how-it-works" },
    { label: "FAQ", href: "#faq" },
  ],
} as const;

export const HERO = {
  badge: "Live MVP",
  badgeStatus: "All systems operational",
  headline: "See every asset.\nPredict every fault.\nOperate with confidence.",
  subtitle:
    "A real-time 3D digital twin for HVAC, chillers, boilers, pumps, and exhaust fans — with live sensor data, AI-powered insights, and instant fault alerts across every floor of your building.",
  cta: { label: "Open Live Dashboard", href: "/dashboard" },
  secondaryCta: { label: "Sign In", href: "/login" },
  liveLabel: "Streaming live from Singapore Expo — Hall 7",
} as const;

/**
 * Static demo stats. The "Building Floors" count is a fallback only — the
 * hero on the landing page resolves `STATS.items` at render time and
 * overrides `Building Floors` with whatever the API reports. If the API
 * is down it shows the design-token default (currently 2 for Singapore
 * Expo Hall 7). This keeps the marketing copy honest as soon as a
 * customer onboards with their own building.
 */
export const STATS = {
  title: "Production-grade from day one",
  subtitle: "Real numbers from the deployed demo instance",
  items: [
    { value: "5.3M+", label: "Sensor Readings" },
    { value: "63", label: "Active Sensors" },
    { value: "20", label: "Assets Monitored" },
    { value: String(B.floorCount), label: "Building Floors" },
  ],
} as const;

/**
 * Live KPIs — rendered on the landing page as a single strip. The hero
 * widget polls `/api/proxy/building/snapshot` every 2 seconds and
 * formats the result into the 5 KPI tiles. When the API is down we
 * fall back to the demo numbers so the page never looks broken.
 */
export const LIVE_KPI = {
  title: "What's happening right now",
  subtitle: "Live feed from the demo building · auto-refreshes every 2s",
  metrics: [
    { key: "temperature", label: "Temperature", unit: "°C", fallback: "22.4", color: "#3b82f6", icon: "🌡️" },
    { key: "power", label: "Power", unit: " kW", fallback: "847", color: "#f59e0b", icon: "⚡" },
    { key: "alerts", label: "Active Alerts", unit: "", fallback: "0", color: "#ef4444", icon: "🔔" },
    { key: "occupancy", label: "Occupancy", unit: "%", fallback: "72", color: "#8b5cf6", icon: "👥" },
    { key: "energy", label: "Energy Today", unit: " kWh", fallback: "1,248", color: "#06b6d4", icon: "📊" },
  ],
} as const;

/**
 * Dashboard preview — text-only "screenshot" annotations that sit
 * beside the real 3D viewer. Real screenshots can be swapped in once
 * Marketing has approved ones.
 */
export const DASHBOARD_PREVIEW = {
  title: "A dashboard built for operators, not analysts",
  subtitle:
    "Everything you need on one screen — no tab-switching, no waiting for reports.",
  bullets: [
    {
      title: "3D Digital Twin",
      body: "Walk through every floor of your building. Click any asset to inspect live readings, history, and work orders.",
      icon: "cube",
      color: "#06b6d4",
    },
    {
      title: "Live KPI Strip",
      body: "Five critical metrics at a glance — temperature, power, alerts, occupancy, energy. Updates the moment a sensor publishes.",
      icon: "activity",
      color: "#3b82f6",
    },
    {
      title: "AI Copilot",
      body: 'Ask "why is the upper level hot?" in plain English. Get an answer backed by the actual sensor history — not a hallucination.',
      icon: "sparkles",
      color: "#a855f7",
    },
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

/**
 * Architecture / tech stack — for the developer / technical buyer.
 * Keeps the copy vendor-neutral while naming concrete technologies
 * that engineers care about.
 */
export const STACK = {
  title: "Built on the stack you already trust",
  subtitle:
    "No proprietary runtimes, no vendor lock-in. Every layer is MIT-licensed and runs on commodity hardware.",
  layers: [
    {
      tier: "Frontend",
      items: ["Next.js 15", "React 19", "Three.js", "TanStack Query"],
      color: "#3b82f6",
    },
    {
      tier: "Backend",
      items: ["NestJS 11", "Node.js 22", "WebSocket Gateway", "Drizzle ORM"],
      color: "#10b981",
    },
    {
      tier: "Data",
      items: ["PostgreSQL 17", "TimescaleDB", "Valkey (Redis fork)", "Pub/Sub Streaming"],
      color: "#f59e0b",
    },
    {
      tier: "AI & Ops",
      items: ["LiteLLM", "OpenCode Zen", "Infisical Secrets", "Docker Compose"],
      color: "#a855f7",
    },
  ],
  bullets: [
    "Single `docker compose up` brings the whole stack online",
    "Secrets managed by Infisical — never committed to the repo",
    "WebSocket gateway streams live updates; no polling",
    "AI model swappable via LiteLLM (DeepSeek, GPT-4o, Claude, local)",
  ],
} as const;

/**
 * Use cases / personas — "Built for the people who actually run the
 * building". Three roles, three concrete day-in-the-life snippets.
 */
export const USE_CASES = {
  title: "Built for the people who run the building",
  subtitle: "Different roles, same single source of truth.",
  items: [
    {
      role: "Facility Manager",
      icon: "👷",
      headline: "See the whole portfolio without leaving your desk.",
      body: "Open the dashboard. The 3D twin shows every asset on every floor, color-coded by status. Drill into any alert to see the live sensor feed and the work-order history.",
      metric: "↓ 60% time spent triaging alerts",
    },
    {
      role: "Maintenance Technician",
      icon: "🔧",
      headline: "Walk in knowing exactly what's broken.",
      body: "Get a push notification the moment a chiller crosses its vibration threshold. The work order already tells you which asset, which floor, what to bring.",
      metric: "↓ 40% mean time to repair",
    },
    {
      role: "Portfolio Owner",
      icon: "📈",
      headline: "Energy and uptime, month over month.",
      body: "Trend views surface which buildings are drifting off baseline. The AI Copilot writes the monthly narrative — you sign off on the data.",
      metric: "↓ 12% energy cost",
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

/**
 * FAQ — answers the four objections that actually kill deals.
 * Concise on purpose: long answers don't get read.
 */
export const FAQ = {
  title: "Questions you might have",
  subtitle: "Short answers. Ask anything else in the demo.",
  items: [
    {
      q: "How long does installation actually take?",
      a: "The demo stack runs on your laptop in under 5 minutes with Docker Compose. Production onboarding — connecting your real sensors — typically takes 1–2 weeks for a single building.",
    },
    {
      q: "What does it cost?",
      a: "The platform is MIT-licensed — free to run yourself. Managed hosting and AI inference are priced per asset per month. Talk to us for a quote.",
    },
    {
      q: "Does it work with my existing sensors?",
      a: "Yes, if they publish over MQTT, Modbus TCP, or HTTP. The ingestion worker is a thin adapter layer — most protocols plug in with a 50-line handler.",
    },
    {
      q: "What about my data — who can see it?",
      a: "Your data lives in your infrastructure. AI inference is configurable per-question; nothing leaves your network unless you opt in.",
    },
    {
      q: "Can the AI hallucinate bad answers?",
      a: "Yes — and that's why the AI Copilot only answers from the live building context we pass it. Every claim is grounded in a real sensor reading or alert row.",
    },
  ],
} as const;

/**
 * Final CTA — the last block before the footer.
 * Echoes the hero CTA so users who scrolled past it still see one
 * clear next step.
 */
export const FINAL_CTA = {
  headline: "Ready to see your building live?",
  subtitle:
    "Open the demo dashboard — every sensor, every alert, every floor, streaming right now.",
  primary: { label: "Open Live Dashboard", href: "/dashboard" },
  secondary: { label: "Read the docs", href: "/documents/mvp/README.md" },
} as const;

export const FOOTER = {
  copyright: `© ${new Date().getFullYear()} Digital Twin FM — MIT licensed`,
  links: [
    { label: "GitHub", href: "https://github.com/Saleheen-Akhtar/digital-twin-fm" },
    { label: "Docs", href: "/documents/mvp/README.md" },
    { label: "License", href: "/LICENSES.md" },
    { label: "Security", href: "/documents/mvp/SECURITY_AUDIT.md" },
  ],
} as const;
