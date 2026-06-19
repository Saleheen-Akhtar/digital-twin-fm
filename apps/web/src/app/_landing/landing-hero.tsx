"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { HERO } from "./data";

const Viewer = dynamic(
  () =>
    import("@/features/digital-twin/viewer-3d").then(
      (m) => m.DigitalTwinViewer3D,
    ),
  {
    ssr: false,
    loading: () => (
      <div
        className="w-full h-full min-h-[400px] flex items-center justify-center rounded-2xl"
        style={{
          background: "#f1f5f9",
          color: "#94a3b8",
          fontSize: "13px",
        }}
      >
        Loading 3D preview…
      </div>
    ),
  },
);

export function LandingHero() {
  return (
    <section
      className="relative min-h-screen flex flex-col overflow-hidden"
      style={{ background: "#f7f9fd" }}
    >
      {/* Background decorative gradient */}
      <div
        className="absolute inset-0 pointer-events-none animate-gradient"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 50% -20%, rgba(53,95,229,0.08) 0%, transparent 70%), radial-gradient(ellipse 40% 40% at 80% 80%, rgba(60,115,255,0.05) 0%, transparent 60%)",
        }}
      />

      <div className="relative z-10 flex-1 flex flex-col justify-center px-6 pt-32 pb-12 max-w-7xl mx-auto w-full">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Left: text */}
          <div className="animate-fade-in-up">
            {/* Badge */}
            <div
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-medium mb-6"
              style={{
                background: "rgba(53,95,229,0.08)",
                color: "#355fe5",
                border: "1px solid rgba(53,95,229,0.15)",
              }}
            >
              <span
                className="h-1.5 w-1.5 rounded-full animate-pulse-soft"
                style={{ background: "#22c55e" }}
              />
              {HERO.badge}
            </div>

            {/* Headline */}
            <h1
              className="text-4xl md:text-5xl lg:text-6xl font-bold leading-[1.1] tracking-tight mb-4"
              style={{ color: "#0f172a" }}
            >
              {HERO.headline.split("\n").map((line, i) => (
                <span key={i}>
                  {line}
                  {i < HERO.headline.split("\n").length - 1 && <br />}
                </span>
              ))}
            </h1>

            {/* Subtitle */}
            <p
              className="text-base md:text-lg max-w-lg mb-8 leading-relaxed"
              style={{ color: "#475569" }}
            >
              {HERO.subtitle}
            </p>

            {/* CTAs */}
            <div className="flex items-center gap-3">
              <Link
                href={HERO.cta.href}
                className="px-6 py-2.5 text-sm font-semibold rounded-xl no-underline transition-all"
                style={{
                  background: "linear-gradient(135deg, #355fe5, #3c73ff)",
                  color: "#ffffff",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.boxShadow =
                    "0 6px 20px rgba(53,95,229,0.35)";
                  e.currentTarget.style.transform = "translateY(-1px)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = "none";
                  e.currentTarget.style.transform = "none";
                }}
              >
                {HERO.cta.label}
              </Link>
              <Link
                href={HERO.secondaryCta.href}
                className="px-6 py-2.5 text-sm font-semibold rounded-xl no-underline transition-all"
                style={{
                  color: "#355fe5",
                  background: "#ffffff",
                  border: "1px solid #c9d6ff",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "#f1f5f9";
                  e.currentTarget.style.borderColor = "#355fe5";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "#ffffff";
                  e.currentTarget.style.borderColor = "#c9d6ff";
                }}
              >
                {HERO.secondaryCta.label}
              </Link>
            </div>
          </div>

          {/* Right: 3D viewer */}
          <div
            className="relative animate-fade-in-up delay-2"
            style={{ minHeight: "400px" }}
          >
            <div
              className="rounded-2xl overflow-hidden"
              style={{
                border: "1px solid rgba(201,214,255,0.5)",
                boxShadow: "0 8px 32px rgba(15,23,42,0.08)",
              }}
            >
              <div className="aspect-[4/3] w-full">
                <Viewer showMarkers={false} autoRotate={true} />
              </div>
            </div>

            {/* Floating label */}
            <div
              className="absolute -bottom-3 -right-3 px-4 py-2 rounded-xl text-xs font-medium animate-float"
              style={{
                background: "#ffffff",
                border: "1px solid #c9d6ff",
                color: "#475569",
                boxShadow: "0 4px 12px rgba(15,23,42,0.06)",
              }}
            >
              🏢 Interactive 3D Building
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
