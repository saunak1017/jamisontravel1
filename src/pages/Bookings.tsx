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
import { FlightEventList, PickupDropoffPanel, TimelinePanel, TodayWeekPanel, WeekPanel } from "../components/TravelPanels";
import { flightEvents, pickupDropoffEvents } from "../lib/flightEvents";
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
  const [view, setView] = useState<"list" | "calendar" | "week" | "day" | "timeline" | "pickup">("list");
  const [showAll, setShowAll] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingBookingId, setEditingBookingId] = useState<string | null>(null);
  const [duplicatingBookingId, setDuplicatingBookingId] = useState<string | null>(null);

  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelCard, setCancelCard] = useState<BookingCard | null>(null);
  const [summaryOpen, setSummaryOpen] = useState(false);

  const [calMonth, setCalMonth] = useState<string>(() => format(new Date(), "yyyy-MM"));
  const [calDate, setCalDate] = useState<string>(() => format(new Date(), "yyyy-MM-dd"));
  const [weekDate, setWeekDate] = useState<string>(() => format(new Date(), "yyyy-MM-dd"));

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
    const list = showAll ? cards : cards.filter(c => c.traveler_status !== "canceled" && !isFlownCard(c));
    return [...list].sort((a, b) => a.start_date.localeCompare(b.start_date));
  }, [cards, showAll]);

  const calCards = useMemo(() => filtered, [filtered]);
  const events = useMemo(() => flightEvents(calCards, showAll), [calCards, showAll]);
  const dynamicEvents = useMemo(() => flightEvents(cards.filter(c => !isFlownCard(c)), false), [cards]);
  const pickupEvents = useMemo(() => pickupDropoffEvents(calCards, showAll), [calCards, showAll]);

  function openNew() {
    setEditingBookingId(null);
    setDuplicatingBookingId(null);
    setModalOpen(true);
  }

  function openEdit(bookingId: string) {
    setEditingBookingId(bookingId);
    setDuplicatingBookingId(null);
    setModalOpen(true);
  }

  function openDuplicate(bookingId: string) {
    setEditingBookingId(null);
    setDuplicatingBookingId(bookingId);
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
            <Button variant={view === "week" ? "primary" : "ghost"} size="sm" onClick={() => setView("week")}>Week</Button>
            <Button variant={view === "day" ? "primary" : "ghost"} size="sm" onClick={() => setView("day")}>Day</Button>
            <Button variant={view === "timeline" ? "primary" : "ghost"} size="sm" onClick={() => setView("timeline")}>Timeline</Button>
            <Button variant={view === "pickup" ? "primary" : "ghost"} size="sm" onClick={() => setView("pickup")}>Pickup</Button>
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

          <TodayWeekPanel events={dynamicEvents} onPick={openEdit} />

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
            {view === "week" && (
              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1">Week</label>
                <input className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm" type="date" value={weekDate} onChange={(e) => setWeekDate(e.target.value)} />
              </div>
            )}
            {view === "day" && (
              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1">Day</label>
                <input className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm" type="date" value={calDate} onChange={(e) => setCalDate(e.target.value)} />
              </div>
            )}
          </div>

          {view === "list" ? (
            <div className="space-y-3">
              {filtered.map(c => (
                <BookingCardComp
                  key={`${c.booking_id}:${c.traveler_id}:${c.kind}:${c.label}`}
                  card={c}
                  onEdit={openEdit}
                  onDuplicate={openDuplicate}
                  onCancel={openCancel}
                />
              ))}
              {filtered.length === 0 && (
                <div className="text-sm text-slate-400">No bookings to show.</div>
              )}
            </div>
          ) : view === "calendar" ? (
            <CalendarMonth monthISO={calMonth} events={events} onPickBooking={(id) => openEdit(id)} />
          ) : view === "week" ? (
            <WeekPanel weekISO={weekDate} events={events} onPick={openEdit} />
          ) : view === "day" ? (
            <FlightEventList dateISO={calDate} events={events} onPick={openEdit} />
          ) : view === "timeline" ? (
            <TimelinePanel events={events} onPick={openEdit} />
          ) : (
            <PickupDropoffPanel events={pickupEvents.filter(e => e.traveler_status !== "canceled")} onPick={openEdit} />
          )}
        </div>
      </div>

      <BookingModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={load}
        bookingId={editingBookingId}
        duplicateFromId={duplicatingBookingId}
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
