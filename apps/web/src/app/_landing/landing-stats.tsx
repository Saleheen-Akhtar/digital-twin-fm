"use client";

import { STATS } from "./data";
import { colors } from "@/design-system/tokens";

export function LandingStats() {
  return (
    <section className="py-24 px-6 brutalist-border-b" style={{ background: colors.bg.canvas }}>
      <div className="max-w-screen-2xl mx-auto">
        <div className="text-center mb-16 animate-fade-in">
          <h2
            className="text-4xl md:text-5xl lg:text-6xl font-black uppercase tracking-tighter mb-4"
            style={{ color: colors.text.primary }}
          >
            {STATS.title}
          </h2>
          <p
            className="text-lg font-bold uppercase tracking-widest max-w-2xl mx-auto"
            style={{ color: colors.text.secondary }}
          >
            {STATS.subtitle}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {STATS.items.map((stat, i) => (
            <div
              key={stat.label}
              className={`p-8 brutalist-border bg-white text-center animate-fade-in-up delay-${i + 1}`}
              style={{
                boxShadow: "8px 8px 0px #111111",
              }}
            >
              <div
                className="text-5xl md:text-6xl font-black tracking-tighter mb-2"
                style={{ color: colors.text.primary }}
              >
                {stat.value}
              </div>
              <div
                className="text-xs font-bold uppercase tracking-widest"
                style={{ color: colors.text.secondary }}
              >
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
