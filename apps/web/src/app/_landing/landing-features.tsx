"use client";

import { FEATURES } from "./data";

const icons: Record<string, (_c: string) => React.ReactNode> = {
  activity: (_c) => (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="2" strokeLinecap="square" strokeLinejoin="miter"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>
  ),
  cube: (_c) => (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="2" strokeLinecap="square" strokeLinejoin="miter"><path d="M21 16V8l-9-5-9 5v8l9 5 9-5z" /><polyline points="3 8 12 13 21 8" /><line x1="12" y1="22" x2="12" y2="13" /></svg>
  ),
  sparkles: (_c) => (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="2" strokeLinecap="square" strokeLinejoin="miter"><path d="M12 3l2 5 5 2-5 2-2 5-2-5-5-2 5-2 2-5z" /><path d="M19 15l1 2 2 1-2 1-1 2-1-2-2-1 2-1 1-2z" /><path d="M5 15l1 2 2 1-2 1-1 2-1-2-2-1 2-1 1-2z" /></svg>
  ),
  bell: (_c) => (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="2" strokeLinecap="square" strokeLinejoin="miter"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>
  ),
  clipboard: (_c) => (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="2" strokeLinecap="square" strokeLinejoin="miter"><path d="M16 4h2v16H6V4h2" /><rect x="8" y="2" width="8" height="4" /><line x1="9" y1="12" x2="15" y2="12" /><line x1="9" y1="16" x2="13" y2="16" /></svg>
  ),
  monitor: (_c) => (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="2" strokeLinecap="square" strokeLinejoin="miter"><rect x="2" y="3" width="20" height="14" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" /></svg>
  ),
};

export function LandingFeatures() {
  return (
    <section id="features" className="py-24 px-6 brutalist-border-b bg-[#f4f4f0]">
      <div className="max-w-screen-2xl mx-auto">
        <div className="text-center mb-20 animate-fade-in">
          <h2 className="text-4xl md:text-5xl lg:text-7xl font-black uppercase tracking-tighter mb-6 text-black">
            {FEATURES.title}
          </h2>
          <p className="text-base md:text-lg font-bold uppercase tracking-widest max-w-2xl mx-auto text-gray-700">
            {FEATURES.subtitle}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {FEATURES.items.map((item, i) => (
            <div
              key={item.title}
              className={`feature-card p-8 bg-white brutalist-border animate-fade-in-up delay-${i + 1}`}
              style={{ boxShadow: "8px 8px 0px #111" }}
            >
              <div className="w-14 h-14 flex items-center justify-center brutalist-border bg-gray-100 mb-6">
                {icons[item.icon]?.(item.color)}
              </div>
              <h3 className="text-xl font-black uppercase tracking-wide mb-4 text-black">
                {item.title}
              </h3>
              <p className="text-base font-medium leading-relaxed text-gray-700">
                {item.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
