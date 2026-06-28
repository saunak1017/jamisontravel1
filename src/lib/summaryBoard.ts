import { format } from "date-fns";
import type { SharedSummaryRow } from "../types";

export type SummaryFlightGroup = {
  key: string;
  dep_date: string;
  dep_time: string;
  flight_number: string;
  airline: string;
  dep_airport: string;
  arr_airport: string;
  arr_date: string;
  arr_time: string;
  rows: SharedSummaryRow[];
};

export type SummaryDateGroup = {
  date: string;
  label: string;
  flights: SummaryFlightGroup[];
};

function normalized(value: string | null | undefined): string {
  return (value || "").trim().toUpperCase();
}

function sortValue(value: string | null | undefined): string {
  const trimmed = (value || "").trim();
  return trimmed || "~~~~";
}

function flightGroupKey(row: SharedSummaryRow): string {
  return [
    normalized(row.dep_date),
    normalized(row.flight_number),
    normalized(row.dep_airport),
    normalized(row.arr_airport),
    normalized(row.dep_time),
  ].join("|");
}

function dateLabel(date: string): string {
  if (!date) return "DATE TBD";
  return format(new Date(`${date}T00:00:00`), "EEE, MMM d, yyyy").toUpperCase();
}

function compareFlights(a: SummaryFlightGroup, b: SummaryFlightGroup): number {
  return `${sortValue(a.dep_date)}T${sortValue(a.dep_time)}:${sortValue(a.flight_number)}:${sortValue(a.dep_airport)}:${sortValue(a.arr_airport)}`
    .localeCompare(`${sortValue(b.dep_date)}T${sortValue(b.dep_time)}:${sortValue(b.flight_number)}:${sortValue(b.dep_airport)}:${sortValue(b.arr_airport)}`);
}

export function groupSummaryRows(rows: SharedSummaryRow[]): SummaryDateGroup[] {
  const flightMap = new Map<string, SummaryFlightGroup>();

  rows.forEach(row => {
    const key = flightGroupKey(row);
    const existing = flightMap.get(key);
    if (existing) {
      existing.rows.push(row);
      return;
    }

    flightMap.set(key, {
      key,
      dep_date: row.dep_date,
      dep_time: row.dep_time,
      flight_number: row.flight_number,
      airline: row.airline,
      dep_airport: row.dep_airport,
      arr_airport: row.arr_airport,
      arr_date: row.arr_date,
      arr_time: row.arr_time,
      rows: [row],
    });
  });

  const dateMap = new Map<string, SummaryFlightGroup[]>();
  [...flightMap.values()].sort(compareFlights).forEach(group => {
    const date = group.dep_date || "";
    dateMap.set(date, [...(dateMap.get(date) || []), group]);
  });

  return [...dateMap.entries()]
    .sort(([a], [b]) => sortValue(a).localeCompare(sortValue(b)))
    .map(([date, flights]) => ({
      date,
      label: dateLabel(date),
      flights,
    }));
}

export function flightDisplay(group: Pick<SummaryFlightGroup, "flight_number" | "airline">): string {
  const flight = group.flight_number || "FLIGHT TBD";
  return group.airline ? `${flight} - ${group.airline}` : flight;
}

export function timeDisplay(time: string): string {
  return time || "--:--";
}

export function airportDisplay(airport: string): string {
  return airport || "---";
}
