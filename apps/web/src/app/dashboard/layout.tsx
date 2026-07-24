"use client";

import type { ReactNode } from 'react';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { createBrowserApiClient } from '@/lib/browser-api-client';
import type { Alert, WorkOrder } from '@/lib/api-client';

function BrandMark() {
  return (
    <svg viewBox="0 0 48 48" className="h-7 w-7" aria-hidden="true">
      <defs><linearGradient id="brand" x1="0" x2="1" y1="0" y2="1">
        <stop offset="0%" stopColor="#355fe5" /><stop offset="100%" stopColor="#3c73ff" />
      </linearGradient></defs>
      <rect width="48" height="48" rx="12" fill="url(#brand)" />
      <path d="M14 30V18l10 6-10 6zm20-6l-10 6V18l10 6z" fill="white" opacity=".9" />
      <circle cx="24" cy="24" r="4" fill="white" />
    </svg>
  );
}

const navItems: Array<{ label: string; icon: (p: any) => React.ReactNode; href: string; badge?: string }> = [
  { label: 'Dashboard', icon: (p: any) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>, href: '/dashboard' },
  { label: 'AI Copilot', icon: (p: any) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 16.08c0 .74-.6 1.34-1.34 1.34H8.34c-.74 0-1.34-.6-1.34-1.34V5.34c0-.74.6-1.34 1.34-1.34h11.32c.74 0 1.34.6 1.34 1.34v10.74z"/><path d="M7 8.5h12"/><path d="M7 12h12"/><path d="M4 8H2v10c0 1.1.9 2 2 2h13v-2H4V8z"/></svg>, href: '/dashboard/copilot' },
  { label: "Digital Twin", icon: (p: any) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>, href: "/dashboard/twin" },
  { label: "Monitoring", icon: (p: any) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>, href: "/dashboard/monitoring" },
  { label: "Predictive", icon: (p: any) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>, href: "/dashboard/predictive" },
  { label: 'Alerts', icon: (p: any) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>, href: '/dashboard/alerts' },
  { label: 'Work Orders', icon: (p: any) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/></svg>, href: '/dashboard/work-orders' },
  { label: 'Assets', icon: (p: any) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/></svg>, href: '/dashboard/assets' },
  { label: 'Building', icon: (p: any) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="4" y="2" width="16" height="20" rx="2"/><line x1="9" y1="6" x2="9" y2="6.01"/><line x1="15" y1="6" x2="15" y2="6.01"/><line x1="9" y1="10" x2="9" y2="10.01"/><line x1="15" y1="10" x2="15" y2="10.01"/><line x1="9" y1="14" x2="9" y2="14.01"/><line x1="15" y1="14" x2="15" y2="14.01"/></svg>, href: '/dashboard/building' },
];

// ─── Sidebar (desktop + mobile overlay) ────────────────────────────

function Sidebar({
  open,
  onClose,
  alertBadge,
  pendingApprovals,
  buildingSubtitle,
}: {
  open: boolean;
  onClose: () => void;
  alertBadge: string | null;
  pendingApprovals: number;
  buildingSubtitle: string;
}) {
  const pathname = usePathname();

  const inner = (
    <>
      <div className="px-2 pb-6 brutalist-border-b mb-6">
        <Link href="/dashboard" onClick={onClose} className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center brutalist-border bg-black text-white">
            <BrandMark />
          </div>
          <div>
            <div className="text-xl font-black uppercase tracking-widest text-black">Digital Twin FM</div>
            <div className="text-xs font-bold uppercase tracking-widest text-gray-500">{buildingSubtitle}</div>
          </div>
        </Link>
      </div>

      {pendingApprovals > 0 && (
        <Link href="/dashboard" onClick={onClose}
          className="mx-2 mb-1 flex items-center gap-2.5 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-[13px] font-medium text-amber-800 hover:bg-amber-100 transition-colors">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5 shrink-0">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
            <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
          </svg>
          <span className="flex-1">Pending Approvals</span>
          <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-500 px-1.5 text-[11px] font-bold text-white">
            {pendingApprovals}
          </span>
        </Link>
      )}

      <nav className="flex flex-1 flex-col gap-1.5 px-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
          return (
            <Link key={item.label} href={item.href ?? '#'} onClick={onClose}
              className={`group flex items-center gap-3 rounded-2xl px-4 py-4 text-[15px] font-medium transition ${
                isActive
                  ? 'bg-black text-white font-black uppercase tracking-widest text-xs brutalist-border shadow-[4px_4px_0px_#111]'
                  : 'text-black hover:bg-black hover:text-white font-bold uppercase tracking-widest text-xs'}`}>
              <Icon className="h-5 w-5" />
              <span className="flex-1">{item.label}</span>
              {item.label === 'Alerts' && alertBadge !== null ? (
                <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-[#ef4444] px-2 text-[12px] font-semibold text-white">{alertBadge}</span>
              ) : item.badge ? (
                <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-[#ef4444] px-2 text-[12px] font-semibold text-white">{item.badge}</span>
              ) : null}
            </Link>
          );
        })}
      </nav>
    </>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden w-[236px] shrink-0 brutalist-border-r bg-white px-3 py-5 lg:flex lg:flex-col">
        {inner}
      </aside>

      {/* Mobile overlay */}
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/40" onClick={onClose} />
          {/* Slide-in panel */}
          <aside className="relative flex h-full w-[280px] flex-col overflow-y-auto border-r border-slate-200 bg-white px-3 py-5 shadow-xl">
            <div className="flex justify-end px-2 pb-4">
              <button onClick={onClose} className="rounded-xl p-2 text-slate-500 hover:bg-slate-100">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            {inner}
          </aside>
        </div>
      )}
    </>
  );
}

