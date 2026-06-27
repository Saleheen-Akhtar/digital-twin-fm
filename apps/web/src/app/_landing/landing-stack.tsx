"use client";

import { STACK } from "./data";

/**
 * Tech stack section — for the technical buyer. Shows the actual
 * technologies in 4 layers (Frontend, Backend, Data, AI & Ops) and
 * four concrete operational bullets.
 *
 * No logos / no third-party brand marks — keeps the section MIT-clean
 * and avoids implying endorsements we don't have.
 */
export function LandingStack() {
  return (
    <section
      id="stack"
      className="py-20 px-6"
      style={{ background: "#ffffff" }}
    >
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-12 animate-fade-in">
          <h2
            className="text-2xl md:text-3xl font-bold mb-2"
            style={{ color: "#0f172a" }}
          >
            {STACK.title}
          </h2>
          <p
            className="text-sm max-w-2xl mx-auto"
            style={{ color: "#475569" }}
          >
            {STACK.subtitle}
          </p>
        </div>

        {/* Four-layer stack grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
          {STACK.layers.map((layer, i) => (
            <div
              key={layer.tier}
              className={`p-5 rounded-2xl border border-slate-200 animate-fade-in-up delay-${i + 1}`}
              style={{ background: "#f7f9fd" }}
            >
              <div className="flex items-center gap-2 mb-3">
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ background: layer.color }}
                />
                <h3
                  className="text-xs font-bold uppercase tracking-widest"
                  style={{ color: "#475569" }}
                >
                  {layer.tier}
                </h3>
              </div>
              <ul className="space-y-1.5">
                {layer.items.map((item) => (
                  <li
                    key={item}
                    className="text-sm font-medium"
                    style={{ color: "#0f172a" }}
                  >
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Operational bullets */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-4xl mx-auto">
          {STACK.bullets.map((b, i) => (
            <div
              key={b}
              className={`flex items-start gap-2 text-sm animate-fade-in-up delay-${i + 5}`}
              style={{ color: "#475569" }}
            >
              <svg
                className="w-4 h-4 mt-0.5 shrink-0"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#22c55e"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <span>{b}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
