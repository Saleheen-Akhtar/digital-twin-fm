"use client";

import { useEffect, useState, useCallback } from "react";
import { createBrowserApiClient } from "@/lib/browser-api-client";
import type { Building, Floor, Room } from "@/lib/api-client";

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

  // Add/delete state
  const [showAddFloor, setShowAddFloor] = useState(false);
  const [showAddZone, setShowAddZone] = useState<string | null>(null); // floorId
  const [confirmDelete, setConfirmDelete] = useState<{ type: "zone" | "floor"; id: string; name: string } | null>(null);

  const [toast, setToast] = useState<string | null>(null);
  const showToast = useCallback((msg: string) => { setToast(msg); setTimeout(() => setToast(null), 2500); }, []);

  const api = createBrowserApiClient();

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
      .then((floors) => {
        setFloors(Array.isArray(floors) ? floors : []);
        setLoading(false);
      })
      .catch((err: Error) => {
        setLoading(false);
        setError(err.message || "Failed to load building data");
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { load(); }, [load]);

  const updateZone = useCallback(
    (floorId: string, room: Room, updates: { name?: string; color?: string }) => {
      if (!building) return;
      setSavingId(room.id);
      api.patch<Room>(`/buildings/${building.id}/floors/${floorId}/zones/${room.id}`, updates)
        .then((updated) => {
          setFloors((prev) =>
            prev.map((f) =>
              f.id === floorId
                ? { ...f, rooms: f.rooms?.map((r) => (r.id === room.id ? { ...r, name: updated.name, color: updated.color } : r)) }
                : f,
            ),
          );
        })
        .catch((e: Error) => console.error("Failed to update zone:", e))
        .finally(() => setSavingId(null));
    },
    [building],
  );

  // ─── Create / Delete handlers ────────────────────────────────────

  const handleAddFloor = useCallback(async (name: string, level: number) => {
    if (!building) return;
    try {
      await api.post(`/buildings/${building.id}/floors`, { name, level });
      showToast(`Floor "${name}" added`);
      // Refresh
      const floors = await api.get<Floor[]>(`/buildings/${building.id}/floors`);
      setFloors(Array.isArray(floors) ? floors : []);
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "Failed to add floor");
    }
    setShowAddFloor(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [building]);

  const handleDeleteFloor = useCallback(async () => {
    if (!building || !confirmDelete || confirmDelete.type !== "floor") return;
    try {
      await api.delete(`/buildings/${building.id}/floors/${confirmDelete.id}`);
      showToast(`Floor "${confirmDelete.name}" deleted`);
      setFloors((prev) => prev.filter((f) => f.id !== confirmDelete.id));
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "Failed to delete floor");
    }
    setConfirmDelete(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [building, confirmDelete]);

  const handleAddZone = useCallback(async (floorId: string, name: string, color: string) => {
    if (!building) return;
    try {
      await api.post(`/buildings/${building.id}/floors/${floorId}/zones`, { name, color });
      showToast(`Zone "${name}" added`);
      const floors = await api.get<Floor[]>(`/buildings/${building.id}/floors`);
      setFloors(Array.isArray(floors) ? floors : []);
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "Failed to add zone");
    }
    setShowAddZone(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [building]);

  const handleDeleteZone = useCallback(async () => {
    if (!building || !confirmDelete || confirmDelete.type !== "zone") return;
    try {
      await api.delete(`/buildings/${building.id}/floors/${confirmDelete.id.split(":")[0]}/zones/${confirmDelete.id.split(":")[1]}`);
      showToast(`Zone "${confirmDelete.name}" deleted`);
      const floors = await api.get<Floor[]>(`/buildings/${building.id}/floors`);
      setFloors(Array.isArray(floors) ? floors : []);
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "Failed to delete zone");
    }
    setConfirmDelete(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [building, confirmDelete]);

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

  const totalRooms = floors.reduce((t, f) => t + (f.rooms?.length ?? 0), 0);

  return (
    <div className="p-6 md:p-8">
      {/* Toast */}
      {toast && (
        <div className="fixed right-4 top-4 z-50 max-w-sm rounded-2xl border border-slate-200 bg-white px-4 py-3 text-[14px] font-medium text-slate-800 shadow-lg">{toast}</div>
      )}

      {/* Header */}
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">{building?.name ?? "Building"}</h1>
          <p className="mt-1 text-sm text-slate-500">
            {floors.length} {(floors.length === 1 ? "floor" : "floors")} · {totalRooms} zones
            {building?.address ? ` · ${building.address}` : ""}
          </p>
        </div>
        <button
          onClick={() => setShowAddFloor(true)}
          className="rounded-xl bg-[#355fe5] px-4 py-2 text-[13px] font-medium text-white hover:bg-[#2a4fc7] transition-colors">
          + Add Floor
        </button>
      </div>

      {/* Floor cards */}
      <div className="grid gap-6 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
        {floors.map((floor) => (
          <FloorCard
            key={floor.id}
            floor={floor}
            buildingId={building?.id}
            savingId={savingId}
            onUpdateZone={(room, updates) => updateZone(floor.id, room, updates)}
            onAddZone={() => setShowAddZone(floor.id)}
            onDeleteFloor={(id, name) => setConfirmDelete({ type: "floor", id, name })}
            onDeleteZone={(zoneId, name) => setConfirmDelete({ type: "zone", id: `${floor.id}:${zoneId}`, name })}
          />
        ))}
      </div>

      {/* ── Add Floor Modal ── */}
      {showAddFloor && (
        <AddFloorModal
          floors={floors}
          onConfirm={handleAddFloor}
          onClose={() => setShowAddFloor(false)}
        />
      )}

      {/* ── Add Zone Modal ── */}
      {showAddZone && (
        <AddZoneModal
          onConfirm={(name, color) => handleAddZone(showAddZone, name, color)}
          onClose={() => setShowAddZone(null)}
        />
      )}

      {/* ── Confirm Delete ── */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <h3 className="text-[18px] font-semibold text-slate-900 mb-2">Delete {confirmDelete.type === "floor" ? "Floor" : "Zone"}</h3>
            <p className="text-[14px] text-slate-600 mb-6">
              Are you sure you want to delete <strong>"{confirmDelete.name}"</strong>? This cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setConfirmDelete(null)} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-[13px] font-medium text-slate-600 hover:bg-slate-50">Cancel</button>
              <button onClick={confirmDelete.type === "floor" ? handleDeleteFloor : handleDeleteZone} className="rounded-xl bg-red-600 px-4 py-2 text-[13px] font-medium text-white hover:bg-red-700">Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Device Control ── */}
      <ActuatorPanel />
    </div>
  );
}

// ─── Add Floor Modal ────────────────────────────────────────────────

function AddFloorModal({
  floors,
  onConfirm,
  onClose,
}: {
  floors: Floor[];
  onConfirm: (name: string, level: number) => Promise<void>;
  onClose: () => void;
}) {
  const nextLevel = floors.length > 0 ? Math.max(...floors.map((f) => f.level)) + 1 : 1;
  const [name, setName] = useState(`Level ${nextLevel}`);
  const [level, setLevel] = useState(nextLevel);
  const [busy, setBusy] = useState(false);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
        <h3 className="text-[18px] font-semibold text-slate-900 mb-4">Add Floor</h3>
        <div className="flex flex-col gap-3 mb-6">
          <div>
            <label className="text-[13px] font-medium text-slate-700">Name</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-[14px] text-slate-900 outline-none focus:border-blue-400" />
          </div>
          <div>
            <label className="text-[13px] font-medium text-slate-700">Level</label>
            <input type="number" value={level} onChange={(e) => setLevel(parseInt(e.target.value, 10) || 0)}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-[14px] text-slate-900 outline-none focus:border-blue-400" />
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-[13px] font-medium text-slate-600 hover:bg-slate-50">Cancel</button>
          <button onClick={async () => { setBusy(true); await onConfirm(name, level); setBusy(false); }}
            disabled={busy || !name.trim()}
            className="rounded-xl bg-[#355fe5] px-4 py-2 text-[13px] font-medium text-white hover:bg-[#2a4fc7] disabled:opacity-50">{busy ? "Adding..." : "Add Floor"}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Add Zone Modal ─────────────────────────────────────────────────

function AddZoneModal({
  onConfirm,
  onClose,
}: {
  onConfirm: (name: string, color: string) => Promise<void>;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [color, setColor] = useState(DEFAULT_COLOR);
  const [busy, setBusy] = useState(false);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
        <h3 className="text-[18px] font-semibold text-slate-900 mb-4">Add Zone</h3>
        <div className="flex flex-col gap-3 mb-6">
          <div>
            <label className="text-[13px] font-medium text-slate-700">Name *</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-[14px] text-slate-900 outline-none focus:border-blue-400" placeholder="e.g. Conference Room A" />
          </div>
          <div>
            <label className="text-[13px] font-medium text-slate-700">Color</label>
            <div className="mt-1 flex flex-wrap gap-2">
              {COLOR_PRESETS.map((c) => (
                <button key={c} onClick={() => setColor(c)}
                  className={`h-8 w-8 rounded-lg border-2 ${color === c ? "border-slate-800 ring-2 ring-offset-1" : "border-transparent"}`}
                  style={{ backgroundColor: c }} />
              ))}
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-[13px] font-medium text-slate-600 hover:bg-slate-50">Cancel</button>
          <button onClick={async () => { setBusy(true); await onConfirm(name, color); setBusy(false); }}
            disabled={busy || !name.trim()}
            className="rounded-xl bg-[#355fe5] px-4 py-2 text-[13px] font-medium text-white hover:bg-[#2a4fc7] disabled:opacity-50">{busy ? "Adding..." : "Add Zone"}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Floor Card ────────────────────────────────────────────────────

function FloorCard({
  floor,
  buildingId,
  savingId,
  onUpdateZone,
  onAddZone,
  onDeleteFloor,
  onDeleteZone,
}: {
  floor: Floor;
  buildingId?: string;
  savingId: string | null;
  onUpdateZone: (room: Room, updates: { name?: string; color?: string }) => void;
  onAddZone: () => void;
  onDeleteFloor: (id: string, name: string) => void;
  onDeleteZone: (zoneId: string, name: string) => void;
}) {
  const rooms = floor.rooms ?? [];

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      {/* Floor header */}
      <div className="flex items-center justify-between border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#355fe5] text-sm font-bold text-white shadow-sm">
            {floor.name.match(/\d+/)?.[0] ?? floor.level + 1}
          </div>
          <div>
            <h2 className="text-base font-semibold text-slate-900">{floor.name}</h2>
            <p className="text-xs text-slate-400">{rooms.length} zone{(rooms.length === 1 ? "" : "s")}</p>
          </div>
        </div>
        <div className="flex gap-1.5">
          <button onClick={onAddZone}
            className="rounded-lg bg-blue-50 px-2.5 py-1 text-[11px] font-medium text-blue-600 hover:bg-blue-100 transition-colors">
            + Zone
          </button>
          <button onClick={() => onDeleteFloor(floor.id, floor.name)}
            className="rounded-lg bg-red-50 px-2.5 py-1 text-[11px] font-medium text-red-500 hover:bg-red-100 transition-colors">
            Del
          </button>
        </div>
      </div>

      {/* Zones */}
      <div className="divide-y divide-slate-50">
        {rooms.length === 0 ? (
          <div className="px-5 py-6 text-center text-[13px] text-slate-400">No zones — click + Zone to add one</div>
        ) : (
          rooms.map((room) => (
            <ZoneCard
              key={room.id}
              room={room}
              floorId={floor.id}
              buildingId={buildingId}
              savingId={savingId}
              onUpdate={(updates) => onUpdateZone(room, updates)}
              onDelete={(name) => onDeleteZone(room.id, name)}
            />
          ))
        )}
      </div>
    </div>
  );
}

// ─── Zone Card ─────────────────────────────────────────────────────

function ZoneCard({
  room,
  floorId,
  buildingId,
  savingId,
  onUpdate,
  onDelete,
}: {
  room: Room;
  floorId: string;
  buildingId?: string;
  savingId: string | null;
  onUpdate: (updates: { name?: string; color?: string }) => void;
  onDelete: (name: string) => void;
}) {
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(room.name ?? "");
  const [editingColor, setEditingColor] = useState(false);

  const commitName = useCallback(() => {
    setEditingName(false);
    if (nameDraft !== room.name) onUpdate({ name: nameDraft });
  }, [nameDraft, room.name, onUpdate]);

  return (
    <div className="group flex items-center justify-between px-5 py-3 hover:bg-slate-50/60 transition-colors">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        {/* Color indicator */}
        <div className="relative">
          <div
            className="h-3.5 w-3.5 shrink-0 rounded-full cursor-pointer"
            style={{ backgroundColor: room.color ?? "#94a3b8" }}
            onClick={() => setEditingColor(!editingColor)}
          />
          {editingColor && (
            <div className="absolute left-0 top-5 z-10 flex flex-wrap gap-1 rounded-xl border border-slate-200 bg-white p-2 shadow-lg w-40" onClick={(e) => e.stopPropagation()}>
              {COLOR_PRESETS.map((c) => (
                <button key={c} onClick={() => { onUpdate({ color: c }); setEditingColor(false); }}
                  className={`h-6 w-6 rounded-md border-2 ${room.color === c ? "border-slate-800" : "border-transparent"}`}
                  style={{ backgroundColor: c }} />
              ))}
            </div>
          )}
        </div>

        {/* Name (inline edit) */}
        {editingName ? (
          <input
            type="text" value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value)}
            onBlur={commitName}
            onKeyDown={(e) => { if (e.key === "Enter") commitName(); if (e.key === "Escape") { setEditingName(false); setNameDraft(room.name ?? ""); } }}
            className="w-full rounded-lg border border-blue-300 px-2 py-1 text-[13px] text-slate-900 outline-none focus:ring-2 focus:ring-blue-100"
            autoFocus
          />
        ) : (
          <span
            className="text-[14px] text-slate-800 cursor-pointer hover:text-blue-600 transition-colors"
            onClick={() => { setNameDraft(room.name ?? ""); setEditingName(true); }}
          >
            {room.name ?? "Unnamed Zone"}
          </span>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={() => onDelete(room.name ?? "this zone")}
          className="rounded-lg px-2 py-0.5 text-[11px] font-medium text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors">
          Delete
        </button>
      </div>
    </div>
  );
}

// ─── Actuator Panel ─────────────────────────────────────────────────

function ActuatorPanel() {
  const [actuatorId, setActuatorId] = useState("esp32-01");
  const [commandType, setCommandType] = useState("toggle");
  const [value, setValue] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const api = createBrowserApiClient();

  const handleSend = useCallback(async () => {
    setBusy(true);
    setResult(null);
    try {
      const body: Record<string, unknown> = { command: commandType };
      if (value) body.value = parseFloat(value);
      const resp = await api.post(`/actuators/${encodeURIComponent(actuatorId)}/command`, body);
      setResult(`Sent: ${JSON.stringify(resp)}`);
    } catch (err) {
      setResult(err instanceof Error ? err.message : "Failed to send command");
    } finally {
      setBusy(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actuatorId, commandType, value]);

  return (
    <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-5">
      <h3 className="text-base font-semibold text-slate-900 mb-3">Device Control</h3>
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Actuator ID</label>
          <input type="text" value={actuatorId} onChange={(e) => setActuatorId(e.target.value)}
            className="mt-1 rounded-xl border border-slate-200 px-3 py-2 text-[14px] outline-none focus:border-blue-400 w-36" />
        </div>
        <div>
          <label className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Command</label>
          <select value={commandType} onChange={(e) => setCommandType(e.target.value)}
            className="mt-1 rounded-xl border border-slate-200 px-3 py-2 text-[14px] outline-none focus:border-blue-400">
            <option value="toggle">Toggle</option>
            <option value="set_value">Set Value</option>
            <option value="set_mode">Set Mode</option>
            <option value="calibrate">Calibrate</option>
          </select>
        </div>
        {commandType === "set_value" && (
          <div>
            <label className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Value</label>
            <input type="number" value={value} onChange={(e) => setValue(e.target.value)}
              className="mt-1 rounded-xl border border-slate-200 px-3 py-2 text-[14px] outline-none focus:border-blue-400 w-24" />
          </div>
        )}
        <button onClick={handleSend} disabled={busy}
          className="rounded-xl bg-[#355fe5] px-5 py-2 text-[13px] font-medium text-white hover:bg-[#2a4fc7] disabled:opacity-50 transition-colors">
          {busy ? "Sending..." : "Send"}
        </button>
      </div>
      {result && <p className="mt-3 text-[13px] text-slate-600">{result}</p>}
    </section>
  );
}
