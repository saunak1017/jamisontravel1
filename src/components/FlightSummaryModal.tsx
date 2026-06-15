import React, { useMemo, useState } from "react";
import { format } from "date-fns";
import type { BookingCard } from "../types";
import { Button } from "./Button";
import { Modal } from "./Modal";

function cardKey(card: BookingCard): string {
  return `${card.booking_id}:${card.traveler_id}:${card.kind}:${card.label}`;
}

export function FlightSummaryModal({
  open,
  cards,
  onClose,
}: {
  open: boolean;
  cards: BookingCard[];
  onClose: () => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const dates = useMemo(() => [...new Set(cards.map(card => card.start_date))].sort(), [cards]);
  const sortedCards = useMemo(
    () => [...cards].sort((a, b) => `${a.start_date} ${a.segments[0]?.dep_time ?? ""}`.localeCompare(`${b.start_date} ${b.segments[0]?.dep_time ?? ""}`)),
    [cards],
  );
  const rows = useMemo(() => sortedCards
    .filter(card => selected.has(cardKey(card)))
    .flatMap(card => card.segments.map(segment => ({ card, segment })))
    .sort((a, b) => `${a.segment.dep_date}T${a.segment.dep_time}`.localeCompare(`${b.segment.dep_date}T${b.segment.dep_time}`)),
  [selected, sortedCards]);

  function toggle(keys: string[], checked: boolean) {
    setSelected(current => {
      const next = new Set(current);
      keys.forEach(key => checked ? next.add(key) : next.delete(key));
      return next;
    });
  }

  function close() {
    setSelected(new Set());
    onClose();
  }

  return (
    <Modal open={open} title="Create flight summary" onClose={close}>
      <div className="space-y-6">
        <section>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="font-semibold">Select flights or departure dates</div>
              <div className="text-sm text-slate-400">Selecting a date adds every traveler itinerary departing that day.</div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => toggle(cards.map(cardKey), true)}>Select all</Button>
              <Button size="sm" onClick={() => setSelected(new Set())}>Clear</Button>
            </div>
          </div>

          <div className="mt-4 space-y-4">
            {dates.map(date => {
              const dateCards = sortedCards.filter(card => card.start_date === date);
              const keys = dateCards.map(cardKey);
              const allSelected = keys.every(key => selected.has(key));
              return (
                <div key={date} className="rounded-xl border border-white/10 bg-black/20 overflow-hidden">
                  <label className="flex items-center gap-3 px-4 py-3 border-b border-white/10 cursor-pointer hover:bg-white/5">
                    <input type="checkbox" checked={allSelected} onChange={event => toggle(keys, event.target.checked)} />
                    <span className="font-mono font-semibold">{format(new Date(date + "T00:00:00"), "EEE, MMM d, yyyy")}</span>
                    <span className="text-xs text-slate-400">{dateCards.length} {dateCards.length === 1 ? "itinerary" : "itineraries"}</span>
                  </label>
                  <div className="divide-y divide-white/10">
                    {dateCards.map(card => {
                      const key = cardKey(card);
                      return (
                        <label key={key} className="flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-white/5">
                          <input className="mt-1" type="checkbox" checked={selected.has(key)} onChange={event => toggle([key], event.target.checked)} />
                          <span>
                            <span className="block">{card.traveler_name} · <span className="font-mono">{card.route_summary}</span></span>
                            <span className="block text-xs font-mono text-slate-400">{card.flight_numbers || "Flight number not set"}</span>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="border-t border-white/10 pt-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="font-semibold">Summary</div>
              <div className="text-sm text-slate-400">{rows.length} selected flight {rows.length === 1 ? "segment" : "segments"}, ordered by departure</div>
            </div>
            {rows.length > 0 && <Button size="sm" onClick={() => window.print()}>Print summary</Button>}
          </div>
          {rows.length === 0 ? (
            <div className="mt-4 rounded-xl border border-dashed border-white/15 p-6 text-center text-sm text-slate-400">
              Select one or more flights or dates to build a summary.
            </div>
          ) : (
            <div className="mt-4 overflow-x-auto rounded-xl border border-white/10">
              <table className="w-full min-w-[780px] text-left text-sm">
                <thead className="bg-black/30 text-xs font-mono text-slate-400">
                  <tr><th className="p-3">DEPARTURE</th><th className="p-3">PASSENGER</th><th className="p-3">FLIGHT</th><th className="p-3">AIRLINE</th><th className="p-3">ROUTE</th><th className="p-3">ARRIVAL</th></tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {rows.map(({ card, segment }) => (
                    <tr key={`${cardKey(card)}:${segment.id}`} className="bg-black/10">
                      <td className="p-3 font-mono whitespace-nowrap">{segment.dep_date} {segment.dep_time}</td>
                      <td className="p-3">{card.traveler_name}</td>
                      <td className="p-3 font-mono">{segment.flight_number || "—"}</td>
                      <td className="p-3">{segment.airline || "—"}</td>
                      <td className="p-3 font-mono whitespace-nowrap">{segment.dep_airport} → {segment.arr_airport}</td>
                      <td className="p-3 font-mono whitespace-nowrap">{segment.arr_date} {segment.arr_time}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </Modal>
  );
}
