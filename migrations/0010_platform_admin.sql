ALTER TABLE users ADD COLUMN is_platform_admin INTEGER NOT NULL DEFAULT 0 CHECK (is_platform_admin IN (0, 1));

ALTER TABLE subscriptions ADD COLUMN manual_access_enabled INTEGER NOT NULL DEFAULT 0 CHECK (manual_access_enabled IN (0, 1));
ALTER TABLE subscriptions ADD COLUMN manual_access_note TEXT CHECK (manual_access_note IS NULL OR LENGTH(manual_access_note) <= 500);
ALTER TABLE subscriptions ADD COLUMN manual_access_updated_at INTEGER;
ALTER TABLE subscriptions ADD COLUMN manual_access_updated_by TEXT REFERENCES users(id) ON DELETE SET NULL;

CREATE TABLE admin_subscription_changes (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  admin_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  manual_access_enabled INTEGER NOT NULL CHECK (manual_access_enabled IN (0, 1)),
  note TEXT CHECK (note IS NULL OR LENGTH(note) <= 500),
  created_at INTEGER NOT NULL
);

CREATE INDEX admin_subscription_changes_workspace_idx
  ON admin_subscription_changes(workspace_id, created_at DESC);
