import { err, json, nowISO, readJson, uid, upperIata, localIso, minutesBetween } from "../../_utils";
import { loadBooking } from "./_booking";

type Payload = {
  booking_type: "oneway" | "roundtrip" | "multicity";
  pnr: string;
  class_main: string;
  class_secondary?: string | null;
  ticket_issue_date: string;
  ticket_end_date: string;
  cost_note?: string | null;
  trip_id?: string | null;
  travelers: Array<{
    traveler_id: string;
    cost: { payment_type: "cash"; cash_usd: number } | { payment_type: "miles"; miles_used: number; fees_usd: number };
  }>;
  legs: Array<{
    kind: "outbound" | "return" | "leg";
    label: string;
    segments: Array<{
      sort_index: number;
      flight_number: string;
      airline: string;
      dep_airport: string;
      arr_airport: string;
      dep_date: string;
      dep_time: string;
      arr_date: string;
      arr_time: string;
    }>;
  }>;
};

function validate(p: Payload) {
  if (!p.booking_type) return "booking_type required";
  if (!p.ticket_issue_date || !p.ticket_end_date) return "ticket dates required";
  if (!Array.isArray(p.travelers) || p.travelers.length === 0) return "At least one traveler required";
  if (!Array.isArray(p.legs) || p.legs.length === 0) return "At least one itinerary section required";
  for (const l of p.legs) {
    if (!l.label) return "Each section needs a label";
    if (!Array.isArray(l.segments) || l.segments.length === 0) return "Each section needs at least one segment";
    for (const s of l.segments) {
      if (!s.dep_airport || !s.arr_airport) return "Segments need dep/arr airports";
      if (!s.dep_date || !s.arr_date || !s.dep_time || !s.arr_time) return "Segments need dates/times";
    }
  }
  return null;
}

function buildLayovers(segments: Payload["legs"][number]["segments"]) {
  const lays: Array<{ between_index: number; airport: string; minutes: number }> = [];
  const segs = [...segments].sort((a,b) => a.sort_index - b.sort_index);
  for (let i=0;i<segs.length-1;i++) {
    const a = segs[i];
    const b = segs[i+1];
    const airport = upperIata(a.arr_airport);
    if (airport !== upperIata(b.dep_airport)) continue;
    const mins = minutesBetween(localIso(a.arr_date, a.arr_time), localIso(b.dep_date, b.dep_time));
    lays.push({ between_index: i, airport, minutes: mins });
  }
  return lays;
}

export const onRequestPost: PagesFunction = async (ctx) => {
  const p = await readJson<Payload>(ctx.request);
  const msg = validate(p);
  if (msg) return err(msg);

  const booking_id = uid();
  const created_at = nowISO();
  const updated_at = created_at;

  const db = ctx.env.DB;
  await db.prepare(
    "INSERT INTO bookings (id, booking_type, pnr, class_main, class_secondary, ticket_issue_date, ticket_end_date, cost_note, trip_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
  ).bind(
    booking_id,
    p.booking_type,
    (p.pnr || "").trim(),
    (p.class_main || "").trim(),
    p.class_secondary ?? null,
    p.ticket_issue_date,
    p.ticket_end_date,
    p.cost_note ?? null,
    p.trip_id || null,
    created_at,
    updated_at
  ).run();

  for (const t of p.travelers) {
    const cost = t.cost;
    if (cost.payment_type === "cash") {
      await db.prepare(
        "INSERT INTO booking_travelers (booking_id, traveler_id, status, payment_type, cash_usd) VALUES (?, ?, 'active', 'cash', ?)"
      ).bind(booking_id, t.traveler_id, cost.cash_usd).run();
    } else {
      await db.prepare(
        "INSERT INTO booking_travelers (booking_id, traveler_id, status, payment_type, miles_used, fees_usd) VALUES (?, ?, 'active', 'miles', ?, ?)"
      ).bind(booking_id, t.traveler_id, cost.miles_used, cost.fees_usd).run();
    }
  }

  for (let li=0; li<p.legs.length; li++) {
    const l = p.legs[li];
    const leg_id = uid();
    await db.prepare(
      "INSERT INTO legs (id, booking_id, kind, label, sort_index) VALUES (?, ?, ?, ?, ?)"
    ).bind(leg_id, booking_id, l.kind, l.label, li).run();

    const segs = [...l.segments].sort((a,b) => a.sort_index - b.sort_index);
    for (const s of segs) {
      await db.prepare(
        "INSERT INTO segments (id, leg_id, sort_index, flight_number, airline, dep_airport, arr_airport, dep_date, dep_time, arr_date, arr_time) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
      ).bind(
        uid(),
        leg_id,
        s.sort_index,
        (s.flight_number || "").trim(),
        (s.airline || "").trim(),
        upperIata(s.dep_airport),
        upperIata(s.arr_airport),
        s.dep_date,
        s.dep_time,
        s.arr_date,
        s.arr_time
      ).run();
    }

    const lays = buildLayovers(segs);
    for (const lay of lays) {
      await db.prepare(
        "INSERT INTO layovers (id, leg_id, between_index, airport, minutes, overridden) VALUES (?, ?, ?, ?, ?, 0)"
      ).bind(uid(), leg_id, lay.between_index, lay.airport, lay.minutes).run();
    }
  }

  const full = await loadBooking(db, booking_id);
  return json(full, { status: 201 });
};

export const onRequestGet: PagesFunction = async () => err("Use /api/bookings/cards or /api/bookings/:id", 400);
