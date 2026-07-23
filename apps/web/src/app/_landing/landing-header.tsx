"use client";

import Link from "next/link";
import { NAV } from "./data";
import { usePathname } from "next/navigation";
import { colors } from "@/design-system/tokens";

export function LandingHeader() {
  const pathname = usePathname();
  const isHome = pathname === "/";

  if (!isHome) return null;

  return (
    <header className="fixed top-0 left-0 right-0 z-50 brutalist-border-b" style={{ background: colors.bg.canvas }}>
      <div className="mx-auto max-w-screen-2xl px-6" style={{ animation: "fade-in 0.4s ease-out" }}>
        <nav className="flex items-center justify-between py-4">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-4 no-underline">
            <div
              className="h-10 w-10 flex items-center justify-center font-black text-lg brutalist-border"
              style={{
                background: colors.bg.surface,
                color: colors.text.primary,
              }}
            >
              DT
            </div>
            <div>
              <div
                className="text-lg font-black uppercase tracking-widest leading-none"
                style={{ color: colors.text.primary }}
              >
                {NAV.title}
              </div>
            </div>
          </Link>

          {/* Nav links */}
          <div className="hidden md:flex items-center gap-6">
            {NAV.links.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                className="text-sm font-bold uppercase tracking-widest no-underline transition-colors"
                style={{ color: colors.text.primary }}
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

          {/* Sign In button */}
          <Link
            href="/login"
            className="btn-brutalist px-6 py-3 text-sm"
          >
            Sign In
          </Link>
        </nav>
      </div>
    </header>
  );
}
