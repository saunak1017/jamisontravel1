import React, { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { api } from "../lib/api";
import { airportDisplay, flightDisplay, groupSummaryRows, timeDisplay } from "../lib/summaryBoard";
import type { SharedSummary as Summary } from "../types";

export function SharedSummary({ slug }: { slug: string }) {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSummary(null);
    setError(null);
    api.summaries.get(slug).then(setSummary).catch(error => setError(error.message));
  }, [slug]);

  const dateGroups = useMemo(() => summary ? groupSummaryRows(summary.rows) : [], [summary]);

  if (error) return <div className="rounded-2xl border border-rose-400/20 bg-rose-500/10 p-6 text-rose-100">{error}</div>;
  if (!summary) return <div className="text-slate-400">Loading summary…</div>;

  return (
    <div className="rounded-2xl border border-white/10 bg-[#05070a] shadow-soft overflow-hidden">
      <div className="px-5 py-5 border-b border-white/10 bg-gradient-to-r from-black via-board-panel2 to-black">
        <div className="text-xs font-mono tracking-[0.35em] text-sky-300">DEPARTURE BOARD</div>
        <h1 className="mt-2 text-2xl font-semibold uppercase tracking-wide">{summary.slug}</h1>
        <div className="mt-1 text-sm text-slate-400">{summary.rows.length} passenger flight {summary.rows.length === 1 ? "segment" : "segments"} · Created {format(new Date(summary.created_at), "MMM d, yyyy")}</div>
      </div>

      <div className="space-y-6 p-4 sm:p-5">
        {dateGroups.map(dateGroup => (
          <section key={dateGroup.date || "date-tbd"} className="overflow-hidden rounded-xl border border-slate-700/70 bg-zinc-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
            <div className="border-b border-slate-700/70 bg-black px-4 py-3 font-mono text-sm font-semibold tracking-[0.3em] text-amber-200">
              {dateGroup.label}
            </div>
            <div className="hidden grid-cols-[90px_180px_120px_130px_1fr] border-b border-slate-800 bg-zinc-900/80 px-4 py-2 font-mono text-[11px] uppercase tracking-[0.25em] text-slate-500 md:grid">
              <div>Time</div>
              <div>Flight</div>
              <div>Route</div>
              <div>Arrival</div>
              <div>Passengers</div>
            </div>
            <div className="divide-y divide-slate-800/90">
              {dateGroup.flights.map(group => (
                <div key={group.key} className="bg-[linear-gradient(180deg,rgba(24,24,27,0.95),rgba(9,9,11,0.95))] px-4 py-4 font-mono md:grid md:grid-cols-[90px_180px_120px_130px_1fr] md:items-start md:gap-0">
                  <div className="text-2xl font-bold tracking-wider text-white md:text-xl">{timeDisplay(group.dep_time)}</div>
                  <div className="mt-2 text-lg font-semibold uppercase tracking-widest text-slate-100 md:mt-0 md:text-base">{flightDisplay(group)}</div>
                  <div className="mt-2 text-lg uppercase tracking-widest text-sky-200 md:mt-0 md:text-base">
                    {airportDisplay(group.dep_airport)}<span className="px-1 text-slate-500">→</span>{airportDisplay(group.arr_airport)}
                  </div>
                  <div className="mt-2 uppercase tracking-widest text-slate-300 md:mt-0">
                    {airportDisplay(group.arr_airport)} {timeDisplay(group.arr_time)}
                  </div>
                  <div className="mt-3 md:mt-0">
                    <div className="text-xs uppercase tracking-[0.25em] text-amber-200">{group.rows.length} {group.rows.length === 1 ? "PAX" : "PAX"}</div>
                    <div className="mt-2 flex flex-wrap gap-2 font-sans">
                      {group.rows
                        .slice()
                        .sort((a, b) => a.passenger.localeCompare(b.passenger))
                        .map(row => (
                          <span key={`${group.key}:${row.passenger}:${row.trip_name || ""}`} className="rounded bg-slate-800/90 px-2 py-1 text-sm text-slate-100 ring-1 ring-white/10">
                            {row.passenger}
                          </span>
                        ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
