"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { HERO } from "./data";
import { colors } from "@/design-system/tokens";

const Viewer = dynamic(
  () =>
    import("@/features/digital-twin/viewer-3d").then(
      (m) => m.DigitalTwinViewer3D,
    ),
  {
    ssr: false,
    loading: () => (
      <div
        className="w-full h-full min-h-[500px] flex items-center justify-center brutalist-border"
        style={{
          background: colors.bg.subtle,
          color: colors.text.muted,
          fontSize: "14px",
          fontWeight: "bold",
          textTransform: "uppercase"
        }}
      >
        Loading 3D Engine...
      </div>
    ),
  },
);

export function LandingHero() {
  return (
    <section
      className="relative min-h-screen flex flex-col overflow-hidden brutalist-border-b"
      style={{ background: colors.bg.canvas }}
    >
      {/* Background Grid Pattern */}
      <div
        className="absolute inset-0 pointer-events-none opacity-20"
        style={{
          backgroundImage: `linear-gradient(${colors.text.muted} 1px, transparent 1px), linear-gradient(90deg, ${colors.text.muted} 1px, transparent 1px)`,
          backgroundSize: '40px 40px'
        }}
      />

      <div className="relative z-10 flex-1 flex flex-col justify-center px-6 pt-32 pb-16 max-w-screen-2xl mx-auto w-full">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          {/* Left: text */}
          <div className="animate-fade-in-up">
            {/* Live status badge */}
            <div
              className="inline-flex items-center gap-3 px-4 py-2 brutalist-border bg-white mb-8"
            >
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full bg-black opacity-75" />
                <span className="relative inline-flex h-3 w-3 bg-black" />
              </span>
              <span className="text-xs font-bold uppercase tracking-widest" style={{ color: colors.text.primary }}>{HERO.badge}</span>
              <span className="text-xs font-bold uppercase tracking-widest" style={{ color: colors.text.muted }}>//</span>
              <span className="text-xs font-bold uppercase tracking-widest" style={{ color: colors.text.primary }}>{HERO.badgeStatus}</span>
            </div>

            {/* Headline */}
            <h1
              className="text-5xl md:text-7xl lg:text-8xl font-black leading-[0.9] tracking-tighter mb-8 uppercase"
              style={{ color: colors.text.primary }}
            >
              {HERO.headline.split("\n").map((line, i) => (
                <span key={i} className="block">
                  {line}
                </span>
              ))}
            </h1>

            {/* Subtitle */}
            <p
              className="text-lg md:text-xl max-w-lg mb-10 leading-snug font-medium"
              style={{ color: colors.text.secondary }}
            >
              {HERO.subtitle}
            </p>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row items-start gap-4 mb-12">
              <Link
                href={HERO.cta.href}
                className="btn-brutalist px-8 py-4 text-base w-full sm:w-auto"
              >
                {HERO.cta.label}
              </Link>
              <Link
                href={HERO.secondaryCta.href}
                className="btn-brutalist-outline px-8 py-4 text-base w-full sm:w-auto bg-white"
              >
                {HERO.secondaryCta.label}
              </Link>
            </div>

            {/* Trust strip */}
            <div
              className="flex flex-wrap items-center gap-6 pt-6 brutalist-border-t text-xs font-bold uppercase tracking-widest"
              style={{ color: colors.text.primary }}
            >
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 bg-black"></span>
                MIT licensed
              </span>
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 bg-black"></span>
                Runs on your hardware
              </span>
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 bg-black"></span>
                No vendor lock-in
              </span>
            </div>
          </div>

          {/* Right: 3D viewer */}
          <div
            className="relative animate-fade-in-up delay-2 h-full"
            style={{ minHeight: "500px" }}
          >
            <div
              className="w-full h-full brutalist-border bg-white p-2"
              style={{
                boxShadow: "12px 12px 0px #111111",
              }}
            >
              <div className="w-full h-full brutalist-border relative" style={{ minHeight: "500px" }}>
                {/* Showcase mode: bare building, auto-rotate, no overlays */}
                <Viewer mode="showcase" showMarkers={false} autoRotate={true} />

                {/* Floating label */}
                <div
                  className="absolute bottom-4 right-4 px-4 py-2 brutalist-border bg-white text-xs font-bold uppercase tracking-widest z-10"
                >
                  Interactive 3D
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
