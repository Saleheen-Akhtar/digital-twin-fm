"use client";

import { useRef, useEffect, useState } from "react";
import type { Room } from "@/lib/api-client";

const CANVAS_SIZE = 1000; // coordinate space

interface FloorPlanProps {
  zones: Room[];
  viewOnly?: boolean;
  onUpdateZone?: (zoneId: string, updates: Partial<Pick<Room, "positionX" | "positionY" | "width" | "height">>) => Promise<void>;
}

export function FloorPlan({ zones, viewOnly = false, onUpdateZone }: FloorPlanProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 600;
      setScale(w / CANVAS_SIZE);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const gridLines = [];
  for (let i = 0; i <= 10; i++) {
    const pos = i * 100;
    gridLines.push(
      <line key={`g-${i}`} x1={pos} y1={0} x2={pos} y2={CANVAS_SIZE} stroke="#e2e8f0" strokeWidth={1} />,
      <line key={`gv-${i}`} x1={0} y1={pos} x2={CANVAS_SIZE} y2={pos} stroke="#e2e8f0" strokeWidth={1} />,
    );
  }

  const sorted = [...zones].sort((a, b) => (a.positionY ?? 0) - (b.positionY ?? 0));

  return (
    <div ref={containerRef} className="w-full overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <svg
        viewBox={`0 0 ${CANVAS_SIZE} ${CANVAS_SIZE}`}
        style={{ width: "100%", height: "auto", maxHeight: 500 }}
        className="bg-white"
      >
        {/* Grid background */}
        <rect x={0} y={0} width={CANVAS_SIZE} height={CANVAS_SIZE} fill="#f8fafc" />
        {gridLines}
        <rect x={0} y={0} width={CANVAS_SIZE} height={CANVAS_SIZE} fill="none" stroke="#cbd5e1" strokeWidth={2} />

        {/* Zones */}
        {sorted.map((zone) => {
          const x = zone.positionX ?? 0;
          const y = zone.positionY ?? 0;
          const w = zone.width ?? 200;
          const h = zone.height ?? 150;
          const color = zone.color ?? "#3b82f6";

          return (
            <g key={zone.id}>
              <rect
                x={x}
                y={y}
                width={w}
                height={h}
                rx={8}
                fill={color + "22"}
                stroke={color}
                strokeWidth={2}
                className="transition-opacity hover:opacity-80"
              />
              <text
                x={x + w / 2}
                y={y + h / 2}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={14}
                fontWeight={500}
                fill="#1e293b"
                fontFamily="system-ui, sans-serif"
              >
                {zone.name}
              </text>
              {/* Dimensions label */}
              <text
                x={x + w / 2}
                y={y + h / 2 + 18}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={11}
                fill="#94a3b8"
                fontFamily="system-ui, sans-serif"
              >
                {w}×{h}
              </text>
            </g>
          );
        })}

        {/* Empty state */}
        {zones.length === 0 && (
          <text
            x={CANVAS_SIZE / 2}
            y={CANVAS_SIZE / 2}
            textAnchor="middle"
            fontSize={16}
            fill="#94a3b8"
            fontFamily="system-ui, sans-serif"
          >
            No zones on this floor
          </text>
        )}
      </svg>
    </div>
  );
}
