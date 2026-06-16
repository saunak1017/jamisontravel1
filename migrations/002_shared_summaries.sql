CREATE TABLE IF NOT EXISTS shared_summaries (
  slug TEXT PRIMARY KEY COLLATE NOCASE,
  rows_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);
