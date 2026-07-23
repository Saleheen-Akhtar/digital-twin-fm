"use client";

import { useState } from "react";
import { FAQ } from "./data";
import { colors } from "@/design-system/tokens";

export function LandingFaq() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section className="py-24 px-6 brutalist-border-b" style={{ background: colors.bg.canvas }}>
      <div className="max-w-4xl mx-auto">
        <div className="mb-16 animate-fade-in text-left">
          <h2 className="text-4xl md:text-5xl lg:text-7xl font-black uppercase tracking-tighter mb-6 text-black">
            {FAQ.title}
          </h2>
          <p className="text-base font-bold uppercase tracking-widest text-gray-700">
            {FAQ.subtitle}
          </p>
        </div>

        <div className="space-y-6">
          {FAQ.items.map((item, i) => {
            const isOpen = openIndex === i;
            return (
              <div
                key={item.q}
                className={`bg-white brutalist-border animate-fade-in-up delay-${i + 1} overflow-hidden transition-all duration-200`}
                style={{ boxShadow: isOpen ? "4px 4px 0px #111" : "2px 2px 0px #111" }}
              >
                <button
                  className="w-full text-left p-6 flex justify-between items-center focus:outline-none focus:bg-gray-50 hover:bg-gray-50 transition-colors cursor-pointer"
                  onClick={() => setOpenIndex(isOpen ? null : i)}
                >
                  <h3 className="text-lg md:text-xl font-black uppercase tracking-wide text-black flex gap-4">
                    <span className="text-red-600">Q.</span>
                    {item.q}
                  </h3>
                  <span className="text-2xl font-black text-black ml-4">
                    {isOpen ? "−" : "+"}
                  </span>
                </button>
                <div
                  className={`px-6 overflow-hidden transition-all duration-300 ease-in-out ${
                    isOpen ? "max-h-96 pb-6 opacity-100" : "max-h-0 pb-0 opacity-0"
                  }`}
                >
                  <p className="text-base font-medium leading-relaxed text-gray-700 ml-8 border-l-4 border-black pl-4 pt-4 mt-2 border-t border-gray-100">
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
