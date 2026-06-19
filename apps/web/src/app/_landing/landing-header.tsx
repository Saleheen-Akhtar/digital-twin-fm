"use client";

import Link from "next/link";
import { NAV } from "./data";
import { usePathname } from "next/navigation";

export function LandingHeader() {
  const pathname = usePathname();
  const isHome = pathname === "/";

  if (!isHome) return null;

  return (
    <header className="fixed top-0 left-0 right-0 z-50">
      <div
        className="mx-auto max-w-7xl mt-4 px-4"
        style={{ animation: "fade-in 0.6s ease-out" }}
      >
        <nav
          className="flex items-center justify-between px-5 py-3"
          style={{
            background: "rgba(255,255,255,0.85)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            border: "1px solid rgba(201,214,255,0.5)",
            borderRadius: "16px",
            boxShadow: "0 4px 24px rgba(15,23,42,0.06)",
          }}
        >
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 no-underline">
            <div
              className="h-9 w-9 rounded-xl flex items-center justify-center font-bold text-sm"
              style={{
                background: "linear-gradient(135deg, #355fe5, #3c73ff)",
                color: "#ffffff",
              }}
            >
              {NAV.logo}
            </div>
            <div>
              <div
                className="text-sm font-semibold leading-tight"
                style={{ color: "#0f172a" }}
              >
                {NAV.title}
              </div>
              <div
                className="text-[10px] leading-tight"
                style={{ color: "#94a3b8" }}
              >
                {NAV.subtitle}
              </div>
            </div>
          </Link>

          {/* Nav links */}
          <div className="hidden md:flex items-center gap-1">
            {NAV.links.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                className="px-3 py-1.5 text-xs font-medium rounded-lg transition-colors no-underline"
                style={{ color: "#475569" }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "#f1f5f9";
                  e.currentTarget.style.color = "#0f172a";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.color = "#475569";
                }}
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* Sign In button */}
          <Link
            href="/login"
            className="px-4 py-2 text-xs font-semibold rounded-xl no-underline transition-all"
            style={{
              background: "linear-gradient(135deg, #355fe5, #3c73ff)",
              color: "#ffffff",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.boxShadow =
                "0 4px 12px rgba(53,95,229,0.35)";
              e.currentTarget.style.transform = "translateY(-1px)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.boxShadow = "none";
              e.currentTarget.style.transform = "none";
            }}
          >
            Sign In
          </Link>
        </nav>
      </div>
    </header>
  );
}
