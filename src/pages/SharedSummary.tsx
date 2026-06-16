import React, { useEffect, useState } from "react";
import { format } from "date-fns";
import { api } from "../lib/api";
import type { SharedSummary as Summary } from "../types";

export function SharedSummary({ slug }: { slug: string }) {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSummary(null);
    setError(null);
    api.summaries.get(slug).then(setSummary).catch(error => setError(error.message));
  }, [slug]);

  if (error) return <div className="rounded-2xl border border-rose-400/20 bg-rose-500/10 p-6 text-rose-100">{error}</div>;
  if (!summary) return <div className="text-slate-400">Loading summary…</div>;

  return (
    <div className="rounded-2xl border border-white/10 bg-board-panel2 shadow-soft overflow-hidden">
      <div className="px-5 py-5 border-b border-white/10">
        <div className="text-xs font-mono text-sky-300">SHARED FLIGHT SUMMARY</div>
        <h1 className="mt-1 text-2xl font-semibold">{summary.slug}</h1>
        <div className="mt-1 text-sm text-slate-400">{summary.rows.length} flight {summary.rows.length === 1 ? "segment" : "segments"} · Created {format(new Date(summary.created_at), "MMM d, yyyy")}</div>
      </div>
      <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-3">
        {[...summary.rows].sort((a, b) => `${a.passenger}:${a.trip_name || ""}:${a.dep_date}T${a.dep_time}`.localeCompare(`${b.passenger}:${b.trip_name || ""}:${b.dep_date}T${b.dep_time}`)).map((row, index) => (
          <div key={`${row.passenger}:${row.flight_number}:${index}`} className="rounded-xl border border-white/10 bg-black/20 p-3">
            <div className="flex items-start justify-between gap-3">
              <div><div className="font-semibold">{row.passenger}</div><div className="text-xs text-slate-400">{row.trip_name || "Trip"}</div></div>
              <div className="text-right font-mono text-sm">{row.flight_number || "—"}</div>
            </div>
            <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
              <div><div className="text-xl font-mono">{row.dep_airport}</div><div className="text-xs font-mono text-slate-400">{row.dep_date} {row.dep_time}</div></div>
              <div className="text-sky-300">→</div>
              <div className="text-right"><div className="text-xl font-mono">{row.arr_airport}</div><div className="text-xs font-mono text-slate-400">{row.arr_date} {row.arr_time}</div></div>
            </div>
            <div className="mt-3 text-xs text-slate-400">{row.airline || "Airline not set"}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
