"use client";

import Link from "next/link";
import { FOOTER, NAV } from "./data";

export function LandingFooter() {
  return (
    <footer
      className="px-6 py-10"
      style={{
        background: "#0f172a",
        borderTop: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Brand */}
        <div className="flex items-center gap-2">
          <div
            className="h-7 w-7 rounded-lg flex items-center justify-center text-[10px] font-bold"
            style={{
              background: "linear-gradient(135deg, #355fe5, #3c73ff)",
              color: "#ffffff",
            }}
          >
            {NAV.logo}
          </div>
          <span
            className="text-xs font-medium"
            style={{ color: "#94a3b8" }}
          >
            {FOOTER.copyright}
          </span>
        </div>

        {/* Links */}
        <div className="flex items-center gap-4">
          {FOOTER.links.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              className="text-xs no-underline transition-colors"
              style={{ color: "#64748b" }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = "#ffffff";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = "#64748b";
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
