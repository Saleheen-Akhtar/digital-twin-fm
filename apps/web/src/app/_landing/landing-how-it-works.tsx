"use client";

import { HOW_IT_WORKS } from "./data";

export function LandingHowItWorks() {
  return (
    <section
      id="how-it-works"
      className="py-20 px-6"
      style={{ background: "#ffffff" }}
    >
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-14 animate-fade-in">
          <h2
            className="text-2xl md:text-3xl font-bold mb-2"
            style={{ color: "#0f172a" }}
          >
            {HOW_IT_WORKS.title}
          </h2>
          <p className="text-sm" style={{ color: "#475569" }}>
            {HOW_IT_WORKS.subtitle}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
          {/* Connector line (desktop) */}
          <div
            className="hidden md:block absolute top-12 left-[calc(16.66%+2rem)] right-[calc(16.66%+2rem)] h-px"
            style={{
              background:
                "linear-gradient(to right, #c9d6ff, #c9d6ff)",
              zIndex: 0,
            }}
          />

          {HOW_IT_WORKS.steps.map((s, i) => (
            <div
              key={s.step}
              className={`relative z-10 text-center p-8 rounded-2xl animate-fade-in-up delay-${
                i + 1
              }`}
              style={{
                background: "#f7f9fd",
                border: "1px solid rgba(201,214,255,0.4)",
              }}
            >
              {/* Step number */}
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-5 text-lg font-bold"
                style={{
                  background: "linear-gradient(135deg, #355fe5, #3c73ff)",
                  color: "#ffffff",
                }}
              >
                {s.step}
              </div>

              <h3
                className="text-base font-semibold mb-3"
                style={{ color: "#0f172a" }}
              >
                {s.title}
              </h3>
              <p
                className="text-xs leading-relaxed max-w-xs mx-auto"
                style={{ color: "#475569" }}
              >
                {s.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
