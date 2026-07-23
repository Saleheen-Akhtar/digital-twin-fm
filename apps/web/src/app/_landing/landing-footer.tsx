"use client";

import Link from "next/link";
import { FOOTER } from "./data";
import { colors } from "@/design-system/tokens";

export function LandingFooter() {
  return (
    <footer className="px-6 py-12" style={{ background: colors.bg.canvas }}>
      <div className="max-w-screen-2xl mx-auto flex flex-col md:flex-row items-center justify-between gap-8">
        <div className="flex items-center gap-4">
          <div
            className="h-10 w-10 flex items-center justify-center text-sm font-black brutalist-border"
            style={{
              background: colors.bg.surface,
              color: colors.text.primary,
            }}
          >
            DT
          </div>
          <span className="text-sm font-bold uppercase tracking-widest text-black">
            {FOOTER.copyright}
          </span>
        </div>
        <div className="flex flex-wrap justify-center items-center gap-8">
          {FOOTER.links.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              className="text-sm font-bold uppercase tracking-widest no-underline text-black transition-colors"
              onMouseEnter={(e) => {
                e.currentTarget.style.color = colors.text.accent;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = colors.text.primary;
              }}
            >
              {link.label}
            </Link>
          ))}
        </div>
      </div>
    </footer>
  );
}
