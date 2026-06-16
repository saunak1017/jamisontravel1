import { flightNumbersFromSegments, routeSummaryFromSegments, upperIata } from "../../_utils";

export async function loadBooking(db: D1Database, bookingId: string) {
  const booking = await db.prepare(
    `SELECT b.*, tr.name as trip_name
       FROM bookings b
       LEFT JOIN trips tr ON tr.id = b.trip_id
      WHERE b.id = ?`
  ).bind(bookingId).first<any>();

  if (!booking) return null;

  const travelers = await db.prepare(
    `SELECT bt.traveler_id, t.name as traveler_name, t.color as traveler_color, bt.status, bt.payment_type, bt.cash_usd, bt.miles_used, bt.fees_usd,
            bt.refund_method, bt.refund_amount_usd, bt.refund_notes, bt.canceled_at
       FROM booking_travelers bt
       LEFT JOIN travelers t ON t.id = bt.traveler_id
      WHERE bt.booking_id = ?
      ORDER BY t.name COLLATE NOCASE`
  ).bind(bookingId).all<any>();

  const legsRows = await db.prepare(
    "SELECT * FROM legs WHERE booking_id = ? ORDER BY sort_index"
  ).bind(bookingId).all<any>();

  const legs = [];
  for (const leg of legsRows.results) {
    const segRows = await db.prepare(
      "SELECT * FROM segments WHERE leg_id = ? ORDER BY sort_index"
    ).bind(leg.id).all<any>();

    const layRows = await db.prepare(
      "SELECT * FROM layovers WHERE leg_id = ? ORDER BY between_index"
    ).bind(leg.id).all<any>();

    const segs = segRows.results.map((s: any) => ({
      id: s.id,
      leg_id: s.leg_id,
      sort_index: s.sort_index,
      flight_number: s.flight_number,
      airline: s.airline,
      dep_airport: upperIata(s.dep_airport),
      arr_airport: upperIata(s.arr_airport),
      dep_date: s.dep_date,
      dep_time: s.dep_time,
      arr_date: s.arr_date,
      arr_time: s.arr_time,
    }));

    const start_date = segs[0]?.dep_date ?? booking.ticket_issue_date;
    legs.push({
      id: leg.id,
      booking_id: bookingId,
      kind: leg.kind,
      label: leg.label,
      start_date,
      route_summary: routeSummaryFromSegments(segs),
      flight_numbers: flightNumbersFromSegments(segs),
      segments: segs,
      layovers: layRows.results.map((l: any) => ({
        id: l.id,
        leg_id: l.leg_id,
        between_index: l.between_index,
        airport: upperIata(l.airport),
        minutes: l.minutes,
        overridden: l.overridden,
      })),
    });
  }

  const travelersOut = travelers.results.map((r: any) => {
    const cost = r.payment_type === "cash"
      ? { payment_type: "cash", cash_usd: Number(r.cash_usd ?? 0) }
      : { payment_type: "miles", miles_used: Number(r.miles_used ?? 0), fees_usd: Number(r.fees_usd ?? 0) };

    const refund = r.refund_method ? {
      method: r.refund_method,
      amount_usd: Number(r.refund_amount_usd ?? 0),
      notes: r.refund_notes ?? undefined,
    } : null;

    return {
      traveler_id: r.traveler_id,
      traveler_name: r.traveler_name ?? "(unknown)",
      traveler_color: r.traveler_color ?? null,
      status: r.status,
      cost,
      refund,
      canceled_at: r.canceled_at ?? null,
    };
  });

  return {
    id: booking.id,
    booking_type: booking.booking_type,
    trip_id: booking.trip_id ?? null,
    trip_name: booking.trip_name ?? null,
    pnr: booking.pnr,
    class_main: booking.class_main,
    class_secondary: booking.class_secondary,
    ticket_issue_date: booking.ticket_issue_date,
    ticket_end_date: booking.ticket_end_date,
    cost_note: booking.cost_note,
    created_at: booking.created_at,
    updated_at: booking.updated_at,
    travelers: travelersOut,
    legs,
  };
}

