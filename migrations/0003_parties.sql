CREATE TABLE parties (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (LENGTH(name) BETWEEN 1 AND 120),
  role TEXT NOT NULL CHECK (role IN ('customer', 'supplier', 'both')),
  email TEXT CHECK (email IS NULL OR LENGTH(email) <= 254),
  phone TEXT CHECK (phone IS NULL OR LENGTH(phone) <= 40),
  notes TEXT CHECK (notes IS NULL OR LENGTH(notes) <= 500),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX parties_workspace_name_idx ON parties(workspace_id, name COLLATE NOCASE);

ALTER TABLE cash_entries ADD COLUMN party_id TEXT REFERENCES parties(id) ON DELETE SET NULL;
ALTER TABLE cash_entries ADD COLUMN party_name TEXT CHECK (party_name IS NULL OR LENGTH(party_name) <= 120);

CREATE INDEX cash_entries_workspace_party_idx ON cash_entries(workspace_id, party_id);
