# Family Travel Tracker (Cloudflare Pages + D1)

A sleek, dark-mode family travel tracker with a departure-board vibe.

**What you get**
- Add/edit bookings via a modal
- Booking types:
  - One-way (Outbound only)
  - Roundtrip (Outbound + Return)
  - Multicity (Leg 1 / Leg 2 / Leg 3…)
- Multiple segments per section/leg, all kept in **one card**
- Multi-traveler booking entry, stored **individually per traveler**
- Cancel/refund per traveler (does **not** hide the card)
- List view (accordion cards) + Calendar month view
- Upcoming vs All Trips toggle
- Traveler filter
- Travelers admin page (no login)

## Tech
- Frontend: Vite + React + TypeScript + Tailwind
- Backend: Cloudflare Pages Functions
- Database: Cloudflare D1 (SQLite)

---

## Local dev (frontend only)
You can run the UI locally, but the API endpoints will need the Cloudflare dev environment:

```bash
npm install
npm run dev
```

For full-stack local dev, use Wrangler Pages dev (recommended).

---

## Cloudflare setup (D1 + Pages)

### 1) Create the D1 database
Install Wrangler (if you don’t have it):

```bash
npm i -g wrangler
wrangler login
```

Create the DB:

```bash
wrangler d1 create family-travel-tracker
```

Wrangler will output a `database_id`. Put it into `wrangler.toml`:

```toml
[[d1_databases]]
binding = "DB"
database_name = "family-travel-tracker"
database_id = "PASTE_YOUR_DATABASE_ID_HERE"
```

### 2) Run the migration
```bash
wrangler d1 execute family-travel-tracker --file=migrations/001_init.sql
wrangler d1 execute family-travel-tracker --file=migrations/002_shared_summaries.sql
wrangler d1 execute family-travel-tracker --file=migrations/003_trips_and_traveler_colors.sql
```

### 3) Deploy on Cloudflare Pages via GitHub
1. Create a new GitHub repo and upload this project.
2. In Cloudflare Dashboard → **Pages** → **Create a project** → connect the repo.
3. Build settings:
   - **Framework preset:** Vite
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
4. Add the D1 binding:
   - Pages Project → **Settings** → **Functions** → **D1 database bindings**
   - Binding name must be: `DB`
   - Select the database: `family-travel-tracker`

Deploy. Your app will be live.

---

## Notes / assumptions
- Times are stored as the scheduled local times you enter.
- Layovers are auto-calculated using arrival→next departure times at the same airport (no timezone lookup required).
- “Flown” is determined client-side by comparing the last segment arrival date/time against the viewer’s current time.
  - This is usually fine for a family tracker; if you want fully timezone-accurate flown logic later, we can add an airport→timezone map.

---

## File structure
- `src/` React app
- `functions/` Cloudflare Pages Functions (API)
- `migrations/` D1 schema
