"use client";

/**
 * Homepage — public 3D building preview.
 *
 * Shows the Digital Twin FM building model (no asset markers, slowly
 * auto-rotating) so unauthenticated visitors can see the facility
 * before logging in. The viewer itself renders the building info
 * panel (floor list + asset counts) in the top-left.
 */

import dynamic from "next/dynamic";
import Link from "next/link";

// Raw Three.js (WebGL) — must be client-only. No SSR.
const Viewer = dynamic(
  () =>
    import("@/features/digital-twin/viewer-3d").then(
      (m) => m.DigitalTwinViewer3D,
    ),
  {
    ssr: false,
    loading: () => (
      <div
        className="w-full h-[640px] flex items-center justify-center"
        style={{
          background: "#0a0e1a",
          color: "rgba(255,255,255,0.5)",
          borderRadius: "1rem",
        }}
      >
        Loading 3D preview…
      </div>
    ),
  },
);

export default function HomePage() {
  return (
    <main
      className="min-h-screen flex flex-col"
      style={{ background: "#0a0e1a" }}
    >
      {/* Header bar — same dark style as the viewer panels */}
      <header
        className="px-6 py-4 flex items-center justify-between"
        style={{
          background: "rgba(10,14,26,0.92)",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        <div className="flex items-center gap-3">
          <div
            className="h-8 w-8 rounded-lg flex items-center justify-center"
            style={{
              background:
                "linear-gradient(135deg, #355fe5 0%, #3c73ff 100%)",
              color: "#ffffff",
              fontWeight: 700,
              fontSize: "14px",
            }}
          >
            DT
          </div>
          <div>
            <div
              className="text-sm font-semibold"
              style={{ color: "#f1f5f9" }}
            >
              Digital Twin FM
            </div>
            <div
              className="text-[11px]"
              style={{ color: "#94a3b8" }}
            >
              Facility intelligence, in real time
            </div>
          </div>
        </div>
        <nav className="flex items-center gap-2">
          <Link
            href="/login"
            className="px-4 py-2 text-xs font-semibold transition-colors"
            style={{
              background: "#ffffff",
              color: "#0a0e1a",
              borderRadius: "0.75rem",
            }}
          >
            Sign in
          </Link>
        </nav>
      </header>

      {/* Hero / 3D preview */}
      <section className="flex-1 px-6 py-8 flex flex-col items-center">
        <div className="w-full max-w-6xl text-center mb-6">
          <h1
            className="text-3xl md:text-4xl font-semibold mb-2"
            style={{ color: "#f1f5f9" }}
          >
            One building. Every system. Always live.
          </h1>
          <p
            className="text-sm md:text-base"
            style={{ color: "#94a3b8" }}
          >
            Monitor HVAC, chillers, boilers, pumps, and exhaust fans
            across every floor — with real-time sensor data, AI-powered
            insights, and instant fault alerts.
          </p>
        </div>

        <div className="w-full max-w-6xl">
          <Viewer showMarkers={false} autoRotate={true} />
        </div>

        <div
          className="w-full max-w-6xl mt-6 grid grid-cols-1 md:grid-cols-3 gap-3"
        >
          {[
            {
              title: "Live sensor stream",
              body: "Temperature, airflow, pressure, vibration, CO2 — polled every 30s, updated on every change.",
            },
            {
              title: "AI Copilot",
              body: "Ask plain-English questions about building health, energy, and recent alerts. Answers cite real data.",
            },
            {
              title: "One-click drilldown",
              body: "Click any asset to see its metrics, service history, and open work orders in a side panel.",
            },
          ].map((card) => (
            <div
              key={card.title}
              className="p-4"
              style={{
                background: "rgba(10,14,26,0.92)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: "1rem",
                backdropFilter: "blur(8px)",
              }}
            >
              <div
                className="text-sm font-semibold mb-1"
                style={{ color: "#f1f5f9" }}
              >
                {card.title}
              </div>
              <div
                className="text-[12px] leading-relaxed"
                style={{ color: "#94a3b8" }}
              >
                {card.body}
              </div>
            </div>
          ))}
        </div>
      </section>

      <footer
        className="px-6 py-4 text-center text-[11px]"
        style={{
          color: "#475569",
          borderTop: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        © Digital Twin FM — Singapore Expo MVP
      </footer>
    </main>
  );
}
