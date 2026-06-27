import type { Metadata } from "next";
import "./_landing/landing.css";
import {
  LandingHeader,
  LandingHero,
  LandingLiveKpi,
  LandingStats,
  LandingDashboardPreview,
  LandingFeatures,
  LandingStack,
  LandingUseCases,
  LandingHowItWorks,
  LandingFaq,
  LandingFinalCta,
  LandingFooter,
} from "./_landing";

export const metadata: Metadata = {
  title: "Digital Twin FM — Live 3D building intelligence for HVAC, sensors & alerts",
  description:
    "See every asset on every floor in real time. A 3D digital twin with live sensors, AI Copilot, and instant fault alerts. MIT-licensed, runs on your hardware.",
};

/**
 * Landing page — composed from modular sections inside `_landing/`.
 * All text content lives in `_landing/data.ts`.
 * All animations live in `_landing/landing.css`.
 *
 * Section order (top to bottom):
 *   1. Header (sticky)
 *   2. Hero               — primary pitch + 3D viewer
 *   3. Live KPI strip     — proves "real-time" with a 2s polling widget
 *   4. Stats              — production numbers
 *   5. Dashboard Preview  — bigger 3D viewer + feature callouts + CTA
 *   6. Features           — 6-card feature grid
 *   7. Stack              — architecture / tech (developer buyer)
 *   8. Use Cases          — three personas, concrete day-in-the-life
 *   9. How It Works       — deploy → connect → monitor
 *  10. FAQ                — objection handling
 *  11. Final CTA          — gradient block, last conversion push
 *  12. Footer
 */
export default function HomePage() {
  return (
    <main style={{ background: "#f7f9fd", minHeight: "100vh" }}>
      <LandingHeader />
      <LandingHero />
      <LandingLiveKpi />
      <LandingStats />
      <LandingDashboardPreview />
      <LandingFeatures />
      <LandingStack />
      <LandingUseCases />
      <LandingHowItWorks />
      <LandingFaq />
      <LandingFinalCta />
      <LandingFooter />
    </main>
  );
}
