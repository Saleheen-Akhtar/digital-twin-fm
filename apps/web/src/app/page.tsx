import type { Metadata } from "next";
import "./_landing/landing.css";
import { LandingHeader } from "./_landing/landing-header";
import { LandingHero } from "./_landing/landing-hero";
import { LandingStats } from "./_landing/landing-stats";
import { LandingFeatures } from "./_landing/landing-features";
import { LandingHowItWorks } from "./_landing/landing-how-it-works";
import { LandingFooter } from "./_landing/landing-footer";

export const metadata: Metadata = {
  title: "Digital Twin FM — Building Intelligence Platform",
  description:
    "Monitor HVAC, chillers, boilers, pumps, and exhaust fans across every floor with real-time sensor data, AI-powered insights, and instant fault alerts. MVP.",
};

/**
 * Landing page — composed from modular sections inside `_landing/`.
 * All text content lives in `_landing/data.ts`.
 * All animations live in `_landing/landing.css`.
 * Each section is its own component with clean separation.
 */
export default function HomePage() {
  return (
    <main style={{ background: "#f7f9fd", minHeight: "100vh" }}>
      <LandingHeader />
      <LandingHero />
      <LandingStats />
      <LandingFeatures />
      <LandingHowItWorks />
      <LandingFooter />
    </main>
  );
}
