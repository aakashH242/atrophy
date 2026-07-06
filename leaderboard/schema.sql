CREATE TABLE IF NOT EXISTS entries (
  token TEXT PRIMARY KEY,
  handle TEXT NOT NULL UNIQUE COLLATE NOCASE,
  overall REAL NOT NULL,
  reps INTEGER NOT NULL,
  axes TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_entries_overall ON entries(overall DESC);
