import type { BookingCard, Segment } from "../types";

export type FlightEvent = {
  id: string;
  booking_id: string;
  traveler_id: string;
  traveler_name: string;
  traveler_color?: string | null;
  traveler_status: string;
  trip_name?: string | null;
  label: string;
  segment: Segment;
  segment_index: number;
  layover_minutes?: number;
  is_tight_connection: boolean;
};

export function eventColor(color?: string | null): string {
  return ({ sky: "#38bdf8", emerald: "#34d399", violet: "#a78bfa", amber: "#fbbf24", rose: "#fb7185", cyan: "#22d3ee", lime: "#a3e635", orange: "#fb923c" } as Record<string, string>)[color || ""] || "#38bdf8";
}

export function flightEvents(cards: BookingCard[], includeCanceled = false): FlightEvent[] {
  return cards
    .filter(card => includeCanceled || card.traveler_status !== "canceled")
    .flatMap(card => card.segments.map((segment, index) => {
      const layover = card.layovers.find(lay => lay.between_index === index - 1);
      const layover_minutes = layover?.minutes;
      return {
        id: `${card.booking_id}:${card.traveler_id}:${segment.id}`,
        booking_id: card.booking_id,
        traveler_id: card.traveler_id,
        traveler_name: card.traveler_name,
        traveler_color: card.traveler_color,
        traveler_status: card.traveler_status,
        trip_name: card.trip_name,
        label: card.label,
        segment,
        segment_index: index,
        layover_minutes,
        is_tight_connection: layover_minutes !== undefined && layover_minutes < 90,
      };
    }))
    .sort((a, b) => `${a.segment.dep_date}T${a.segment.dep_time}`.localeCompare(`${b.segment.dep_date}T${b.segment.dep_time}`));
}