// ─── Layout ────────────────────────────────────────────────────────

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [alertBadge, setAlertBadge] = useState<string | null>(null);
  const [pendingApprovals, setPendingApprovals] = useState<number>(0);
  const [buildingSubtitle, setBuildingSubtitle] = useState('Facility Management');

  // Close sidebar on page navigation
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  useEffect(() => {
    const api = createBrowserApiClient();
    let cancelled = false;

    const fetchData = () => {
      Promise.all([
        api.get<Alert[]>('/alerts'),
        api.get<WorkOrder[]>('/work-orders'),
        api.get<Array<{ name: string }>>('/buildings'),
      ]).then(([alertsData, wosData, buildingsData]) => {
        if (cancelled) return;
        const arr = Array.isArray(alertsData) ? alertsData : [];
        const openCount = arr.filter((a) => a.status !== 'cancelled' && a.status !== 'resolved' && a.status !== 'closed').length;
        setAlertBadge(String(openCount));
        const woAlertIds = new Set(
          (Array.isArray(wosData) ? wosData : []).filter((wo) => wo.alertId).map((wo) => wo.alertId)
        );
        setPendingApprovals(arr.filter((a) => a.status !== 'cancelled' && a.status !== 'resolved' && a.status !== 'closed' && !woAlertIds.has(a.id)).length);
        const buildings = Array.isArray(buildingsData) ? buildingsData : [];
        if (buildings[0]?.name) {
          setBuildingSubtitle(buildings[0].name);
        }
      })
        .catch(() => {
          if (!cancelled) { setAlertBadge(null); setPendingApprovals(0); }
        });
    };

    fetchData(); // initial load
    const interval = setInterval(fetchData, 30_000); // poll every 30s for live badge updates
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  return (
    <main className="min-h-screen bg-[#f4f4f0] text-black">
      <div className="flex min-h-screen">
        <Sidebar
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          alertBadge={alertBadge}
          pendingApprovals={pendingApprovals}
          buildingSubtitle={buildingSubtitle}
        />
        <div className="flex min-h-screen flex-1 flex-col">
          {/* Mobile header bar */}
          <div className="flex items-center justify-between brutalist-border-b bg-white px-4 py-3 lg:hidden">
            <button
              onClick={() => setSidebarOpen(true)}
              className="rounded-xl p-2 text-slate-600 hover:bg-slate-100"
              aria-label="Open navigation">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-6 w-6">
                <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>
            <div className="flex items-center gap-2">
              <BrandMark />
              <span className="text-[15px] font-black uppercase tracking-widest text-black">Digital Twin FM</span>
            </div>
            {/* Spacer to keep hamburger and brand balanced */}
            <div className="w-10" />
          </div>

          {children}
        </div>
      </div>
    </main>
  );
}
