import React, { useEffect, useMemo, useState } from "react";
import { Bookings } from "./pages/Bookings";
import { Admin } from "./pages/Admin";
import { Button } from "./components/Button";
import { SharedSummary } from "./pages/SharedSummary";

type Route = "bookings" | "admin" | "summary";

function currentRoute(): { route: Route; slug: string } {
  const hash = (window.location.hash || "#/bookings").replace("#/", "");
  if (hash.startsWith("summary/")) return { route: "summary", slug: hash.slice("summary/".length) };
  return { route: hash === "admin" ? "admin" : "bookings", slug: "" };
}

export default function App() {
  const [location, setLocation] = useState(currentRoute);

  useEffect(() => {
    const onHashChange = () => setLocation(currentRoute());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  function nav(to: "bookings" | "admin") {
    setLocation({ route: to, slug: "" });
    window.location.hash = `#/${to}`;
  }

  const title = useMemo(() => location.route === "bookings" ? "Bookings" : location.route === "admin" ? "Admin" : "Shared summary", [location.route]);

  return (
    <div className="min-h-screen bg-board-bg text-slate-100">
      <header className="sticky top-0 z-40 backdrop-blur bg-board-bg/70 border-b border-white/10">
        <div className="mx-auto max-w-6xl px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-sky-500/15 border border-sky-400/20 flex items-center justify-center font-mono text-sky-200">
              ✈
            </div>
            <div>
              <div className="font-semibold tracking-wide">Family Travel Tracker</div>
              <div className="text-xs font-mono text-slate-400">Departure-board style dashboard</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button size="sm" variant={location.route === "bookings" ? "primary" : "ghost"} onClick={() => nav("bookings")}>Bookings</Button>
            <Button size="sm" variant={location.route === "admin" ? "primary" : "ghost"} onClick={() => nav("admin")}>Admin</Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">
        <div className="mb-4 text-xs font-mono text-slate-500">{title}</div>
        {location.route === "bookings" ? <Bookings /> : location.route === "admin" ? <Admin /> : <SharedSummary slug={location.slug} />}
      </main>

      <footer className="mx-auto max-w-6xl px-4 py-8 text-xs font-mono text-slate-500">
        Data is stored in Cloudflare D1 via Pages Functions.
      </footer>
    </div>
  );
}
