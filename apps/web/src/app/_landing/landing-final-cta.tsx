"use client";

import Link from "next/link";
import { FINAL_CTA } from "./data";
import { colors } from "@/design-system/tokens";

export function LandingFinalCta() {
  return (
    <section
      className="py-32 px-6 brutalist-border-b"
      style={{
        background: colors.bg.dark,
      }}
    >
      <div className="max-w-5xl mx-auto text-center">
        <div className="animate-fade-in-up">

          <div className="relative">
            <div
              className="inline-flex items-center gap-3 px-4 py-2 brutalist-border bg-white mb-8"
            >
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full bg-red-600 opacity-75" />
                <span className="relative inline-flex h-3 w-3 bg-red-600" />
              </span>
              <span
                className="text-xs font-black uppercase tracking-widest text-black"
              >
                Demo is live now
              </span>
            </div>

            <h2
              className="text-5xl md:text-7xl font-black mb-8 tracking-tighter uppercase"
              style={{ color: colors.text.onDark }}
            >
              {FINAL_CTA.headline}
            </h2>
            <p
              className="text-lg md:text-xl max-w-3xl mx-auto mb-12 font-medium"
              style={{ color: "#aaaaaa" }}
            >
              {FINAL_CTA.subtitle}
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
              <Link
                href={FINAL_CTA.primary.href}
                className="btn-brutalist px-8 py-4 text-base bg-white !text-black hover:!bg-gray-200"
              >
                {FINAL_CTA.primary.label}
              </Link>
              <Link
                href={FINAL_CTA.secondary.href}
                className="btn-brutalist px-8 py-4 text-base !border-white !bg-transparent hover:!bg-white hover:!text-black"
                style={{ color: colors.text.onDark }}
              >
                {FINAL_CTA.secondary.label}
              </Link>
            </div>

            <p
              className="text-xs font-bold uppercase tracking-widest mt-12"
              style={{ color: "#666666" }}
            >
              No signup required for the demo // MIT-licensed // Runs locally
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
