"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { createBrowserApiClient } from "@/lib/browser-api-client";
import { useRealtime } from "@/hooks/useRealtime";
import { useViewerStore } from "@/features/digital-twin/viewer-store";
import type { Asset, AssetStatus } from "@/lib/api-client";

// ── Types matching ai-service response ──────────────────────────────

interface HealthScore {
  assetId: string;
  assetName: string;
  assetType: string;
  floorLevel: number | null;
  score: number;
  trend: "rising" | "stable" | "declining" | "critical" | "offline";
  topRisks: string[];
  lastUpdated: string;
}

interface HealthScoresResponse {
  scores: HealthScore[];
  generatedAt: string;
}

interface AssetTrendPoint {
  timestamp: string;
  value: number;
}

interface AssetTrendDetail {
  sensorType: string;
  unit: string;
  values: AssetTrendPoint[];
  baseline: number;
  currentAvg: number;
  slope: number;
  healthy: boolean;
}

interface AssetHealthDetail {
  assetId: string;
  assetName: string;
  assetType: string;
  floorLevel: number | null;
  score: number;
  trend: string;
  topRisks: string[];
  trends: AssetTrendDetail[];
  lastUpdated: string;
}

// ── Helpers ─────────────────────────────────────────────────────────

const TREND_COLORS: Record<string, string> = {
  rising: "#22c55e",
  stable: "#3b82f6",
  declining: "#f59e0b",
  critical: "#ef4444",
};

const TREND_LABELS: Record<string, string> = {
  rising: "Improving",
  stable: "Stable",
  declining: "Declining",
  critical: "Critical",
};

function scoreColor(score: number): string {
  if (score >= 90) return "text-emerald-600";
  if (score >= 70) return "text-blue-600";
  if (score >= 50) return "text-amber-600";
  return "text-red-600";
}

function scoreBg(score: number): string {
  if (score >= 90) return "bg-emerald-50 border-emerald-200";
  if (score >= 70) return "bg-blue-50 border-blue-200";
  if (score >= 50) return "bg-amber-50 border-amber-200";
  return "bg-red-50 border-red-200";
}

