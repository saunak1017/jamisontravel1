import React, { useEffect, useMemo, useState } from "react";
import { Modal } from "./Modal";
import { Button } from "./Button";
import { Input } from "./Input";
import { Select } from "./Select";
import type { Booking, BookingType, PaymentType, Traveler, Trip } from "../types";
import { api } from "../lib/api";
import { clampMinutes, localIso, minutesBetween, toTimeValue } from "../lib/time";
import { format } from "date-fns";

type SegmentDraft = {
  flight_number: string;
  airline: string;
  dep_airport: string;
  arr_airport: string;
  dep_date: string;
  dep_time: string;
  arr_date: string;
  arr_time: string;
};

type LegDraft = {
  kind: "outbound" | "return" | "leg";
  label: string;
  segments: SegmentDraft[];
  // layovers are computed on save; but we preview them here
};

function newSegment(todayISO: string): SegmentDraft {
  return {
    flight_number: "",
    airline: "",
    dep_airport: "",
    arr_airport: "",
    dep_date: todayISO,
    dep_time: "09:00",
    arr_date: todayISO,
    arr_time: "10:00",
  };
}

function computeLayovers(segments: SegmentDraft[]) {
  // Layover between i and i+1 at segments[i].arr_airport
  const lays: Array<{ between_index: number; airport: string; minutes: number }> = [];
  for (let i = 0; i < segments.length - 1; i++) {
    const a = segments[i];
    const b = segments[i + 1];
    const airport = (a.arr_airport || "").toUpperCase();
    if (airport !== (b.dep_airport || "").toUpperCase()) continue;
    const mins = clampMinutes(minutesBetween(localIso(a.arr_date, a.arr_time), localIso(b.dep_date, b.dep_time)));
    lays.push({ between_index: i, airport, minutes: mins });
  }
  return lays;
}

function routeSummary(segments: SegmentDraft[]): string {
  const points: string[] = [];
  for (let i = 0; i < segments.length; i++) {
    const s = segments[i];
    if (i === 0 && s.dep_airport) points.push(s.dep_airport.toUpperCase());
    if (s.arr_airport) points.push(s.arr_airport.toUpperCase());
  }
  // compress repeats
  const compact: string[] = [];
  for (const p of points) {
    if (compact.length === 0 || compact[compact.length - 1] !== p) compact.push(p);
  }
  return compact.join("→") || "—";
}

function flightNumbers(segments: SegmentDraft[]): string {
  const nums = segments.map(s => s.flight_number.trim()).filter(Boolean);
  return nums.join("/") || "—";
}

