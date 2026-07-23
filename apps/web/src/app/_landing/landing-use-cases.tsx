"use client";

import { USE_CASES } from "./data";
import { colors } from "@/design-system/tokens";

export function LandingUseCases() {
  return (
    <section className="py-24 px-6 brutalist-border-b" style={{ background: colors.bg.canvas }}>
      <div className="max-w-screen-2xl mx-auto">
        <div className="text-center mb-16 animate-fade-in">
          <h2 className="text-4xl md:text-5xl lg:text-7xl font-black uppercase tracking-tighter mb-6 text-black">
            {USE_CASES.title}
          </h2>
          <p className="text-base font-bold uppercase tracking-widest max-w-2xl mx-auto text-gray-700">
            {USE_CASES.subtitle}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {USE_CASES.items.map((item, i) => (
            <div
              key={item.role}
              className={`p-8 bg-white brutalist-border flex flex-col animate-fade-in-up delay-${i + 1}`}
              style={{ boxShadow: "8px 8px 0px #111" }}
            >
              <div className="text-4xl grayscale mb-6">{item.icon}</div>
              <h3 className="text-xl font-black uppercase tracking-wide text-black mb-4">
                {item.role}
              </h3>
              <h4 className="text-base font-bold text-gray-800 mb-4 pb-4 brutalist-border-b">
                "{item.headline}"
              </h4>
              <p className="text-sm font-medium leading-relaxed text-gray-700 mb-8 flex-1">
                {item.body}
              </p>
              <div className="mt-auto pt-4 border-t-2 border-black border-dashed">
                <span className="text-sm font-black uppercase tracking-widest text-black bg-gray-100 p-2 inline-block brutalist-border">
                  {item.metric}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