export async function loadCards(db: D1Database, opts: { travelerId?: string; includeFlown?: boolean }) {
  // We return all cards (client can filter flown); includeFlown is kept for future but not used server-side right now.
  const args: any[] = [];
  let where = "1=1";
  if (opts.travelerId) {
    where += " AND bt.traveler_id = ?";
    args.push(opts.travelerId);
  }

  const rows = await db.prepare(
    `SELECT b.id as booking_id, b.booking_type, b.trip_id, tr.name as trip_name, b.pnr, b.class_main, b.class_secondary, b.ticket_issue_date, b.ticket_end_date, b.updated_at,
            bt.traveler_id, t.name as traveler_name, t.color as traveler_color, bt.status as traveler_status,
            bt.payment_type, bt.cash_usd, bt.miles_used, bt.fees_usd,
            bt.refund_method, bt.refund_amount_usd, bt.refund_notes,
            l.id as leg_id, l.kind, l.label, l.sort_index as leg_sort
       FROM bookings b
       JOIN booking_travelers bt ON bt.booking_id = b.id
       LEFT JOIN travelers t ON t.id = bt.traveler_id
       LEFT JOIN trips tr ON tr.id = b.trip_id
       JOIN legs l ON l.booking_id = b.id
      WHERE ${where}
      ORDER BY b.updated_at DESC, t.name COLLATE NOCASE, l.sort_index`
  ).bind(...args).all<any>();

  // We need segments+layovers for each leg. We'll batch fetch by unique leg_id.
  const legIds = Array.from(new Set(rows.results.map((r:any)=>r.leg_id)));
  const segByLeg = new Map<string, any[]>();
  const layByLeg = new Map<string, any[]>();

  for (const legId of legIds) {
    const segs = await db.prepare("SELECT * FROM segments WHERE leg_id = ? ORDER BY sort_index").bind(legId).all<any>();
    segByLeg.set(legId, segs.results.map((s:any)=>({
      id: s.id,
      leg_id: s.leg_id,
      sort_index: s.sort_index,
      flight_number: s.flight_number,
      airline: s.airline,
      dep_airport: upperIata(s.dep_airport),
      arr_airport: upperIata(s.arr_airport),
      dep_date: s.dep_date,
      dep_time: s.dep_time,
      arr_date: s.arr_date,
      arr_time: s.arr_time,
    })));

    const lays = await db.prepare("SELECT * FROM layovers WHERE leg_id = ? ORDER BY between_index").bind(legId).all<any>();
    layByLeg.set(legId, lays.results.map((l:any)=>({
      id: l.id,
      leg_id: l.leg_id,
      between_index: l.between_index,
      airport: upperIata(l.airport),
      minutes: l.minutes,
      overridden: l.overridden,
    })));
  }

  const out = [];
  for (const r of rows.results) {
    const segs = segByLeg.get(r.leg_id) ?? [];
    const lays = layByLeg.get(r.leg_id) ?? [];
    const start_date = segs[0]?.dep_date ?? r.ticket_issue_date;

    const cost = r.payment_type === "cash"
      ? { payment_type: "cash", cash_usd: Number(r.cash_usd ?? 0) }
      : { payment_type: "miles", miles_used: Number(r.miles_used ?? 0), fees_usd: Number(r.fees_usd ?? 0) };

    const refund = r.refund_method ? {
      method: r.refund_method,
      amount_usd: Number(r.refund_amount_usd ?? 0),
      notes: r.refund_notes ?? undefined,
    } : null;

    out.push({
      booking_id: r.booking_id,
      traveler_id: r.traveler_id,
      traveler_name: r.traveler_name ?? "(unknown)",
      traveler_color: r.traveler_color ?? null,
      traveler_status: r.traveler_status,
      trip_id: r.trip_id ?? null,
      trip_name: r.trip_name ?? null,
      cost,
      refund,
      kind: r.kind,
      label: r.label,
      start_date,
      route_summary: routeSummaryFromSegments(segs),
      flight_numbers: flightNumbersFromSegments(segs),
      segments: segs,
      layovers: lays,
      pnr: r.pnr,
      booking_type: r.booking_type,
      class_main: r.class_main,
      class_secondary: r.class_secondary,
      ticket_issue_date: r.ticket_issue_date,
      ticket_end_date: r.ticket_end_date,
      updated_at: r.updated_at,
    });
  }
  // Sort by start_date asc to match UI default
  out.sort((a:any,b:any)=>a.start_date.localeCompare(b.start_date));
  return out;
}
