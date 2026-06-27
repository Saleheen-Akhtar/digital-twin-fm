"use client";

import dynamic from "next/dynamic";
import { DASHBOARD_PREVIEW } from "./data";

// Inline icons (no library dep)
const icons: Record<string, (c: string) => React.ReactNode> = {
  activity: (c) => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  ),
  cube: (c) => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
      <line x1="12" y1="22.08" x2="12" y2="12" />
    </svg>
  ),
  sparkles: (c) => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z" />
      <path d="M18.5 16.5L21 18l-2.5 1.5L17 22l-1.5-2.5L13 18l2.5-1.5L17 14l1.5 2.5z" />
    </svg>
  ),
};

// Smaller 3D viewer, lazy-loaded — no markers, gentle auto-rotate
const Viewer = dynamic(
  () =>
    import("@/features/digital-twin/viewer-3d").then(
      (m) => m.DigitalTwinViewer3D,
    ),
  {
    ssr: false,
    loading: () => (
      <div
        className="w-full h-full min-h-[320px] flex items-center justify-center rounded-2xl text-slate-400 text-xs"
        style={{ background: "#f1f5f9" }}
      >
        Loading 3D preview…
      </div>
    ),
  },
);

export function LandingDashboardPreview() {
  return (
    <section
      className="py-20 px-6"
      style={{ background: "#f7f9fd" }}
    >
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-12 animate-fade-in">
          <h2
            className="text-2xl md:text-3xl font-bold mb-2"
            style={{ color: "#0f172a" }}
          >
            {DASHBOARD_PREVIEW.title}
          </h2>
          <p
            className="text-sm max-w-2xl mx-auto"
            style={{ color: "#475569" }}
          >
            {DASHBOARD_PREVIEW.subtitle}
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 items-center">
          {/* Left: 3D viewer (2 cols) */}
          <div className="lg:col-span-3 animate-fade-in-up delay-1">
            <div
              className="rounded-2xl overflow-hidden"
              style={{
                border: "1px solid rgba(201,214,255,0.5)",
                boxShadow: "0 8px 32px rgba(15,23,42,0.08)",
              }}
            >
              <div className="aspect-[16/10] w-full">
                {/* Showcase mode for the marketing preview */}
                <Viewer mode="showcase" showMarkers={false} autoRotate={true} />
              </div>
            </div>
            <p className="text-[11px] text-center text-slate-400 mt-2">
              ↑ Drag to rotate · scroll to zoom · click the dashboard to inspect any asset
            </p>
          </div>

          {/* Right: bullet callouts (3 cols) */}
          <div className="lg:col-span-2 space-y-4">
            {DASHBOARD_PREVIEW.bullets.map((b, i) => (
              <div
                key={b.title}
                className={`p-5 rounded-2xl bg-white border border-slate-200 animate-fade-in-up delay-${i + 2}`}
                style={{ boxShadow: "0 1px 3px rgba(15,23,42,0.04)" }}
              >
                <div className="flex items-start gap-3">
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: `${b.color}14` }}
                  >
                    {icons[b.icon]?.(b.color)}
                  </div>
                  <div>
                    <h3
                      className="text-sm font-semibold mb-1"
                      style={{ color: "#0f172a" }}
                    >
                      {b.title}
                    </h3>
                    <p
                      className="text-xs leading-relaxed"
                      style={{ color: "#475569" }}
                    >
                      {b.body}
                    </p>
                  </div>
                </div>
              </div>
            ))}
            <a
              href="/dashboard"
              className="block w-full text-center px-4 py-2.5 text-xs font-semibold rounded-xl no-underline transition-all"
              style={{
                background: "linear-gradient(135deg, #355fe5, #3c73ff)",
                color: "#ffffff",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow =
                  "0 6px 20px rgba(53,95,229,0.35)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = "none";
              }}
            >
              Try the live dashboard →
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
