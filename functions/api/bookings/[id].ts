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

export const onRequestGet: PagesFunction = async (ctx) => {
  const id = ctx.params.id as string;
  const booking = await loadBooking(ctx.env.DB, id);
  if (!booking) return err("Booking not found.", 404);
  return json(booking);
};

export const onRequestDelete: PagesFunction = async (ctx) => {
  const id = ctx.params.id as string;
  await ctx.env.DB.prepare("DELETE FROM bookings WHERE id = ?").bind(id).run();
  return json({ ok: true });
};

export const onRequestPut: PagesFunction = async (ctx) => {
  const id = ctx.params.id as string;
  const p = await readJson<Payload>(ctx.request);
  const msg = validate(p);
  if (msg) return err(msg);

  const db = ctx.env.DB;

  const exists = await db.prepare("SELECT id FROM bookings WHERE id = ?").bind(id).first();
  if (!exists) return err("Booking not found.", 404);

  const updated_at = nowISO();

  await db.prepare(
    "UPDATE bookings SET booking_type=?, pnr=?, class_main=?, class_secondary=?, ticket_issue_date=?, ticket_end_date=?, cost_note=?, trip_id=?, updated_at=? WHERE id=?"
  ).bind(
    p.booking_type,
    (p.pnr || "").trim(),
    (p.class_main || "").trim(),
    p.class_secondary ?? null,
    p.ticket_issue_date,
    p.ticket_end_date,
    p.cost_note ?? null,
    p.trip_id || null,
    updated_at,
    id
  ).run();

  // Upsert travelers, preserving status/refund if traveler already exists on booking.
  const current = await db.prepare(
    "SELECT traveler_id, status, refund_method, refund_amount_usd, refund_notes, canceled_at FROM booking_travelers WHERE booking_id = ?"
  ).bind(id).all<any>();
  const currentMap = new Map<string, any>();
  for (const r of current.results) currentMap.set(r.traveler_id, r);

  const keepIds = new Set<string>(p.travelers.map(t => t.traveler_id));
  // delete removed
  await db.prepare(
    `DELETE FROM booking_travelers WHERE booking_id = ? AND traveler_id NOT IN (${Array.from(keepIds).map(()=>"?").join(",") || "''"})`
  ).bind(id, ...Array.from(keepIds)).run();

  // upsert selected
  for (const t of p.travelers) {
    const prior = currentMap.get(t.traveler_id);
    const status = prior?.status ?? "active";
    const refund_method = prior?.refund_method ?? null;
    const refund_amount_usd = prior?.refund_amount_usd ?? null;
    const refund_notes = prior?.refund_notes ?? null;
    const canceled_at = prior?.canceled_at ?? null;

    const cost = t.cost;
    if (cost.payment_type === "cash") {
      await db.prepare(
        `INSERT INTO booking_travelers (booking_id, traveler_id, status, payment_type, cash_usd, miles_used, fees_usd, refund_method, refund_amount_usd, refund_notes, canceled_at)
         VALUES (?, ?, ?, 'cash', ?, NULL, NULL, ?, ?, ?, ?)
         ON CONFLICT(booking_id, traveler_id) DO UPDATE SET
           payment_type='cash', cash_usd=excluded.cash_usd, miles_used=NULL, fees_usd=NULL`
      ).bind(id, t.traveler_id, status, cost.cash_usd, refund_method, refund_amount_usd, refund_notes, canceled_at).run();
    } else {
      await db.prepare(
        `INSERT INTO booking_travelers (booking_id, traveler_id, status, payment_type, cash_usd, miles_used, fees_usd, refund_method, refund_amount_usd, refund_notes, canceled_at)
         VALUES (?, ?, ?, 'miles', NULL, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(booking_id, traveler_id) DO UPDATE SET
           payment_type='miles', cash_usd=NULL, miles_used=excluded.miles_used, fees_usd=excluded.fees_usd`
      ).bind(id, t.traveler_id, status, cost.miles_used, cost.fees_usd, refund_method, refund_amount_usd, refund_notes, canceled_at).run();
    }
  }

  // Replace legs (cascade deletes segments/layovers)
  await db.prepare("DELETE FROM legs WHERE booking_id = ?").bind(id).run();

  for (let li=0; li<p.legs.length; li++) {
    const l = p.legs[li];
    const leg_id = uid();
    await db.prepare("INSERT INTO legs (id, booking_id, kind, label, sort_index) VALUES (?, ?, ?, ?, ?)")
      .bind(leg_id, id, l.kind, l.label, li).run();

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
      await db.prepare("INSERT INTO layovers (id, leg_id, between_index, airport, minutes, overridden) VALUES (?, ?, ?, ?, ?, 0)")
        .bind(uid(), leg_id, lay.between_index, lay.airport, lay.minutes).run();
    }
  }

  const full = await loadBooking(db, id);
  return json(full);
};
