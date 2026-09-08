ALTER TABLE cash_entries ADD COLUMN actual_date TEXT CHECK (
  actual_date IS NULL OR actual_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'
);

ALTER TABLE workspaces ADD COLUMN tax_reserve_mode TEXT NOT NULL DEFAULT 'fixed'
  CHECK (tax_reserve_mode IN ('fixed', 'percentage'));
ALTER TABLE workspaces ADD COLUMN tax_rate_basis_points INTEGER NOT NULL DEFAULT 0
  CHECK (tax_rate_basis_points BETWEEN 0 AND 10000);
ALTER TABLE workspaces ADD COLUMN payment_delay_days INTEGER NOT NULL DEFAULT 0
  CHECK (payment_delay_days BETWEEN 0 AND 365);

CREATE TABLE follow_ups (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  cash_entry_id TEXT NOT NULL REFERENCES cash_entries(id) ON DELETE CASCADE,
  tone TEXT NOT NULL CHECK (tone IN ('friendly', 'direct', 'final')),
  message TEXT NOT NULL CHECK (LENGTH(message) BETWEEN 1 AND 2000),
  completed_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX follow_ups_workspace_entry_idx ON follow_ups(workspace_id, cash_entry_id, completed_at DESC);

CREATE TABLE weekly_reviews (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  summary TEXT NOT NULL CHECK (LENGTH(summary) <= 1000),
  completed_at INTEGER NOT NULL
);

CREATE INDEX weekly_reviews_workspace_completed_idx ON weekly_reviews(workspace_id, completed_at DESC);
