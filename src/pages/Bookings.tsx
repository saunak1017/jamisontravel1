import React, { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import type { BookingCard, Traveler } from "../types";
import { Button } from "../components/Button";
import { Select } from "../components/Select";
import { BookingCard as BookingCardComp } from "../components/BookingCard";
import { BookingModal } from "../components/BookingModal";
import { CalendarMonth } from "../components/CalendarMonth";
import { CancelTravelerModal } from "../components/CancelTravelerModal";
import { FlightSummaryModal } from "../components/FlightSummaryModal";
import { format } from "date-fns";

function isFlownCard(card: BookingCard): boolean {
  // Flown when last segment arrival datetime passes.
  // Computed in the viewer's local time; good enough for "Upcoming vs All Trips".
  const last = card.segments[card.segments.length - 1];
  if (!last) return false;
  const iso = `${last.arr_date}T${last.arr_time}:00`;
  return new Date(iso).getTime() < Date.now();
}

export function Bookings() {
  const [cards, setCards] = useState<BookingCard[]>([]);
  const [travelers, setTravelers] = useState<Traveler[]>([]);
  const [travelerFilter, setTravelerFilter] = useState<string>("all");
  const [view, setView] = useState<"list" | "calendar">("list");
  const [showAll, setShowAll] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingBookingId, setEditingBookingId] = useState<string | null>(null);

  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelCard, setCancelCard] = useState<BookingCard | null>(null);
  const [summaryOpen, setSummaryOpen] = useState(false);

  const [calMonth, setCalMonth] = useState<string>(() => format(new Date(), "yyyy-MM"));

  async function load() {
    try {
      setError(null);
      const [t, c] = await Promise.all([
        api.travelers.list(),
        api.bookings.listCards({
          travelerId: travelerFilter === "all" ? undefined : travelerFilter,
          includeFlown: true,
        }),
      ]);
      setTravelers(t);
      setCards(c);
    } catch (e: any) {
      setError(e.message ?? "Failed to load");
    }
  }

  useEffect(() => { load(); }, [travelerFilter]);

  const filtered = useMemo(() => {
    const list = showAll ? cards : cards.filter(c => !isFlownCard(c));
    return [...list].sort((a, b) => a.start_date.localeCompare(b.start_date));
  }, [cards, showAll]);

  const calCards = useMemo(() => filtered, [filtered]);

  function openNew() {
    setEditingBookingId(null);
    setModalOpen(true);
  }

  function openEdit(bookingId: string) {
    setEditingBookingId(bookingId);
    setModalOpen(true);
  }

  function openCancel(card: BookingCard) {
    setCancelCard(card);
    setCancelOpen(true);
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-white/10 bg-board-panel2 shadow-soft overflow-hidden">
        <div className="px-5 py-4 border-b border-white/10 flex flex-wrap items-center gap-3 justify-between">
          <div className="flex items-center gap-3">
            <div className="font-semibold font-mono">Bookings</div>
            <span className="text-xs font-mono text-slate-400 border border-white/10 rounded-full px-3 py-1 bg-black/20">
              {showAll ? "ALL TRIPS" : "UPCOMING"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant={view === "list" ? "primary" : "ghost"} size="sm" onClick={() => setView("list")}>List</Button>
            <Button variant={view === "calendar" ? "primary" : "ghost"} size="sm" onClick={() => setView("calendar")}>Calendar</Button>
            <Button size="sm" onClick={() => setSummaryOpen(true)}>Create summary</Button>
            <Button variant="primary" size="sm" onClick={openNew}>+ Add booking</Button>
          </div>
        </div>

        <div className="p-5 space-y-4">
          {error && (
            <div className="rounded-xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
            <Select label="Filter by traveler" value={travelerFilter} onChange={(e) => setTravelerFilter(e.target.value)}>
              <option value="all">All</option>
              {travelers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </Select>

            <div className="md:col-span-2 flex items-center gap-2">
              <Button size="sm" variant={showAll ? "ghost" : "primary"} onClick={() => setShowAll(false)}>Upcoming</Button>
              <Button size="sm" variant={showAll ? "primary" : "ghost"} onClick={() => setShowAll(true)}>All Trips</Button>
              <div className="text-xs font-mono text-slate-400 ml-2">{filtered.length} cards</div>
            </div>

            {view === "calendar" && (
              <Select label="Month" value={calMonth} onChange={(e) => setCalMonth(e.target.value)}>
                {monthOptions().map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </Select>
            )}
          </div>

          {view === "list" ? (
            <div className="space-y-3">
              {filtered.map(c => (
                <BookingCardComp
                  key={`${c.booking_id}:${c.traveler_id}:${c.kind}:${c.label}`}
                  card={c}
                  onEdit={openEdit}
                  onCancel={openCancel}
                />
              ))}
              {filtered.length === 0 && (
                <div className="text-sm text-slate-400">No bookings to show.</div>
              )}
            </div>
          ) : (
            <CalendarMonth monthISO={calMonth} cards={calCards} onPickBooking={(id) => openEdit(id)} />
          )}
        </div>
      </div>

      <BookingModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={load}
        bookingId={editingBookingId}
      />

      <CancelTravelerModal
        open={cancelOpen}
        card={cancelCard}
        onClose={() => { setCancelOpen(false); setCancelCard(null); }}
        onSaved={load}
      />

      <FlightSummaryModal open={summaryOpen} cards={filtered} onClose={() => setSummaryOpen(false)} />
    </div>
  );
}

function monthOptions(): string[] {
  const now = new Date();
  const out: string[] = [];
  const start = new Date(now.getFullYear(), now.getMonth() - 12, 1);
  for (let i = 0; i < 31; i++) {
    const d = new Date(start.getFullYear(), start.getMonth() + i, 1);
    out.push(format(d, "yyyy-MM"));
  }
  return out;
}
