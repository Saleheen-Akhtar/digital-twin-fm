"use client";

import { STACK } from "./data";


export function LandingStack() {
  return (
    <section id="stack" className="py-24 px-6 brutalist-border-b bg-white">
      <div className="max-w-screen-2xl mx-auto">
        <div className="text-center mb-16 animate-fade-in">
          <h2 className="text-4xl md:text-5xl lg:text-7xl font-black uppercase tracking-tighter mb-6 text-black">
            {STACK.title}
          </h2>
          <p className="text-base font-bold uppercase tracking-widest max-w-3xl mx-auto text-gray-700">
            {STACK.subtitle}
          </p>
        </div>

        {/* Stack grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          {STACK.layers.map((layer, i) => (
            <div
              key={layer.tier}
              className={`p-6 brutalist-border bg-gray-50 animate-fade-in-up delay-${i + 1}`}
              style={{ boxShadow: "6px 6px 0px #111" }}
            >
              <div className="flex items-center justify-between mb-6 pb-4 brutalist-border-b border-gray-300">
                <h3 className="text-lg font-black uppercase tracking-widest text-black">
                  {layer.tier}
                </h3>
                <div className="w-3 h-3 bg-black brutalist-border" />
              </div>
              <ul className="space-y-3">
                {layer.items.map((item) => (
                  <li key={item} className="text-base font-bold text-gray-800 flex items-center gap-2">
                    <span className="text-black">/</span> {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Operational bullets */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl mx-auto">
          {STACK.bullets.map((b, i) => (
            <div
              key={b}
              className={`flex items-start gap-4 p-4 brutalist-border bg-white animate-fade-in-up delay-${i + 5}`}
            >
              <svg className="w-6 h-6 shrink-0 text-black" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="square">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <span className="text-sm font-bold uppercase tracking-wide text-black mt-0.5">{b}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
