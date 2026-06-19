"use client";

import { FEATURES } from "./data";

/* Simple inline SVG icons — no icon library dependency */
const icons: Record<string, (c: string) => React.ReactNode> = {
  activity: (c) => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  ),
  cube: (c) => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
      <line x1="12" y1="22.08" x2="12" y2="12" />
    </svg>
  ),
  sparkles: (c) => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z" />
      <path d="M18.5 16.5L21 18l-2.5 1.5L17 22l-1.5-2.5L13 18l2.5-1.5L17 14l1.5 2.5z" />
      <path d="M6 14l1.5 2.5L10 18l-2.5 1.5L6 22l-1.5-2.5L2 18l2.5-1.5L6 14z" />
    </svg>
  ),
  bell: (c) => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  ),
  clipboard: (c) => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
      <line x1="9" y1="12" x2="15" y2="12" />
      <line x1="9" y1="16" x2="13" y2="16" />
    </svg>
  ),
  monitor: (c) => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
      <line x1="8" y1="21" x2="16" y2="21" />
      <line x1="12" y1="17" x2="12" y2="21" />
    </svg>
  ),
};

export function LandingFeatures() {
  return (
    <section
      id="features"
      className="py-20 px-6"
      style={{ background: "#f7f9fd" }}
    >
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-14 animate-fade-in">
          <h2
            className="text-2xl md:text-3xl font-bold mb-2"
            style={{ color: "#0f172a" }}
          >
            {FEATURES.title}
          </h2>
          <p className="text-sm max-w-lg mx-auto" style={{ color: "#475569" }}>
            {FEATURES.subtitle}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {FEATURES.items.map((item, i) => (
            <div
              key={item.title}
              className={`feature-card p-6 rounded-2xl animate-fade-in-up delay-${
                i + 1
              }`}
              style={{
                background: "#ffffff",
                border: "1px solid rgba(201,214,255,0.4)",
              }}
            >
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center mb-4"
                style={{
                  background: `${item.color}14`,
                }}
              >
                {icons[item.icon]?.(item.color)}
              </div>
              <h3
                className="text-sm font-semibold mb-2"
                style={{ color: "#0f172a" }}
              >
                {item.title}
              </h3>
              <p
                className="text-xs leading-relaxed"
                style={{ color: "#475569" }}
              >
                {item.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
