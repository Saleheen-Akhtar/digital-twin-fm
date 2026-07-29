"use client";

import { DASHBOARD_PREVIEW } from "./data";
import Link from "next/link";

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
              <div className="h-full min-h-[400px] w-full bg-white brutalist-border relative overflow-hidden flex items-center justify-center">
                {/* Decorative grid mockup — avoids double WebGL context crash */}
                <div className="absolute inset-0 opacity-[0.04]"
                  style={{
                    backgroundImage: `linear-gradient(#000 1px, transparent 1px), linear-gradient(90deg, #000 1px, transparent 1px)`,
                    backgroundSize: '24px 24px',
                  }}
                />
                <div className="text-center px-6">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-black/5 flex items-center justify-center">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-black/40">
                      <path d="M21 16V8l-9-5-9 5v8l9 5 9-5z" />
                      <polyline points="3 8 12 13 21 8" />
                      <line x1="12" y1="22" x2="12" y2="13" />
                    </svg>
                  </div>
                  <p className="text-sm font-semibold uppercase tracking-wider text-black/60 mb-1">Interactive 3D Dashboard</p>
                  <p className="text-xs font-medium text-black/40 mb-6">Live sensors, alerts & AI Copilot</p>
                  <Link
                    href="/dashboard"
                    className="inline-block rounded-xl bg-black px-6 py-3 text-sm font-bold text-white hover:bg-gray-800 transition-colors"
                  >
                    Open Live Dashboard →
                  </Link>
                </div>
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
