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
  segments: Segment[];
  segment_index: number;
  layover_minutes?: number;
  is_tight_connection: boolean;
  route_label: string;
  display_route: string;
};

export function eventColor(color?: string | null): string {
  return ({ sky: "#38bdf8", emerald: "#34d399", violet: "#a78bfa", amber: "#fbbf24", rose: "#fb7185", cyan: "#22d3ee", lime: "#a3e635", orange: "#fb923c" } as Record<string, string>)[color || ""] || "#38bdf8";
}

function sortSegments(segments: Segment[]): Segment[] {
  return [...segments].sort((a, b) => {
    const byTime = `${a.dep_date}T${a.dep_time}`.localeCompare(`${b.dep_date}T${b.dep_time}`);
    return byTime || a.sort_index - b.sort_index;
  });
}

function routeLabel(segments: Segment[]): string {
  if (segments.length === 0) return "—";
  return [segments[0].dep_airport, ...segments.map(segment => segment.arr_airport)].join(" → ");
}

function isConnected(previous: Segment, next: Segment): boolean {
  return previous.arr_airport === next.dep_airport;
}

function connectedJourneys(segments: Segment[]): Segment[][] {
  const sorted = sortSegments(segments);
  const journeys: Segment[][] = [];
  for (const segment of sorted) {
    const current = journeys[journeys.length - 1];
    if (!current || !isConnected(current[current.length - 1], segment)) {
      journeys.push([segment]);
    } else {
      current.push(segment);
    }
  }
  return journeys;
}

function displayGroups(segments: Segment[]): Array<{ segments: Segment[]; route_label: string }> {
  return connectedJourneys(segments).flatMap(journey => {
    const fullRoute = routeLabel(journey);
    const groups: Segment[][] = [];
    for (const segment of journey) {
      const current = groups[groups.length - 1];
      if (!current || current[0].dep_date !== segment.dep_date) {
        groups.push([segment]);
      } else {
        current.push(segment);
      }
    }
    return groups.map(segments => ({ segments, route_label: fullRoute }));
  });
}

function layoverFor(card: BookingCard, segmentIndex: number): number | undefined {
  return card.layovers.find(lay => lay.between_index === segmentIndex - 1)?.minutes;
}

function makeEvent(card: BookingCard, segments: Segment[], route_label = routeLabel(segments)): FlightEvent {
  const first = segments[0];
  const firstIndex = card.segments.findIndex(segment => segment.id === first.id);
  const layover_minutes = layoverFor(card, firstIndex);
  return {
    id: `${card.booking_id}:${card.traveler_id}:${segments.map(segment => segment.id).join("+")}`,
    booking_id: card.booking_id,
    traveler_id: card.traveler_id,
    traveler_name: card.traveler_name,
    traveler_color: card.traveler_color,
    traveler_status: card.traveler_status,
    trip_name: card.trip_name,
    label: card.label,
    segment: first,
    segments,
    segment_index: firstIndex,
    layover_minutes,
    is_tight_connection: layover_minutes !== undefined && layover_minutes < 90,
    route_label,
    display_route: routeLabel(segments),
  };
}

function sortEvents(events: FlightEvent[]): FlightEvent[] {
  return events.sort((a, b) => `${a.segment.dep_date}T${a.segment.dep_time}`.localeCompare(`${b.segment.dep_date}T${b.segment.dep_time}`));
}

export function flightEvents(cards: BookingCard[], includeCanceled = false): FlightEvent[] {
  return groupedFlightEvents(cards, includeCanceled);
}

export function groupedFlightEvents(cards: BookingCard[], includeCanceled = false): FlightEvent[] {
  return sortEvents(cards
    .filter(card => includeCanceled || card.traveler_status !== "canceled")
    .flatMap(card => displayGroups(card.segments).map(group => makeEvent(card, group.segments, group.route_label))));
}

export function pickupDropoffEvents(cards: BookingCard[], includeCanceled = false): FlightEvent[] {
  return sortEvents(cards
    .filter(card => includeCanceled || card.traveler_status !== "canceled")
    .flatMap(card => connectedJourneys(card.segments).map(journey => makeEvent(card, journey, routeLabel(journey)))));
}
