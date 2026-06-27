"use client";

import { useState } from "react";
import { FAQ } from "./data";

/**
 * FAQ — uses native <details> for expand/collapse so it works without
 * JS and is fully accessible. Tracks open state to apply rotate
 * animation to the chevron.
 */
export function LandingFaq() {
  const [openIdx, setOpenIdx] = useState<number | null>(0);

  return (
    <section
      id="faq"
      className="py-20 px-6"
      style={{ background: "#ffffff" }}
    >
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-10 animate-fade-in">
          <h2
            className="text-2xl md:text-3xl font-bold mb-2"
            style={{ color: "#0f172a" }}
          >
            {FAQ.title}
          </h2>
          <p
            className="text-sm"
            style={{ color: "#475569" }}
          >
            {FAQ.subtitle}
          </p>
        </div>

        <div className="space-y-3">
          {FAQ.items.map((item, i) => {
            const open = openIdx === i;
            return (
              <div
                key={item.q}
                className={`rounded-2xl border transition-colors animate-fade-in-up delay-${(i % 4) + 1}`}
                style={{
                  background: "#f7f9fd",
                  borderColor: open
                    ? "rgba(53,95,229,0.4)"
                    : "rgba(201,214,255,0.4)",
                }}
              >
                <button
                  type="button"
                  onClick={() => setOpenIdx(open ? null : i)}
                  className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left"
                  aria-expanded={open}
                >
                  <span
                    className="text-sm font-semibold"
                    style={{ color: "#0f172a" }}
                  >
                    {item.q}
                  </span>
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#355fe5"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{
                      transform: open ? "rotate(180deg)" : "rotate(0deg)",
                      transition: "transform 0.2s ease",
                      flexShrink: 0,
                    }}
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>
                <div
                  style={{
                    maxHeight: open ? "200px" : "0",
                    overflow: "hidden",
                    transition: "max-height 0.25s ease",
                  }}
                >
                  <p
                    className="text-xs leading-relaxed px-5 pb-4"
                    style={{ color: "#475569" }}
                  >
                    {item.a}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