function trendIcon(trend: string) {
  switch (trend) {
    case "rising":
      return (
        <svg className="h-4 w-4 text-emerald-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="18 15 12 9 6 15" />
        </svg>
      );
    case "declining":
    case "critical":
      return (
        <svg className="h-4 w-4 text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      );
    default:
      return (
        <svg className="h-4 w-4 text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      );
  }
}

function assetTypeIcon(type: string): string {
  const icons: Record<string, string> = {
    ahu: "❄️",
    chiller: "🧊",
    lighting: "💡",
    fan: "🌀",
    elevator: "🛗",
    boiler: "🔥",
    pump: "💧",
  };
  return icons[type] ?? "📡";
}

function MiniTrendSparkline({ points, color }: { points: number[]; color: string }) {
  if (points.length < 2) return null;
  const w = 80;
  const h = 32;
  const max = Math.max(...points);
  const min = Math.min(...points);
  const range = max - min || 1;
  const pts = points
    .map((v, i) => `${(i / (points.length - 1)) * w},${h - ((v - min) / range) * (h - 4)}`)
    .join(" ");
  return (
    <svg width={w} height={h} className="shrink-0">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ── Main Page ──────────────────────────────────────────────────────

export default function PredictivePage() {
  // Live asset roster — sourced from the SAME /assets endpoint the
  // Digital Twin tab uses, so the two tabs can never disagree on which
  // assets exist. Health scores are enriched on top of this roster.
  const [assets, setAssets] = useState<Asset[]>([]);
  const [scores, setScores] = useState<HealthScore[]>([]);
  const [generatedAt, setGeneratedAt] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedAsset, setSelectedAsset] = useState<AssetHealthDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [anomalyMode, setAnomalyMode] = useState(false);

  // ── Realtime sync ────────────────────────────────────────────────
  // Open the same WebSocket the Digital Twin viewer uses, so live
  // asset:updated / alert:created events flow into BOTH tabs. We read
  // the live status overrides from the shared Zustand store below.
  useRealtime();
  const liveStatuses = useViewerStore((s) => s.assetStatuses);

  // Enrich the live roster with health scores (keyed by assetId) and
  // live status overrides. The roster is ALWAYS the full live asset set;
  // an asset missing a score (ai-service hiccup) degrades gracefully to a
  // neutral "computing" card instead of disappearing.
  const mergedScores: HealthScore[] = useMemo(() => {
    const scoreByAsset = new Map(scores.map((s) => [s.assetId, s]));
    return assets.map((a) => {
      const liveStatus = liveStatuses[a.id] as AssetStatus | undefined;
      const hs = scoreByAsset.get(a.id);
      if (hs) {
        return {
          ...hs,
          // Live WebSocket status wins over the computed trend status so
          // the two tabs stay visually in lockstep.
          trend:
            liveStatus && liveStatus !== hs.trend && (liveStatus === "critical" || liveStatus === "offline")
              ? liveStatus
              : hs.trend,
        };
      }
      // No health score yet (transient) — show a neutral placeholder row.
      return {
        assetId: a.id,
        assetName: a.name,
        assetType: a.type,
        floorLevel: (a as { floorLevel?: number | null }).floorLevel ?? null,
        score: 0,
        trend: (liveStatus ?? a.status ?? "stable") as HealthScore["trend"],
        topRisks: ["Health score computing…"],
        lastUpdated: "",
      };
    });
  }, [assets, scores, liveStatuses]);

  const fetchData = useCallback(async () => {
    try {
      const api = createBrowserApiClient();
      // Parallel: live roster (authoritative) + health scores (enrichment)
      const [assetList, health] = await Promise.all([
        api.get<Asset[]>("/assets"),
        api.get<HealthScoresResponse>("/predictive/health-scores").catch(() => null),
      ]);
      setAssets(assetList);
      if (health) {
        setScores(health.scores);
        setGeneratedAt(health.generatedAt);
      }
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load assets");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    // Refresh the live roster + scores every 60s. Realtime WebSocket
    // handles sub-second status changes between refreshes.
    const interval = setInterval(fetchData, 60_000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const openDetail = useCallback(async (assetId: string) => {
    setDetailLoading(true);
    setSelectedAsset(null);
    try {
      const api = createBrowserApiClient();
      const data = await api.get<AssetHealthDetail>(`/predictive/health-scores/${assetId}`);
      setSelectedAsset(data);
    } catch {
      setSelectedAsset(null);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  // ── Stats ──
  const total = mergedScores.length;
  const critical = mergedScores.filter((s) => s.trend === "critical").length;
  const declining = mergedScores.filter((s) => s.trend === "declining").length;
  const stable = mergedScores.filter((s) => s.trend === "stable").length;
  const improving = mergedScores.filter((s) => s.trend === "rising").length;
  const avgScore = total > 0 ? Math.round(mergedScores.reduce((a, s) => a + s.score, 0) / total) : 0;

  // ── Detail trends chart ──
  function TrendChart({ trends }: { trends: AssetTrendDetail[] }) {
    if (trends.length === 0) return <p className="text-[13px] text-slate-400">No trend data available</p>;
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {trends.map((t) => {
          const vals = t.values.map((v) => v.value);
          const color = t.healthy ? "#22c55e" : "#ef4444";
          return (
            <div key={t.sensorType} className="rounded-xl border border-slate-200 bg-white p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[13px] font-medium text-slate-700 capitalize">{t.sensorType}</span>
                <span className={`text-[12px] ${t.healthy ? "text-emerald-600" : "text-red-600"}`}>
                  {t.slope > 0 ? "+" : ""}{t.slope.toFixed(2)}/h
                </span>
              </div>
              <div className="flex items-end justify-between">
                <div>
                  <span className="text-[20px] font-bold text-slate-900">{t.currentAvg.toFixed(1)}</span>
                  <span className="ml-1 text-[13px] text-slate-500">{t.unit}</span>
                </div>
                <span className="text-[12px] text-slate-400">baseline: {t.baseline.toFixed(1)}</span>
              </div>
              <div className="mt-2">
                <MiniTrendSparkline points={vals} color={color} />
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // ── Anomalies view ──
  function AnomalyCandidates() {
    const anomalies = mergedScores
      .filter((s) => s.trend === "critical" || (s.trend === "declining" && s.topRisks.length > 0))
      .sort((a, b) => a.score - b.score);

    if (anomalies.length === 0) {
      return (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-[14px] text-emerald-800">
          ✅ No anomalies detected — all assets within normal range
        </div>
      );
    }

    return (
      <div className="flex flex-col gap-3">
        {anomalies.map((a) => (
          <button
            key={a.assetId}
            onClick={() => openDetail(a.assetId)}
            className="group flex items-start gap-3 rounded-2xl border border-red-100 bg-white p-4 text-left shadow-sm hover:border-red-200 hover:shadow-md transition-all"
          >
            <span className="mt-0.5 text-xl">{assetTypeIcon(a.assetType)}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="text-[15px] font-semibold text-slate-900">{a.assetName}</span>
                <span className={`text-[16px] font-bold ${scoreColor(a.score)}`}>{a.score}</span>
              </div>
              <div className="mt-0.5 flex flex-wrap gap-1.5">
                {a.topRisks.slice(0, 2).map((risk, i) => (
                  <span key={i} className="inline-flex items-center rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-700">
                    ⚠ {risk}
                  </span>
                ))}
              </div>
            </div>
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="flex-1 px-3 pb-4 pt-5 sm:px-5 lg:px-6">
      <div className="mx-auto flex max-w-[1460px] flex-col gap-4">
        {/* Header */}
        <section className="flex items-center justify-between px-2 sm:px-1">
          <div>
            <h1 className="text-2xl sm:text-[32px] font-semibold tracking-[-0.04em] text-slate-950">
              Predictive Maintenance
            </h1>
            <p className="mt-1 text-[15px] text-slate-500">
              {loading
                ? "Computing health scores…"
                : error
                  ? "Health data unavailable"
                  : `${total} assets monitored · last updated ${new Date(generatedAt).toLocaleTimeString()}`}
            </p>
          </div>
          {!error && total > 0 && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => { setAnomalyMode(false); setSelectedAsset(null); }}
                className={`rounded-xl px-4 py-2 text-[13px] font-medium transition ${
                  !anomalyMode ? "bg-[#355fe5] text-white shadow-sm" : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                Health Cards
              </button>
              <button
                onClick={() => { setAnomalyMode(true); setSelectedAsset(null); }}
                className={`rounded-xl px-4 py-2 text-[13px] font-medium transition ${
                  anomalyMode ? "bg-[#ef4444] text-white shadow-sm" : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                Anomalies {declining + critical > 0 && `(${declining + critical})`}
              </button>
            </div>
          )}
        </section>

        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-[14px] text-red-800">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-16 text-[15px] text-slate-400">
            Computing health scores…
          </div>
        ) : (
          <>
            {/* ── Summary bar ── */}
            <section className="grid grid-cols-2 sm:grid-cols-4 gap-3 px-2 sm:px-1">
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                <span className="text-[13px] text-emerald-700">Average Health</span>
                <p className="text-[28px] font-bold text-emerald-800">{avgScore}<span className="text-[16px] font-normal">/100</span></p>
              </div>
              <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
                <span className="text-[13px] text-blue-700">Stable</span>
                <p className="text-[28px] font-bold text-blue-800">{stable + improving}</p>
              </div>
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                <span className="text-[13px] text-amber-700">Declining</span>
                <p className="text-[28px] font-bold text-amber-800">{declining}</p>
              </div>
              <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
                <span className="text-[13px] text-red-700">Critical</span>
                <p className="text-[28px] font-bold text-red-800">{critical}</p>
              </div>
            </section>

            {/* ── Detail view or main grid ── */}
            {selectedAsset ? (
              /* ── Asset Detail ── */
              <section className="px-2 sm:px-1">
                <button
                  onClick={() => setSelectedAsset(null)}
                  className="mb-3 flex items-center gap-1 text-[13px] text-blue-600 hover:text-blue-700"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
                    <polyline points="15 18 9 12 15 6" />
                  </svg>
                  Back to all assets
                </button>
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <span className="text-3xl">{assetTypeIcon(selectedAsset.assetType)}</span>
                      <div>
                        <h2 className="text-[22px] font-semibold text-slate-900">{selectedAsset.assetName}</h2>
                        <p className="text-[13px] text-slate-500 capitalize">
                          {selectedAsset.assetType} · Floor {selectedAsset.floorLevel ?? "—"}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`text-[36px] font-bold leading-none ${scoreColor(selectedAsset.score)}`}>
                        {selectedAsset.score}
                      </div>
                      <div className="mt-1 flex items-center justify-end gap-1 text-[13px]">
                        {trendIcon(selectedAsset.trend)}
                        <span style={{ color: TREND_COLORS[selectedAsset.trend] ?? "#64748b" }}>
                          {TREND_LABELS[selectedAsset.trend] ?? selectedAsset.trend}
                        </span>
                      </div>
                    </div>
                  </div>
                  {selectedAsset.topRisks.length > 0 && (
                    <div className="mb-4 flex flex-wrap gap-2">
                      {selectedAsset.topRisks.map((risk, i) => (
                        <span key={i} className="inline-flex items-center rounded-full bg-red-50 px-2.5 py-1 text-[12px] font-medium text-red-700">
                          ⚠ {risk}
                        </span>
                      ))}
                    </div>
                  )}
                  <TrendChart trends={selectedAsset.trends} />
                </div>
              </section>
            ) : anomalyMode ? (
              /* ── Anomalies view ── */
              <section className="px-2 sm:px-1">
                <h2 className="mb-3 px-1 text-[16px] font-semibold text-slate-800">Assets Requiring Attention</h2>
                <AnomalyCandidates />
              </section>
            ) : (
              /* ── Health Score Cards Grid ── */
              <section className="px-2 sm:px-1">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                  {mergedScores.map((s) => (
                    <button
                      key={s.assetId}
                      onClick={() => openDetail(s.assetId)}
                      className={`group rounded-2xl border text-left p-4 transition-all hover:shadow-md ${scoreBg(s.score)}`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{assetTypeIcon(s.assetType)}</span>
                          <span className="text-[14px] font-semibold text-slate-900">{s.assetName}</span>
                        </div>
                        <span className={`text-[22px] font-bold ${scoreColor(s.score)}`}>{s.score}</span>
                      </div>
                      <div className="flex items-center gap-1.5 mb-2">
                        {trendIcon(s.trend)}
                        <span
                          className="text-[12px] font-medium"
                          style={{ color: TREND_COLORS[s.trend] ?? "#64748b" }}
                        >
                          {TREND_LABELS[s.trend] ?? s.trend}
                        </span>
                        <span className="ml-auto text-[11px] text-slate-400 capitalize">{s.assetType}</span>
                      </div>
                      {s.topRisks.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {s.topRisks.map((risk, i) => (
                            <span
                              key={i}
                              className="inline-flex items-center rounded-full bg-white/80 px-2 py-0.5 text-[10px] font-medium text-slate-600 border border-slate-200"
                            >
                              {risk.length > 35 ? risk.slice(0, 32) + "…" : risk}
                            </span>
                          ))}
                        </div>
                      )}
                      {s.topRisks.length === 0 && (
                        <span className="text-[11px] text-slate-400">No risks detected</span>
                      )}
                    </button>
                  ))}
                </div>
              </section>
            )}

            {/* Loading detail overlay */}
            {detailLoading && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20">
                <div className="rounded-2xl bg-white px-6 py-4 text-[15px] text-slate-600 shadow-lg">
                  Loading asset details…
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
