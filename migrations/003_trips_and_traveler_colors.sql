CREATE TABLE IF NOT EXISTS trips (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL
);

ALTER TABLE travelers ADD COLUMN color TEXT;
ALTER TABLE bookings ADD COLUMN trip_id TEXT REFERENCES trips(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_bookings_trip ON bookings(trip_id);
