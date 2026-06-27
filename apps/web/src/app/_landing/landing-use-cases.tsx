"use client";

import { USE_CASES } from "./data";

export function LandingUseCases() {
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
            {USE_CASES.title}
          </h2>
          <p
            className="text-sm max-w-2xl mx-auto"
            style={{ color: "#475569" }}
          >
            {USE_CASES.subtitle}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {USE_CASES.items.map((u, i) => (
            <div
              key={u.role}
              className={`p-6 rounded-2xl bg-white border border-slate-200 flex flex-col animate-fade-in-up delay-${i + 1}`}
              style={{ boxShadow: "0 1px 3px rgba(15,23,42,0.04)" }}
            >
              {/* Role header */}
              <div className="flex items-center gap-3 mb-4">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
                  style={{
                    background:
                      "linear-gradient(135deg, rgba(53,95,229,0.08), rgba(60,115,255,0.12))",
                  }}
                >
                  {u.icon}
                </div>
                <div>
                  <div
                    className="text-[10px] font-bold uppercase tracking-widest"
                    style={{ color: "#355fe5" }}
                  >
                    {u.role}
                  </div>
                </div>
              </div>

              {/* Headline */}
              <h3
                className="text-base font-semibold mb-3 leading-snug"
                style={{ color: "#0f172a" }}
              >
                {u.headline}
              </h3>

              {/* Body */}
              <p
                className="text-xs leading-relaxed mb-4 flex-1"
                style={{ color: "#475569" }}
              >
                {u.body}
              </p>

              {/* Metric pill */}
              <div
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold self-start"
                style={{
                  background: "rgba(34,197,94,0.08)",
                  color: "#16a34a",
                  border: "1px solid rgba(34,197,94,0.2)",
                }}
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
                  <polyline points="17 6 23 6 23 12" />
                </svg>
                {u.metric}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
