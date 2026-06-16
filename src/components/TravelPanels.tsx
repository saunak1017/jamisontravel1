import React from "react";
import { addDays, format, startOfWeek } from "date-fns";
import { eventColor, type FlightEvent } from "../lib/flightEvents";
import { Button } from "./Button";

function EventCard({ event, onPick }: { event: FlightEvent; onPick: (bookingId: string) => void }) {
  return (
    <button
      className="w-full rounded-xl border border-white/10 bg-black/20 p-3 text-left hover:bg-white/10"
      style={{ borderLeftColor: eventColor(event.traveler_color), borderLeftWidth: 4 }}
      onClick={() => onPick(event.booking_id)}
      title={`${event.traveler_name} · ${event.segment.flight_number} · ${event.segment.dep_airport} to ${event.segment.arr_airport}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div><div className="font-semibold">{event.traveler_name}</div><div className="text-xs text-slate-400">{event.trip_name || event.label}</div></div>
        <div className="text-right font-mono text-sm">{event.segment.dep_time}</div>
      </div>
      <div className="mt-2 font-mono text-sm">{event.segment.dep_airport} → {event.segment.arr_airport}</div>
      <div className="mt-1 text-xs text-slate-400">{event.segment.dep_date} · {event.segment.airline || "—"} {event.segment.flight_number || "—"}</div>
      {event.is_tight_connection && <div className="mt-2 text-xs font-mono text-amber-300">TIGHT CONNECTION · {event.layover_minutes}m</div>}
    </button>
  );
}

export function WeekPanel({ weekISO, events, onPick }: { weekISO: string; events: FlightEvent[]; onPick: (bookingId: string) => void }) {
  const weekStart = startOfWeek(new Date(weekISO + "T00:00:00"), { weekStartsOn: 0 });
  const days = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
  return (
    <div className="rounded-2xl border border-white/10 bg-board-panel2 shadow-soft overflow-hidden">
      <div className="px-5 py-4 border-b border-white/10 flex flex-wrap items-center justify-between gap-2">
        <div className="font-semibold font-mono">
          Week of {format(weekStart, "MMM d, yyyy")}
        </div>
        <div className="text-xs text-slate-400 font-mono">Departure board</div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-7 divide-y lg:divide-y-0 lg:divide-x divide-white/10">
        {days.map(day => {
          const iso = format(day, "yyyy-MM-dd");
          const dayEvents = events.filter(event => event.segment.dep_date === iso);
          return (
            <div key={iso} className="min-h-[180px] p-3">
              <div className="mb-3 flex items-center justify-between gap-2">
                <div>
                  <div className="text-sm font-semibold">{format(day, "EEE")}</div>
                  <div className="text-xs font-mono text-slate-400">{format(day, "MMM d")}</div>
                </div>
                <div className="text-[10px] font-mono text-sky-300">{dayEvents.length}</div>
              </div>
              <div className="space-y-2">
                {dayEvents.map(event => <EventCard key={event.id} event={event} onPick={onPick} />)}
              </div>
              {dayEvents.length === 0 && <div className="text-xs text-slate-500">No departures</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function TodayWeekPanel({ events, onPick }: { events: FlightEvent[]; onPick: (bookingId: string) => void }) {
  const today = format(new Date(), "yyyy-MM-dd");
  const weekEnd = format(addDays(new Date(), 7), "yyyy-MM-dd");
  const todayEvents = events.filter(e => e.segment.dep_date === today);
  const weekEvents = events.filter(e => e.segment.dep_date > today && e.segment.dep_date <= weekEnd);
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Panel title="Today" events={todayEvents} empty="No departures today." onPick={onPick} />
      <Panel title="Next 7 days" events={weekEvents} empty="No departures in the next week." onPick={onPick} />
    </div>
  );
}

function Panel({ title, events, empty, onPick }: { title: string; events: FlightEvent[]; empty: string; onPick: (bookingId: string) => void }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-board-panel2 shadow-soft p-4">
      <div className="mb-3 flex items-center justify-between"><div className="font-semibold font-mono">{title}</div><div className="text-xs font-mono text-slate-400">{events.length}</div></div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {events.slice(0, 6).map(e => <EventCard key={e.id} event={e} onPick={onPick} />)}
      </div>
      {events.length === 0 && <div className="text-sm text-slate-400">{empty}</div>}
    </div>
  );
}

export function TimelinePanel({ events, onPick }: { events: FlightEvent[]; onPick: (bookingId: string) => void }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-board-panel2 shadow-soft p-4">
      <div className="font-semibold font-mono mb-3">Trip timeline</div>
      <div className="space-y-3">{events.map(e => <EventCard key={e.id} event={e} onPick={onPick} />)}</div>
      {events.length === 0 && <div className="text-sm text-slate-400">No timeline events.</div>}
    </div>
  );
}

export function PickupDropoffPanel({ events, onPick }: { events: FlightEvent[]; onPick: (bookingId: string) => void }) {
  const items = events.flatMap(e => [
    { ...e, id: `${e.id}:dep`, type: "Drop-off", airport: e.segment.dep_airport, date: e.segment.dep_date, time: e.segment.dep_time },
    { ...e, id: `${e.id}:arr`, type: "Pickup", airport: e.segment.arr_airport, date: e.segment.arr_date, time: e.segment.arr_time },
  ]).sort((a, b) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`));
  return (
    <div className="rounded-2xl border border-white/10 bg-board-panel2 shadow-soft p-4">
      <div className="font-semibold font-mono mb-3">Pickup / Drop-off</div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {items.map(item => (
          <button key={item.id} className="rounded-xl border border-white/10 bg-black/20 p-3 text-left hover:bg-white/10" onClick={() => onPick(item.booking_id)} style={{ borderLeftColor: eventColor(item.traveler_color), borderLeftWidth: 4 }}>
            <div className="text-xs font-mono text-sky-300">{item.type}</div>
            <div className="mt-1 font-semibold">{item.traveler_name} · <span className="font-mono">{item.airport}</span></div>
            <div className="text-sm font-mono text-slate-300">{item.date} {item.time}</div>
            <div className="text-xs text-slate-400">{item.segment.flight_number || "—"} · {item.segment.dep_airport} → {item.segment.arr_airport}</div>
          </button>
        ))}
      </div>
      {items.length === 0 && <div className="text-sm text-slate-400">No pickup/drop-off events.</div>}
    </div>
  );
}

export function FlightEventList({ dateISO, events, onPick }: { dateISO: string; events: FlightEvent[]; onPick: (bookingId: string) => void }) {
  const dayEvents = events.filter(e => e.segment.dep_date === dateISO);
  return (
    <div className="rounded-2xl border border-white/10 bg-board-panel2 shadow-soft p-4">
      <div className="font-semibold font-mono mb-3">{format(new Date(dateISO + "T00:00:00"), "EEEE, MMM d")}</div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">{dayEvents.map(e => <EventCard key={e.id} event={e} onPick={onPick} />)}</div>
      {dayEvents.length === 0 && <div className="text-sm text-slate-400">No departures.</div>}
    </div>
  );
}
