"use client";

import { HOW_IT_WORKS } from "./data";


export function LandingHowItWorks() {
  return (
    <section className="py-24 px-6 brutalist-border-b bg-white">
      <div className="max-w-screen-2xl mx-auto">
        <div className="text-center mb-16 animate-fade-in">
          <h2 className="text-4xl md:text-5xl lg:text-7xl font-black uppercase tracking-tighter mb-6 text-black">
            {HOW_IT_WORKS.title}
          </h2>
          <p className="text-base font-bold uppercase tracking-widest max-w-2xl mx-auto text-gray-700">
            {HOW_IT_WORKS.subtitle}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {HOW_IT_WORKS.steps.map((s, i) => (
            <div
              key={s.step}
              className={`relative p-8 bg-gray-50 brutalist-border animate-fade-in-up delay-${i + 1}`}
              style={{ boxShadow: "6px 6px 0px #111" }}
            >
              <div className="absolute -top-6 -left-6 w-12 h-12 bg-black text-white flex items-center justify-center text-xl font-black brutalist-border">
                {s.step}
              </div>
              <h3 className="text-2xl font-black uppercase tracking-wide text-black mb-4 mt-2">
                {s.title}
              </h3>
              <p className="text-base font-medium leading-relaxed text-gray-700">
                {s.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