function isISODate(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function isTime24(s: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
}

export function BookingModal({
  open,
  onClose,
  onSaved,
  bookingId,
  duplicateFromId,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  bookingId?: string | null;
  duplicateFromId?: string | null;
}) {
  const todayISO = useMemo(() => format(new Date(), "yyyy-MM-dd"), []);
  const [loading, setLoading] = useState(false);
  const [travelers, setTravelers] = useState<Traveler[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [bookingType, setBookingType] = useState<BookingType>("roundtrip");
  const [pnr, setPnr] = useState("");
  const [classMain, setClassMain] = useState("");
  const [classSecondary, setClassSecondary] = useState("");
  const [ticketIssueDate, setTicketIssueDate] = useState(todayISO);
  const [ticketEndDate, setTicketEndDate] = useState(todayISO);
  const [tripId, setTripId] = useState("");

  const [selectedTravelerIds, setSelectedTravelerIds] = useState<string[]>([]);
  const [paymentType, setPaymentType] = useState<PaymentType>("cash");
  const [cashUsd, setCashUsd] = useState<number>(0);
  const [milesUsed, setMilesUsed] = useState<number>(0);
  const [feesUsd, setFeesUsd] = useState<number>(0);

  const [legs, setLegs] = useState<LegDraft[]>([
    { kind: "outbound", label: "Outbound", segments: [newSegment(todayISO)] },
    { kind: "return", label: "Return", segments: [newSegment(todayISO)] },
  ]);

  const [existing, setExisting] = useState<Booking | null>(null);

  // load travelers + booking if editing
  useEffect(() => {
    if (!open) return;
    setError(null);
    (async () => {
      try {
        const [t, tripList] = await Promise.all([api.travelers.list(), api.trips.list()]);
        setTravelers(t);
        setTrips(tripList);
        const sourceId = bookingId || duplicateFromId;
        if (sourceId) {
          const b = await api.bookings.get(sourceId);
          setExisting(b);
          setBookingType(b.booking_type);
          setPnr(b.pnr ?? "");
          setClassMain(b.class_main ?? "");
          setClassSecondary(b.class_secondary ?? "");
          setTicketIssueDate(b.ticket_issue_date ?? todayISO);
          setTicketEndDate(b.ticket_end_date ?? todayISO);
          setTripId(b.trip_id ?? "");

          setSelectedTravelerIds(duplicateFromId ? [] : b.travelers.map(x => x.traveler_id));

          // payment type can differ per traveler; for editing we default to first traveler values
          const first = b.travelers[0]?.cost;
          if (first?.payment_type === "cash") {
            setPaymentType("cash");
            setCashUsd(first.cash_usd ?? 0);
          } else if (first?.payment_type === "miles") {
            setPaymentType("miles");
            setMilesUsed(first.miles_used ?? 0);
            setFeesUsd(first.fees_usd ?? 0);
          }

          // legs
          const draftLegs: LegDraft[] = b.legs.map(l => ({
            kind: l.kind,
            label: l.label,
            segments: l.segments
              .sort((a, b) => a.sort_index - b.sort_index)
              .map(s => ({
                flight_number: s.flight_number ?? "",
                airline: s.airline ?? "",
                dep_airport: s.dep_airport ?? "",
                arr_airport: s.arr_airport ?? "",
                dep_date: s.dep_date ?? todayISO,
                dep_time: s.dep_time ?? "09:00",
                arr_date: s.arr_date ?? todayISO,
                arr_time: s.arr_time ?? "10:00",
              })),
          }));
          setLegs(draftLegs);
        } else {
          setExisting(null);
          // reset defaults
          setBookingType("roundtrip");
          setPnr("");
          setClassMain("");
          setClassSecondary("");
          setTicketIssueDate(todayISO);
          setTicketEndDate(todayISO);
          setTripId("");
          setSelectedTravelerIds([]);
          setPaymentType("cash");
          setCashUsd(0); setMilesUsed(0); setFeesUsd(0);
          setLegs([
            { kind: "outbound", label: "Outbound", segments: [newSegment(todayISO)] },
            { kind: "return", label: "Return", segments: [newSegment(todayISO)] },
          ]);
        }
      } catch (e: any) {
        setError(e.message ?? "Failed to load data");
      }
    })();
  }, [open, bookingId, duplicateFromId, todayISO]);

  // Adjust legs sections when bookingType changes (only for new/quick edits)
  useEffect(() => {
    if (!open) return;
    if (bookingType === "oneway") {
      setLegs((prev) => {
        const ob = prev.find(l => l.kind === "outbound") ?? { kind: "outbound", label: "Outbound", segments: [newSegment(todayISO)] };
        return [ob];
      });
    } else if (bookingType === "roundtrip") {
      setLegs((prev) => {
        const ob = prev.find(l => l.kind === "outbound") ?? { kind: "outbound", label: "Outbound", segments: [newSegment(todayISO)] };
        const rt = prev.find(l => l.kind === "return") ?? { kind: "return", label: "Return", segments: [newSegment(todayISO)] };
        return [ob, rt];
      });
    } else if (bookingType === "multicity") {
      setLegs((prev) => {
        // Convert to leg-based if not already
        const legsOnly = prev.filter(l => l.kind === "leg");
        if (legsOnly.length > 0) return legsOnly;
        return [
          { kind: "leg", label: "Leg 1", segments: [newSegment(todayISO)] },
        ];
      });
    }
  }, [bookingType, open, todayISO]);

  function toggleTraveler(id: string) {
    setSelectedTravelerIds((prev) => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  function updateLeg(idx: number, leg: Partial<LegDraft>) {
    setLegs(prev => prev.map((l, i) => i === idx ? { ...l, ...leg } : l));
  }

  function updateSegment(legIdx: number, segIdx: number, patch: Partial<SegmentDraft>) {
    setLegs(prev => prev.map((l, i) => {
      if (i !== legIdx) return l;
      const segs = l.segments.map((s, j) => j === segIdx ? { ...s, ...patch } : s);
      return { ...l, segments: segs };
    }));
  }

  function addSegment(legIdx: number) {
    setLegs(prev => prev.map((l, i) => {
      if (i !== legIdx) return l;
      return { ...l, segments: [...l.segments, newSegment(todayISO)] };
    }));
  }

  function removeSegment(legIdx: number, segIdx: number) {
    setLegs(prev => prev.map((l, i) => {
      if (i !== legIdx) return l;
      const segs = l.segments.filter((_, j) => j !== segIdx);
      return { ...l, segments: segs.length ? segs : [newSegment(todayISO)] };
    }));
  }

  function addLeg() {
    setLegs(prev => {
      const n = prev.length + 1;
      return [...prev, { kind: "leg", label: `Leg ${n}`, segments: [newSegment(todayISO)] }];
    });
  }

  function removeLeg(legIdx: number) {
    setLegs(prev => {
      const out = prev.filter((_, i) => i !== legIdx);
      if (out.length === 0) return [{ kind: "leg", label: "Leg 1", segments: [newSegment(todayISO)] }];
      // relabel
      return out.map((l, i) => ({ ...l, label: `Leg ${i + 1}` }));
    });
  }

  function validate(): string | null {
    if (selectedTravelerIds.length === 0) return "Select at least one traveler.";
    if (!isISODate(ticketIssueDate) || !isISODate(ticketEndDate)) return "Ticket dates must be valid (YYYY-MM-DD).";
    // validate payment
    if (paymentType === "cash" && (!Number.isFinite(cashUsd) || cashUsd < 0)) return "Cash amount must be a valid number.";
    if (paymentType === "miles" && (!Number.isFinite(milesUsed) || milesUsed < 0 || !Number.isFinite(feesUsd) || feesUsd < 0)) return "Miles and fees must be valid numbers.";
    // segments
    for (const leg of legs) {
      if (leg.segments.length === 0) return "Each section must have at least one segment.";
      for (const s of leg.segments) {
        if (!s.dep_airport.trim() || !s.arr_airport.trim()) return "Each segment must have departure and arrival airports.";
        if (!isISODate(s.dep_date) || !isISODate(s.arr_date)) return "Segment dates must be valid (YYYY-MM-DD).";
        if (!isTime24(s.dep_time) || !isTime24(s.arr_time)) return "Segment times must be valid 24-hour format HH:MM.";
      }
    }
    return null;
  }

  async function save() {
    const msg = validate();
    if (msg) { setError(msg); return; }
    setLoading(true);
    setError(null);
    try {
      const travelerCosts = selectedTravelerIds.map(id => ({
        traveler_id: id,
        cost: paymentType === "cash"
          ? { payment_type: "cash", cash_usd: cashUsd }
          : { payment_type: "miles", miles_used: milesUsed, fees_usd: feesUsd }
      }));

      const payload = {
        booking_type: bookingType,
        pnr: pnr.trim(),
        class_main: classMain.trim(),
        class_secondary: classSecondary.trim() || null,
        ticket_issue_date: ticketIssueDate,
        ticket_end_date: ticketEndDate,
        trip_id: tripId || null,
        travelers: travelerCosts,
        legs: legs.map(l => ({
          kind: l.kind,
          label: l.label,
          segments: l.segments.map((s, idx) => ({
            sort_index: idx,
            flight_number: s.flight_number.trim(),
            airline: s.airline.trim(),
            dep_airport: s.dep_airport.trim().toUpperCase(),
            arr_airport: s.arr_airport.trim().toUpperCase(),
            dep_date: s.dep_date,
            dep_time: s.dep_time,
            arr_date: s.arr_date,
            arr_time: s.arr_time,
          })),
        })),
      };

      if (bookingId) await api.bookings.update(bookingId, payload);
      else await api.bookings.create(payload);

      onSaved();
      onClose();
    } catch (e: any) {
      setError(e.message ?? "Save failed");
    } finally {
      setLoading(false);
    }
  }

  const sections = useMemo(() => {
    return legs.map((l) => ({
      ...l,
      route: routeSummary(l.segments),
      flights: flightNumbers(l.segments),
      layovers: computeLayovers(l.segments),
    }));
  }, [legs]);

  return (
    <Modal open={open} title={bookingId ? "Edit Booking" : duplicateFromId ? "Duplicate Booking" : "Add Booking"} onClose={onClose}>
      {error && (
        <div className="mb-4 rounded-xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="text-xs font-mono text-slate-400 mb-3">BOOKING</div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Select label="Booking type" value={bookingType} onChange={(e) => setBookingType(e.target.value as BookingType)}>
                <option value="roundtrip">Roundtrip</option>
                <option value="oneway">One-way</option>
                <option value="multicity">Multicity</option>
              </Select>
              <Input label="PNR" placeholder="ABC123" value={pnr} onChange={(e) => setPnr(e.target.value)} />
              <div className="grid grid-cols-2 gap-3">
                <Input label="Ticket issue date" type="date" value={ticketIssueDate} onChange={(e) => setTicketIssueDate(e.target.value)} />
                <Input label="Ticket end date" type="date" value={ticketEndDate} onChange={(e) => setTicketEndDate(e.target.value)} />
              </div>
              <Input label="Class" placeholder="Upper Class / J / Y" value={classMain} onChange={(e) => setClassMain(e.target.value)} />
              <Input label="Secondary class (optional)" placeholder="e.g., domestic feeder" value={classSecondary} onChange={(e) => setClassSecondary(e.target.value)} />
              <Select label="Trip" value={tripId} onChange={(e) => setTripId(e.target.value)}>
                <option value="">No trip</option>
                {trips.map(trip => <option key={trip.id} value={trip.id}>{trip.name}</option>)}
              </Select>
              <Select label="Payment type" value={paymentType} onChange={(e) => setPaymentType(e.target.value as PaymentType)}>
                <option value="cash">Cash</option>
                <option value="miles">Miles</option>
              </Select>

              {paymentType === "cash" ? (
                <Input
                  label="Cost per traveler (USD)"
                  type="number"
                  min={0}
                  step="1"
                  value={String(cashUsd)}
                  onChange={(e) => setCashUsd(Number(e.target.value))}
                />
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    label="Miles used (per traveler)"
                    type="number"
                    min={0}
                    step="1"
                    value={String(milesUsed)}
                    onChange={(e) => setMilesUsed(Number(e.target.value))}
                  />
                  <Input
                    label="Fees (USD) (per traveler)"
                    type="number"
                    min={0}
                    step="1"
                    value={String(feesUsd)}
                    onChange={(e) => setFeesUsd(Number(e.target.value))}
                  />
                </div>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="text-xs font-mono text-slate-400">ITINERARY</div>
              {bookingType === "multicity" && (
                <Button variant="ghost" size="sm" onClick={addLeg}>+ Add leg</Button>
              )}
            </div>

            <div className="space-y-4">
              {sections.map((sec, legIdx) => (
                <div key={legIdx} className="rounded-2xl border border-white/10 bg-board-panel p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <div className="font-semibold">{sec.label}</div>
                      <div className="text-xs font-mono text-slate-400">{sec.route} · {sec.flights}</div>
                    </div>
                    {bookingType === "multicity" && (
                      <Button variant="danger" size="sm" onClick={() => removeLeg(legIdx)}>Remove</Button>
                    )}
                  </div>

                  <div className="mt-3 space-y-3">
                    {sec.segments.map((s, segIdx) => (
                      <div key={segIdx} className="rounded-xl border border-white/10 bg-black/20 p-3">
                        <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
                          <Input label="Flight #" placeholder="VS10" value={s.flight_number} onChange={(e) => updateSegment(legIdx, segIdx, { flight_number: e.target.value })} />
                          <Input label="Airline" placeholder="Virgin Atlantic" value={s.airline} onChange={(e) => updateSegment(legIdx, segIdx, { airline: e.target.value })} />
                          <Input label="Dep (IATA)" placeholder="JFK" value={s.dep_airport} onChange={(e) => updateSegment(legIdx, segIdx, { dep_airport: e.target.value })} />
                          <Input label="Arr (IATA)" placeholder="LHR" value={s.arr_airport} onChange={(e) => updateSegment(legIdx, segIdx, { arr_airport: e.target.value })} />
                          <Input label="Dep date" type="date" value={s.dep_date} onChange={(e) => updateSegment(legIdx, segIdx, { dep_date: e.target.value })} />
                          <Input
                            label="Dep time"
                            placeholder="21:30 or 9:30 PM"
                            value={s.dep_time}
                            onChange={(e) => updateSegment(legIdx, segIdx, { dep_time: e.target.value })}
                            onBlur={(e) => updateSegment(legIdx, segIdx, { dep_time: toTimeValue(e.target.value) })}
                            hint="Stored as local time at departure airport"
                          />
                          <Input label="Arr date" type="date" value={s.arr_date} onChange={(e) => updateSegment(legIdx, segIdx, { arr_date: e.target.value })} />
                          <Input
                            label="Arr time"
                            placeholder="09:20 or 9:20 AM"
                            value={s.arr_time}
                            onChange={(e) => updateSegment(legIdx, segIdx, { arr_time: e.target.value })}
                            onBlur={(e) => updateSegment(legIdx, segIdx, { arr_time: toTimeValue(e.target.value) })}
                            hint="Stored as local time at arrival airport"
                          />
                        </div>
                        <div className="mt-3 flex items-center justify-between">
                          <div className="text-xs font-mono text-slate-400">
                            Segment {segIdx + 1}
                          </div>
                          <Button variant="danger" size="sm" onClick={() => removeSegment(legIdx, segIdx)}>Remove segment</Button>
                        </div>
                      </div>
                    ))}
                    <Button variant="ghost" size="sm" onClick={() => addSegment(legIdx)}>+ Add segment</Button>

                    {sec.layovers.length > 0 && (
                      <div className="mt-3 rounded-xl border border-white/10 bg-black/20 p-3">
                        <div className="text-xs font-mono text-slate-400 mb-2">AUTO LAYOVERS (override later in Edit mode)</div>
                        <div className="space-y-2">
                          {sec.layovers.map(l => (
                            <div key={l.between_index} className="text-xs font-mono text-slate-200">
                              Between seg {l.between_index + 1} and {l.between_index + 2}: {l.airport || "—"} — {Math.floor(l.minutes/60)}h {l.minutes%60}m
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="text-xs font-mono text-slate-400 mb-3">TRAVELERS</div>
            <div className="space-y-2">
              {travelers.length === 0 && (
                <div className="text-sm text-slate-400">No travelers yet. Add them in Admin.</div>
              )}
              {travelers.map(t => (
                <label key={t.id} className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 hover:bg-white/10 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedTravelerIds.includes(t.id)}
                    onChange={() => toggleTraveler(t.id)}
                  />
                  <span className="text-sm">{t.name}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="text-xs font-mono text-slate-400 mb-2">SAVE</div>
            <Button variant="primary" className="w-full" onClick={save} disabled={loading}>
              {loading ? "Saving…" : "Save booking"}
            </Button>
            {existing && (
              <div className="mt-3 text-xs font-mono text-slate-500">
                Editing booking updated at {existing.updated_at}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="text-xs font-mono text-slate-400 mb-2">NOTES</div>
            <div className="text-sm text-slate-300">
              • Times are stored as the scheduled local times you enter.<br/>
              • Layovers are only auto-calculated when the next segment departs from the prior arrival airport.<br/>
              • After saving, you can cancel per traveler with refund details.
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
