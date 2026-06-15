import type { ApiError, Booking, BookingCard, SharedSummary, SharedSummaryRow, Traveler } from "../types";

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    let msg = res.statusText;
    try {
      const data = (await res.json()) as ApiError;
      msg = data.error ?? msg;
    } catch {}
    throw new Error(msg);
  }
  return (await res.json()) as T;
}

export const api = {
  travelers: {
    list: () => req<Traveler[]>("/api/travelers"),
    create: (name: string) => req<Traveler>("/api/travelers", { method: "POST", body: JSON.stringify({ name }) }),
    update: (id: string, name: string) => req<Traveler>(`/api/travelers/${id}`, { method: "PUT", body: JSON.stringify({ name }) }),
    remove: (id: string) => req<{ ok: true }>(`/api/travelers/${id}`, { method: "DELETE" }),
  },
  bookings: {
    // returns cards already split per traveler per leg
    listCards: (opts: { travelerId?: string; includeFlown?: boolean } = {}) => {
      const u = new URL("/api/bookings/cards", window.location.origin);
      if (opts.travelerId) u.searchParams.set("travelerId", opts.travelerId);
      if (opts.includeFlown) u.searchParams.set("includeFlown", "1");
      return req<BookingCard[]>(u.pathname + u.search);
    },
    get: (id: string) => req<Booking>(`/api/bookings/${id}`),
    create: (payload: unknown) => req<Booking>(`/api/bookings`, { method: "POST", body: JSON.stringify(payload) }),
    update: (id: string, payload: unknown) => req<Booking>(`/api/bookings/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
    remove: (id: string) => req<{ ok: true }>(`/api/bookings/${id}`, { method: "DELETE" }),
    setTravelerStatus: (bookingId: string, travelerId: string, payload: unknown) =>
      req<{ ok: true }>(`/api/bookings/${bookingId}/traveler/${travelerId}`, { method: "PUT", body: JSON.stringify(payload) }),
  },
  summaries: {
    get: (slug: string) => req<SharedSummary>(`/api/summaries/${encodeURIComponent(slug)}`),
    create: (slug: string, rows: SharedSummaryRow[]) =>
      req<SharedSummary>("/api/summaries", { method: "POST", body: JSON.stringify({ slug, rows }) }),
  },
};
