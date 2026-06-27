"use client";

import Link from "next/link";
import { FINAL_CTA } from "./data";

export function LandingFinalCta() {
  return (
    <section
      className="py-20 px-6"
      style={{
        background:
          "linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)",
      }}
    >
      <div className="max-w-4xl mx-auto text-center">
        <div className="animate-fade-in-up">
          {/* Decorative glow */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                "radial-gradient(ellipse 50% 50% at 50% 50%, rgba(53,95,229,0.15) 0%, transparent 70%)",
            }}
          />

          <div className="relative">
            <div
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full mb-5"
              style={{
                background: "rgba(53,95,229,0.12)",
                border: "1px solid rgba(53,95,229,0.3)",
              }}
            >
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-blue-500" />
              </span>
              <span
                className="text-[10px] font-bold uppercase tracking-widest"
                style={{ color: "#93c5fd" }}
              >
                Demo is live now
              </span>
            </div>

            <h2
              className="text-3xl md:text-4xl font-bold mb-4 tracking-tight"
              style={{ color: "#f8fafc" }}
            >
              {FINAL_CTA.headline}
            </h2>
            <p
              className="text-sm md:text-base max-w-2xl mx-auto mb-8 leading-relaxed"
              style={{ color: "#94a3b8" }}
            >
              {FINAL_CTA.subtitle}
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link
                href={FINAL_CTA.primary.href}
                className="px-6 py-3 text-sm font-semibold rounded-xl no-underline transition-all"
                style={{
                  background:
                    "linear-gradient(135deg, #355fe5, #3c73ff)",
                  color: "#ffffff",
                  boxShadow: "0 4px 16px rgba(53,95,229,0.3)",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.boxShadow =
                    "0 8px 24px rgba(53,95,229,0.45)";
                  e.currentTarget.style.transform = "translateY(-1px)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow =
                    "0 4px 16px rgba(53,95,229,0.3)";
                  e.currentTarget.style.transform = "none";
                }}
              >
                {FINAL_CTA.primary.label} →
              </Link>
              <Link
                href={FINAL_CTA.secondary.href}
                className="px-6 py-3 text-sm font-semibold rounded-xl no-underline transition-all"
                style={{
                  background: "rgba(255,255,255,0.05)",
                  color: "#e2e8f0",
                  border: "1px solid rgba(255,255,255,0.12)",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "rgba(255,255,255,0.08)";
                  e.currentTarget.style.borderColor = "rgba(255,255,255,0.2)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "rgba(255,255,255,0.05)";
                  e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)";
                }}
              >
                {FINAL_CTA.secondary.label}
              </Link>
            </div>

            <p
              className="text-[11px] mt-6"
              style={{ color: "#64748b" }}
            >
              No signup required for the demo · MIT-licensed · Runs locally
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
