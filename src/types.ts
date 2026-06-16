export type BookingType = "oneway" | "roundtrip" | "multicity";
export type PaymentType = "cash" | "miles";
export type TravelerStatus = "active" | "canceled";

export type Traveler = {
  id: string;
  name: string;
  color?: string | null;
  created_at: string;
};

export type Trip = {
  id: string;
  name: string;
  created_at: string;
};

export type Money = {
  amount: number; // USD
};

export type TravelerCost =
  | { payment_type: "cash"; cash_usd: number }
  | { payment_type: "miles"; miles_used: number; fees_usd: number };

export type RefundInfo = {
  method: "eCredit" | "RefundToCard" | "Other";
  amount_usd: number;
  notes?: string;
};

export type Segment = {
  id: string;
  leg_id: string;
  sort_index: number;
  flight_number: string;
  airline: string;
  dep_airport: string;
  arr_airport: string;
  dep_date: string; // YYYY-MM-DD
  dep_time: string; // HH:MM (24h)
  arr_date: string; // YYYY-MM-DD
  arr_time: string; // HH:MM (24h)
};

export type Layover = {
  id: string;
  leg_id: string;
  between_index: number; // layover between segment i and i+1
  airport: string;
  minutes: number;
  overridden: 0 | 1;
};

export type LegKind = "outbound" | "return" | "leg";

export type Leg = {
  id: string;
  booking_id: string;
  kind: LegKind;
  label: string; // "Outbound" | "Return" | "Leg 1" ...
  start_date: string; // derived: first segment dep_date
  route_summary: string; // "JFK→LHR→BOM"
  flight_numbers: string; // "VS10/VS358"
  segments: Segment[];
  layovers: Layover[];
};

export type Booking = {
  id: string;
  booking_type: BookingType;
  pnr: string;
  class_main: string;
  class_secondary?: string | null;
  ticket_issue_date: string; // YYYY-MM-DD
  ticket_end_date: string; // YYYY-MM-DD
  cost_note?: string | null; // optional free text for anything else
  trip_id?: string | null;
  trip_name?: string | null;
  created_at: string;
  updated_at: string;
  travelers: Array<{
    traveler_id: string;
    traveler_name: string;
    status: TravelerStatus;
    cost: TravelerCost;
    refund?: RefundInfo | null;
    canceled_at?: string | null;
  }>;
  legs: Leg[];
};

export type BookingCard = {
  booking_id: string;
  traveler_id: string;
  traveler_name: string;
  traveler_color?: string | null;
  traveler_status: TravelerStatus;
  trip_id?: string | null;
  trip_name?: string | null;
  cost: TravelerCost;
  refund?: RefundInfo | null;
  kind: LegKind;
  label: string;
  start_date: string; // for sorting/calendar
  route_summary: string;
  flight_numbers: string;
  segments: Segment[];
  layovers: Layover[];
  pnr: string;
  booking_type: BookingType;
  class_main: string;
  class_secondary?: string | null;
  ticket_issue_date: string;
  ticket_end_date: string;
  updated_at: string;
};

export type ApiError = { error: string };

export type SharedSummaryRow = {
  passenger: string;
  trip_name?: string | null;
  flight_number: string;
  airline: string;
  dep_airport: string;
  arr_airport: string;
  dep_date: string;
  dep_time: string;
  arr_date: string;
  arr_time: string;
};

export type SharedSummary = {
  slug: string;
  rows: SharedSummaryRow[];
  created_at: string;
};
