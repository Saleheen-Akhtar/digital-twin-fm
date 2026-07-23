"use client";

import dynamic from "next/dynamic";
import { DASHBOARD_PREVIEW } from "./data";
import { colors } from "@/design-system/tokens";

const icons: Record<string, (_c: string) => React.ReactNode> = {
  activity: (_c) => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="2.5" strokeLinecap="square" strokeLinejoin="miter">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  ),
  cube: (_c) => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="2.5" strokeLinecap="square" strokeLinejoin="miter">
      <path d="M21 16V8l-9-5-9 5v8l9 5 9-5z" />
      <polyline points="3 8 12 13 21 8" />
      <line x1="12" y1="22" x2="12" y2="13" />
    </svg>
  ),
  sparkles: (_c) => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="2.5" strokeLinecap="square" strokeLinejoin="miter">
      <path d="M12 3l2 5 5 2-5 2-2 5-2-5-5-2 5-2 2-5z" />
      <path d="M19 15l1 2 2 1-2 1-1 2-1-2-2-1 2-1 1-2z" />
    </svg>
  ),
};

const Viewer = dynamic(
  () =>
    import("@/features/digital-twin/viewer-3d").then(
      (m) => m.DigitalTwinViewer3D,
    ),
  {
    ssr: false,
    loading: () => (
      <div
        className="w-full h-full min-h-[320px] flex items-center justify-center brutalist-border"
        style={{ background: colors.bg.subtle }}
      >
        <span className="text-sm font-bold uppercase tracking-widest text-black">Loading 3D Preview...</span>
      </div>
    ),
  },
);

export function LandingDashboardPreview() {
  return (
    <section
      className="py-24 px-6 brutalist-border-b bg-white"
    >
      <div className="max-w-screen-2xl mx-auto">
        <div className="text-center mb-16 animate-fade-in">
          <h2
            className="text-4xl md:text-5xl lg:text-6xl font-black uppercase tracking-tighter mb-4"
          >
            {DASHBOARD_PREVIEW.title}
          </h2>
          <p
            className="text-base font-bold uppercase tracking-widest max-w-3xl mx-auto text-gray-600"
          >
            {DASHBOARD_PREVIEW.subtitle}
          </p>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-5 gap-12 items-stretch">
          {/* Left: 3D viewer */}
          <div className="xl:col-span-3 animate-fade-in-up delay-1 h-full">
            <div className="h-full bg-black p-2 brutalist-border shadow-[12px_12px_0px_#111]">
              <div className="h-full min-h-[400px] w-full bg-white brutalist-border relative">
                <Viewer mode="showcase" showMarkers={false} autoRotate={true} />
              </div>
            </div>
          </div>

          {/* Right: callouts */}
          <div className="xl:col-span-2 flex flex-col gap-6 justify-center">
            {DASHBOARD_PREVIEW.bullets.map((b, i) => (
              <div
                key={b.title}
                className={`p-6 bg-white brutalist-border animate-fade-in-up delay-${i + 2}`}
                style={{ boxShadow: "6px 6px 0px #111" }}
              >
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 flex items-center justify-center brutalist-border bg-gray-100 shrink-0">
                    {icons[b.icon]?.(b.color)}
                  </div>
                  <div>
                    <h3 className="text-lg font-black uppercase tracking-wide mb-2 text-black">
                      {b.title}
                    </h3>
                    <p className="text-sm font-medium leading-relaxed text-gray-700">
                      {b.body}
                    </p>
                  </div>
                </div>
              </div>
            ))}
            <a
              href="/dashboard"
              className="btn-brutalist block w-full text-center px-6 py-4 text-base mt-4"
            >
              Try the live dashboard
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
