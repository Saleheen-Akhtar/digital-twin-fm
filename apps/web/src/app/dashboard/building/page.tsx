"use client";

import { useEffect, useState, useCallback } from "react";
import { createBrowserApiClient } from "@/lib/browser-api-client";
import type { Building, Floor, Room } from "@/lib/api-client";

// ─── Named color presets matching the viewer zone palette ──────────
const COLOR_PRESETS = [
  "#3b82f6", "#60a5fa", "#93c5fd", "#bfdbfe",
  "#a78bfa", "#c4b5fd", "#ddd6fe", "#8b5cf6",
  "#64748b", "#94a3b8", "#22c55e", "#eab308",
  "#f97316", "#ef4444", "#e0e0e0", "#d6dee8",
];

const DEFAULT_COLOR = "#3b82f6";

// ─── Page ──────────────────────────────────────────────────────────

export default function BuildingPage() {
  const [building, setBuilding] = useState<Building | null>(null);
  const [floors, setFloors] = useState<Floor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  const api = createBrowserApiClient();

  // ── Fetch ──
  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    api.get<Building[]>("/buildings")
      .then((buildings) => {
        const b = Array.isArray(buildings) ? buildings[0] : null;
        if (!b) {
          setLoading(false);
          setError("No buildings found. Import a BIM model to get started.");
          return;
        }
        setBuilding(b);
        return api.get<Floor[]>(`/buildings/${b.id}/floors`);
      })
      .then((floorsData) => {
        if (floorsData) setFloors(Array.isArray(floorsData) ? floorsData : []);
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : "Failed to load building data");
      })
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  // ── Save zone update ──
  const updateZone = useCallback(
    async (floorId: string, room: Room, updates: { name?: string; color?: string }) => {
      setSavingId(room.id);
      try {
        const api2 = createBrowserApiClient();
        const updated = await api2.patch<Room>(
          `/buildings/${building!.id}/floors/${floorId}/zones/${room.id}`,
          updates,
        );
        setFloors((prev) =>
          prev.map((f) =>
            f.id === floorId
              ? {
                  ...f,
                  rooms: (f.rooms ?? []).map((r) =>
                    r.id === room.id ? { ...r, name: updated.name, color: updated.color } : r,
                  ),
                }
              : f,
          ),
        );
      } catch (e) {
        console.error("Failed to update zone:", e);
      } finally {
        setSavingId(null);
      }
    },
    [building],
  );

  // ── Loader ──
  if (loading) {
    return (
      <div className="p-8">
        <div className="flex items-center gap-3 text-slate-500">
          <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
          <span>Loading building data…</span>
        </div>
      </div>
    );
  }

  // ── Error ──
  if (error) {
    return (
      <div className="p-8">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
          <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-slate-100">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-7 w-7 text-slate-400"><rect x="4" y="2" width="16" height="20" rx="2"/><line x1="9" y1="6" x2="9" y2="6.01"/><line x1="15" y1="6" x2="15" y2="6.01"/></svg>
          </div>
          <h2 className="text-lg font-semibold text-slate-800">No Building Configured</h2>
          <p className="mt-2 text-sm text-slate-500">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">{building?.name ?? "Building"}</h1>
        <p className="mt-1 text-sm text-slate-500">
          {floors.length} {(floors.length === 1 ? "floor" : "floors")} · {floors.reduce((t, f) => t + (f.rooms?.length ?? 0), 0)} zones
          {building?.address ? ` · ${building.address}` : ""}
        </p>
      </div>

      {/* Floor cards */}
      <div className="grid gap-6 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
        {floors.map((floor) => (
          <FloorCard
            key={floor.id}
            floor={floor}
            savingId={savingId}
            onUpdateZone={(room, updates) => updateZone(floor.id, room, updates)}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Floor Card ────────────────────────────────────────────────────

function FloorCard({
  floor,
  savingId,
  onUpdateZone,
}: {
  floor: Floor;
  savingId: string | null;
  onUpdateZone: (room: Room, updates: { name?: string; color?: string }) => void;
}) {
  const rooms = floor.rooms ?? [];

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      {/* Floor header */}
      <div className="flex items-center gap-3 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white px-5 py-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#355fe5] text-sm font-bold text-white shadow-sm">
          {floor.name.match(/\d+/)?.[0] ?? floor.level + 1}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-[15px] font-semibold text-slate-800 truncate">{floor.name}</h3>
          <p className="text-[12px] text-slate-400">Level {floor.level + 1} · {rooms.length} zone{(rooms.length !== 1 ? "s" : "")}</p>
        </div>
      </div>

      {/* Zone grid */}
      <div className="p-4">
        {rooms.length === 0 ? (
          <p className="text-center text-sm text-slate-400 py-4">No zones configured</p>
        ) : (
          <div className="grid gap-2.5 sm:grid-cols-2">
            {rooms.map((room) => (
              <ZoneCard
                key={room.id}
                room={room}
                isSaving={savingId === room.id}
                onUpdate={(updates) => onUpdateZone(room, updates)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Zone Card with inline color picker ────────────────────────────

function ZoneCard({
  room,
  isSaving,
  onUpdate,
}: {
  room: Room;
  isSaving: boolean;
  onUpdate: (updates: { name?: string; color?: string }) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [name, setName] = useState(room.name);
  const [color, setColor] = useState(room.color ?? DEFAULT_COLOR);

  // Reset local state when room changes (saved from server)
  useEffect(() => {
    setName(room.name);
    setColor(room.color ?? DEFAULT_COLOR);
  }, [room.name, room.color]);

  const handleSaveName = () => {
    if (name.trim() && name !== room.name) {
      onUpdate({ name: name.trim() });
    }
    setEditing(false);
  };

  const handleColorPick = (newColor: string) => {
    setColor(newColor);
    setShowPicker(false);
    onUpdate({ color: newColor });
  };

  return (
    <div className="group relative rounded-xl border border-slate-100 bg-white p-3 transition hover:border-slate-200 hover:shadow-sm">
      {/* Color swatch + name */}
      <div className="flex items-center gap-2.5">
        <button
          type="button"
          onClick={() => setShowPicker(!showPicker)}
          className="relative h-6 w-6 shrink-0 overflow-hidden rounded-lg ring-1 ring-inset ring-black/10 transition hover:scale-110"
          title="Change zone color"
        >
          <div className="h-full w-full" style={{ backgroundColor: room.color ?? DEFAULT_COLOR }} />
          {isSaving && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/20">
              <svg className="h-3 w-3 animate-spin text-white" viewBox="0 0 24 24"><circle className="opacity-0" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-100" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
            </div>
          )}
        </button>

        {editing ? (
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={handleSaveName}
            onKeyDown={(e) => { if (e.key === "Enter") handleSaveName(); if (e.key === "Escape") { setName(room.name); setEditing(false); } }}
            className="min-w-0 flex-1 rounded-lg border border-[#355fe5] bg-blue-50 px-2 py-1 text-[13px] font-medium text-slate-800 outline-none"
          />
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="min-w-0 flex-1 truncate text-left text-[13px] font-medium text-slate-700 hover:text-[#355fe5] transition-colors"
            title="Rename zone"
          >
            {room.name}
          </button>
        )}
      </div>

      {/* Color picker dropdown */}
      {showPicker && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setShowPicker(false)} />
          <div className="absolute left-0 top-12 z-20 rounded-xl border border-slate-200 bg-white p-3 shadow-lg">
            <div className="grid grid-cols-4 gap-2">
              {COLOR_PRESETS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => handleColorPick(c)}
                  className={`h-7 w-7 rounded-lg ring-1 ring-inset ring-black/10 transition hover:scale-110 ${
                    color === c ? "ring-2 ring-[#355fe5] ring-offset-2" : ""
                  }`}
                  style={{ backgroundColor: c }}
                  title={c}
                />
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
