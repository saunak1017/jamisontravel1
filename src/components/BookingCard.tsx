import React, { useMemo, useState } from "react";
import type { BookingCard as Card, TravelerCost } from "../types";
import { format } from "date-fns";
import { formatMinutes } from "../lib/time";
import { Button } from "./Button";

function costLabel(cost: TravelerCost): string {
  if (cost.payment_type === "cash") return `$${cost.cash_usd.toLocaleString()}`;
  return `${cost.miles_used.toLocaleString()} mi + $${cost.fees_usd.toLocaleString()}`;
}

export function BookingCard({
  card,
  onEdit,
  onDuplicate,
  onCancel,
}: {
  card: Card;
  onEdit: (bookingId: string) => void;
  onDuplicate: (bookingId: string) => void;
  onCancel: (card: Card) => void;
}) {
  const [open, setOpen] = useState(false);

  const statusBadge = useMemo(() => {
    if (card.traveler_status === "canceled") return { text: "CANCELED", cls: "bg-rose-500/15 text-rose-200 border-rose-400/30" };
    return { text: "ACTIVE", cls: "bg-emerald-500/10 text-emerald-200 border-emerald-400/20" };
  }, [card.traveler_status]);

  return (
    <div className="rounded-2xl border border-white/10 bg-board-panel2 shadow-soft overflow-hidden">
      <button
        className="w-full text-left px-5 py-4 flex items-start gap-4 hover:bg-white/5 transition"
        onClick={() => setOpen(v => !v)}
      >
        <div className="min-w-[92px]">
          <div className="text-xs text-slate-400 font-mono">DEP</div>
          <div className="text-lg font-semibold font-mono">{format(new Date(card.start_date + "T00:00:00"), "MMM d")}</div>
          <div className="text-xs text-slate-500 font-mono">{format(new Date(card.start_date + "T00:00:00"), "yyyy")}</div>
        </div>

        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-mono tracking-wide border-white/10 bg-black/20">
              {card.label.toUpperCase()}
            </span>
            <span className={["inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-mono tracking-wide", statusBadge.cls].join(" ")}>
              {statusBadge.text}
            </span>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-x-6 gap-y-2">
            <div>
              <div className="text-xs text-slate-400 font-mono">TRAVELER</div>
              <div className="text-sm">{card.traveler_name}</div>
            </div>
            <div>
              <div className="text-xs text-slate-400 font-mono">ROUTE</div>
              <div className="text-sm font-mono">{card.route_summary}</div>
            </div>
            <div>
              <div className="text-xs text-slate-400 font-mono">FLIGHTS</div>
              <div className="text-sm font-mono">{card.flight_numbers}</div>
            </div>
            <div>
              <div className="text-xs text-slate-400 font-mono">PNR</div>
              <div className="text-sm font-mono">{card.pnr || "—"}</div>
            </div>
            <div className="ml-auto">
              <div className="text-xs text-slate-400 font-mono">COST</div>
              <div className="text-sm font-mono">{costLabel(card.cost)}</div>
            </div>
          </div>
        </div>

        <div className="pt-2 text-slate-400">{open ? "▴" : "▾"}</div>
      </button>

      {open && (
        <div className="px-5 pb-5 pt-1 border-t border-white/10">
          <div className="flex items-center justify-between gap-3">
            <div className="text-xs text-slate-400 font-mono">ITINERARY</div>
            <div className="flex items-center gap-2">
              {card.traveler_status !== "canceled" && (
                <Button size="sm" variant="danger" onClick={() => onCancel(card)}>Cancel / Refund</Button>
              )}
              <Button size="sm" variant="ghost" onClick={() => onDuplicate(card.booking_id)}>Duplicate</Button>
              <Button size="sm" variant="ghost" onClick={() => onEdit(card.booking_id)}>Edit booking</Button>
            </div>
          </div>

          <div className="mt-3 space-y-3">
            {card.segments.map((s, idx) => {
              const lay = card.layovers.find(l => l.between_index === idx);
              return (
                <div key={s.id} className="rounded-xl border border-white/10 bg-black/20 px-4 py-3">
                  <div className="flex flex-wrap gap-x-6 gap-y-2 items-center">
                    <div className="font-mono text-sm">{s.flight_number || "—"}</div>
                    <div className="text-sm">{s.airline || "—"}</div>
                    <div className="font-mono text-sm">{s.dep_airport} → {s.arr_airport}</div>
                    <div className="ml-auto text-sm font-mono">
                      {s.dep_date} {s.dep_time} → {s.arr_date} {s.arr_time}
                    </div>
                  </div>
                  {lay && (
                    <div className="mt-2 text-xs font-mono text-slate-300">
                      Layover @ {lay.airport} — {formatMinutes(lay.minutes)}{lay.overridden ? " (override)" : ""}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {card.traveler_status === "canceled" && card.refund && (
            <div className="mt-4 rounded-xl border border-rose-400/20 bg-rose-500/10 px-4 py-3">
              <div className="text-xs font-mono text-rose-200">REFUND</div>
              <div className="mt-1 text-sm text-rose-100">
                {card.refund.method} — ${card.refund.amount_usd.toLocaleString()}
                {card.refund.notes ? <span className="text-rose-200/80"> · {card.refund.notes}</span> : null}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
