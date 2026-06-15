import React, { useMemo, useState } from "react";
import type { BookingCard } from "../types";
import { addDays, endOfMonth, endOfWeek, format, isSameMonth, startOfMonth, startOfWeek } from "date-fns";
import { Modal } from "./Modal";

type Item = {
  date: string; // YYYY-MM-DD
  label: string;
  sub: string;
  id: string;
};

export function CalendarMonth({
  monthISO,
  cards,
  onPickBooking,
}: {
  monthISO: string; // YYYY-MM (first day assumed)
  cards: BookingCard[];
  onPickBooking: (bookingId: string) => void;
}) {
  const first = startOfMonth(new Date(monthISO + "-01T00:00:00"));
  const [openDate, setOpenDate] = useState<string | null>(null);
  const gridStart = startOfWeek(first, { weekStartsOn: 0 });
  const gridEnd = endOfWeek(endOfMonth(first), { weekStartsOn: 0 });

  const itemsByDate = useMemo(() => {
    const map = new Map<string, Item[]>();
    for (const c of cards) {
      const arr = map.get(c.start_date) ?? [];
      arr.push({
        date: c.start_date,
        id: `${c.booking_id}:${c.traveler_id}:${c.kind}:${c.label}`,
        label: `${c.traveler_name} · ${c.route_summary}`,
        sub: c.flight_numbers,
      });
      map.set(c.start_date, arr);
    }
    // stable sort per day
    for (const [k, v] of map) map.set(k, v.sort((a,b) => a.label.localeCompare(b.label)));
    return map;
  }, [cards]);

  const days: Date[] = [];
  for (let d = gridStart; d <= gridEnd; d = addDays(d, 1)) days.push(d);

  return (
    <div className="rounded-2xl border border-white/10 bg-board-panel2 shadow-soft overflow-hidden">
      <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
        <div className="font-semibold font-mono">{format(first, "MMMM yyyy")}</div>
        <div className="text-xs text-slate-400 font-mono">Month view</div>
      </div>

      <div className="grid grid-cols-7 border-t border-white/10">
        {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(d => (
          <div key={d} className="px-3 py-2 text-xs font-mono text-slate-400 border-b border-white/10 bg-black/20">{d}</div>
        ))}
        {days.map((d) => {
          const iso = format(d, "yyyy-MM-dd");
          const isThisMonth = isSameMonth(d, first);
          const items = itemsByDate.get(iso) ?? [];
          return (
            <div key={iso} className={["min-h-[120px] p-3 border-b border-white/10 border-r border-white/10", isThisMonth ? "" : "bg-black/20 text-slate-500"].join(" ")}>
              <div className="flex items-center justify-between">
                <div className="text-xs font-mono">{format(d, "d")}</div>
                {items.length > 0 && <div className="text-[10px] font-mono text-sky-300">{items.length}</div>}
              </div>
              <div className="mt-2 space-y-2">
                {items.slice(0, 3).map((it) => (
                  <button
                    key={it.id}
                    className="w-full text-left rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 px-2 py-1"
                    onClick={() => onPickBooking(it.id.split(":")[0])}
                    title={it.label}
                  >
                    <div className="text-[11px] font-mono truncate">{it.label}</div>
                    <div className="text-[10px] font-mono text-slate-400 truncate">{it.sub}</div>
                  </button>
                ))}
                {items.length > 3 && (
                  <button
                    className="text-[10px] font-mono text-sky-300 hover:text-sky-200 hover:underline"
                    onClick={() => setOpenDate(iso)}
                  >
                    + {items.length - 3} more
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <Modal
        open={openDate !== null}
        title={openDate ? `Flights — ${format(new Date(openDate + "T00:00:00"), "MMMM d, yyyy")}` : "Flights"}
        onClose={() => setOpenDate(null)}
      >
        <div className="space-y-3">
          {(openDate ? itemsByDate.get(openDate) ?? [] : []).map((it) => (
            <button
              key={it.id}
              className="w-full text-left rounded-xl border border-white/10 bg-black/20 hover:bg-white/10 px-4 py-3 transition"
              onClick={() => onPickBooking(it.id.split(":")[0])}
            >
              <div className="font-medium">{it.label}</div>
              <div className="mt-1 text-sm font-mono text-slate-400">{it.sub || "Flight number not set"}</div>
            </button>
          ))}
        </div>
      </Modal>
    </div>
  );
}
