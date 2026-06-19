"use client";

import { STATS } from "./data";

export function LandingStats() {
  return (
    <section
      className="py-16 px-6"
      style={{ background: "#ffffff", borderTop: "1px solid #c9d6ff" }}
    >
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-10 animate-fade-in">
          <h2
            className="text-xl font-bold mb-1"
            style={{ color: "#0f172a" }}
          >
            {STATS.title}
          </h2>
          <p className="text-sm" style={{ color: "#94a3b8" }}>
            {STATS.subtitle}
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {STATS.items.map((item, i) => (
            <div
              key={item.label}
              className={`text-center p-6 rounded-2xl animate-count-up delay-${
                i + 1
              }`}
              style={{
                background: "#f7f9fd",
                border: "1px solid rgba(201,214,255,0.4)",
              }}
            >
              <div
                className="text-3xl md:text-4xl font-bold mb-1 stat-value"
              >
                {item.value}
              </div>
              <div
                className="text-xs font-medium"
                style={{ color: "#475569" }}
              >
                {item.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
