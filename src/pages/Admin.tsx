import React, { useEffect, useState } from "react";
import { api } from "../lib/api";
import type { Traveler, Trip } from "../types";
import { Button } from "../components/Button";
import { Input } from "../components/Input";

export function Admin() {
  const [items, setItems] = useState<Traveler[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [name, setName] = useState("");
  const [tripName, setTripName] = useState("");
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    try {
      setErr(null);
      const [travelerList, tripList] = await Promise.all([api.travelers.list(), api.trips.list()]);
      setItems(travelerList);
      setTrips(tripList);
    } catch (e: any) {
      setErr(e.message ?? "Failed");
    }
  }

  useEffect(() => { load(); }, []);

  async function add() {
    if (!name.trim()) return;
    try {
      await api.travelers.create(name.trim(), "sky");
      setName("");
      await load();
    } catch (e: any) {
      setErr(e.message ?? "Failed");
    }
  }

  async function rename(id: string, newName: string, color: string) {
    try {
      await api.travelers.update(id, { name: newName, color });
      await load();
    } catch (e: any) {
      setErr(e.message ?? "Failed");
    }
  }

  async function addTrip() {
    if (!tripName.trim()) return;
    try {
      await api.trips.create(tripName.trim());
      setTripName("");
      await load();
    } catch (e: any) {
      setErr(e.message ?? "Failed");
    }
  }

  async function renameTrip(id: string, newName: string) {
    try {
      await api.trips.update(id, newName);
      await load();
    } catch (e: any) {
      setErr(e.message ?? "Failed");
    }
  }

  async function removeTrip(id: string) {
    if (!confirm("Remove trip? Existing bookings will stay, but will no longer be assigned to this trip.")) return;
    try {
      await api.trips.remove(id);
      await load();
    } catch (e: any) {
      setErr(e.message ?? "Failed");
    }
  }

  async function remove(id: string) {
    if (!confirm("Remove traveler? (This won't delete existing bookings, but traveler won't be selectable.)")) return;
    try {
      await api.travelers.remove(id);
      await load();
    } catch (e: any) {
      setErr(e.message ?? "Failed");
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-white/10 bg-board-panel2 shadow-soft overflow-hidden">
        <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
          <div className="font-semibold font-mono">Admin · Travelers</div>
          <div className="text-xs text-slate-400 font-mono">No login</div>
        </div>

        <div className="p-5 space-y-4">
          {err && <div className="rounded-xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{err}</div>}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
            <Input label="Add traveler" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
            <div>
              <Button variant="primary" onClick={add}>Add</Button>
            </div>
          </div>

          <div className="space-y-2">
            {items.map(t => (
              <TravelerRow key={t.id} traveler={t} onRename={rename} onRemove={remove} />
            ))}
            {items.length === 0 && <div className="text-sm text-slate-400">No travelers yet.</div>}
          </div>
        </div>
      </div>
      <div className="rounded-2xl border border-white/10 bg-board-panel2 shadow-soft overflow-hidden">
        <div className="px-5 py-4 border-b border-white/10">
          <div className="font-semibold font-mono">Admin · Trips</div>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
            <Input label="Add trip" placeholder="India Summer 2026" value={tripName} onChange={(e) => setTripName(e.target.value)} />
            <div><Button variant="primary" onClick={addTrip}>Add trip</Button></div>
          </div>
          <div className="space-y-2">
            {trips.map(t => <TripRow key={t.id} trip={t} onRename={renameTrip} onRemove={removeTrip} />)}
            {trips.length === 0 && <div className="text-sm text-slate-400">No trips yet.</div>}
          </div>
        </div>
      </div>
    </div>
  );
}

function TravelerRow({
  traveler,
  onRename,
  onRemove,
}: {
  traveler: Traveler;
  onRename: (id: string, name: string, color: string) => void;
  onRemove: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(traveler.name);
  const [color, setColor] = useState(traveler.color || "sky");

  return (
    <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 flex items-center gap-3">
      {!editing ? (
        <>
          <div className="flex-1">
            <div className="text-sm flex items-center gap-2"><ColorDot color={traveler.color || "sky"} />{traveler.name}</div>
            <div className="text-xs font-mono text-slate-500">{traveler.id}</div>
          </div>
          <Button size="sm" onClick={() => setEditing(true)}>Rename</Button>
          <Button size="sm" variant="danger" onClick={() => onRemove(traveler.id)}>Remove</Button>
        </>
      ) : (
        <>
          <div className="flex-1">
            <Input value={name} onChange={(e) => setName(e.target.value)} />
            <select className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm" value={color} onChange={(e) => setColor(e.target.value)}>
              {COLORS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <Button size="sm" variant="primary" onClick={() => { onRename(traveler.id, name.trim(), color); setEditing(false); }}>Save</Button>
          <Button size="sm" onClick={() => { setName(traveler.name); setEditing(false); }}>Cancel</Button>
        </>
      )}
    </div>
  );
}

const COLORS = ["sky", "emerald", "violet", "amber", "rose", "cyan", "lime", "orange"];

function ColorDot({ color }: { color: string }) {
  return <span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: colorHex(color) }} />;
}

function colorHex(color: string) {
  return ({ sky: "#38bdf8", emerald: "#34d399", violet: "#a78bfa", amber: "#fbbf24", rose: "#fb7185", cyan: "#22d3ee", lime: "#a3e635", orange: "#fb923c" } as Record<string, string>)[color] || "#38bdf8";
}

function TripRow({ trip, onRename, onRemove }: { trip: Trip; onRename: (id: string, name: string) => void; onRemove: (id: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(trip.name);
  return (
    <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 flex items-center gap-3">
      {!editing ? (
        <>
          <div className="flex-1"><div className="text-sm">{trip.name}</div><div className="text-xs font-mono text-slate-500">{trip.id}</div></div>
          <Button size="sm" onClick={() => setEditing(true)}>Rename</Button>
          <Button size="sm" variant="danger" onClick={() => onRemove(trip.id)}>Remove</Button>
        </>
      ) : (
        <>
          <div className="flex-1"><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
          <Button size="sm" variant="primary" onClick={() => { onRename(trip.id, name.trim()); setEditing(false); }}>Save</Button>
          <Button size="sm" onClick={() => { setName(trip.name); setEditing(false); }}>Cancel</Button>
        </>
      )}
    </div>
  );
}
