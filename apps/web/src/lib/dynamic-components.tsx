import dynamic from 'next/dynamic';
import type { ComponentProps } from 'react';

// Digital Twin 3D Viewer — three.js is ~340 kB gzipped. Only loaded
// when the Digital Twin / Twin page actually renders and the viewer
// component is mounted.
export const DynamicViewer3D = dynamic(
  () => import('@/features/digital-twin/viewer-3d').then((m) => ({ default: m.DigitalTwinViewer3D })),
  { ssr: false, loading: () => <ViewerPlaceholder /> },
);

export type Viewer3DProps = ComponentProps<typeof DynamicViewer3D>;

function ViewerPlaceholder() {
  return (
    <div className="flex h-full min-h-[400px] w-full items-center justify-center rounded-2xl bg-slate-100">
      <div className="flex flex-col items-center gap-2 text-slate-400">
        <svg className="h-8 w-8 animate-pulse" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
        </svg>
        <span className="text-[13px]">Loading 3D viewer…</span>
      </div>
    </div>
  );
}
