"use client";

import { useEffect, useState } from "react";
import { LIVE_KPI } from "./data";

interface MetricData {
  temperature?: number;
  power?: number;
  alerts?: number;
  occupancy?: number;
  energy?: number;
}

export function LandingLiveKpi() {
  const [data, setData] = useState<MetricData | null>(null);
  const [activeFlash, setActiveFlash] = useState(false);

  useEffect(() => {
    let active = true;
    async function fetchLatest() {
      try {
        // Original codebase used /api/proxy/buildings/1/kpis
        const res = await fetch("/api/proxy/buildings/1/kpis");
        if (res.ok && active) {
          const json = await res.json();
          // Transform backend schema to frontend component keys
          setData({
            energy: json.avgEnergyKw ?? json.energyKwh,
            power: json.avgPowerKw ?? json.powerKw,
            temperature: json.avgTempC,
            occupancy: json.occupancyCount ?? json.occupancy,
            alerts: json.activeAlerts ?? json.alerts,
          });
          setActiveFlash(true);
          setTimeout(() => {
            if (active) setActiveFlash(false);
          }, 400);
        }
      } catch (e) {
        // Fallback to static data on error
      }
    }
    fetchLatest();
    const interval = setInterval(fetchLatest, 2000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  const getValue = (key: string, fallback: string) => {
    if (!data) return fallback;
    const val = data[key as keyof MetricData];
    if (val === undefined || val === null) return fallback;
    return val.toLocaleString();
  };

  return (
    <section className="brutalist-border-b bg-white overflow-hidden">
      {/* Marquee Banner */}
      <div className="brutalist-border-b bg-black text-white py-3">
        <div className="marquee-container">
          <div className="marquee-content text-xs font-black uppercase tracking-widest">
            {[...Array(4)].map((_, _i) => (
              <span key={_i} className="mx-8 flex items-center gap-8">
                {LIVE_KPI.subtitle}
                <span className="w-2 h-2 bg-white"></span>
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 divide-y md:divide-y-0 md:divide-x-2 divide-black brutalist-border-b">
        {LIVE_KPI.metrics.map((m) => (
          <div
            key={m.key}
            className={`p-6 relative group transition-colors ${activeFlash ? 'bg-gray-100' : 'bg-white'}`}
          >
            {/* Top corner accent square */}
            <div
              className="absolute top-0 right-0 w-4 h-4 brutalist-border-b brutalist-border-l"
              style={{ backgroundColor: m.color }}
            />

            <div className="flex items-center gap-3 mb-4">
              <span className="text-2xl grayscale">{m.icon}</span>
              <h3 className="text-xs font-black uppercase tracking-widest text-black">
                {m.label}
              </h3>
            </div>

            <div className="flex items-baseline gap-1">
              <span className="text-4xl font-black tracking-tighter text-black">
                {getValue(m.key, m.fallback)}
              </span>
              <span className="text-sm font-bold text-gray-500 uppercase">
                {m.unit}
              </span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
