ALTER TABLE workspaces ADD COLUMN minimum_buffer_minor INTEGER NOT NULL DEFAULT 0 CHECK (minimum_buffer_minor >= 0);
ALTER TABLE workspaces ADD COLUMN tax_reserve_minor INTEGER NOT NULL DEFAULT 0 CHECK (tax_reserve_minor >= 0);

CREATE TABLE cash_snapshots (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  balance_minor INTEGER NOT NULL CHECK (ABS(balance_minor) <= 9000000000000),
  effective_date TEXT NOT NULL CHECK (effective_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  confirmed_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX cash_snapshots_workspace_date_idx
  ON cash_snapshots(workspace_id, effective_date DESC, confirmed_at DESC);

CREATE TABLE cash_entries (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  direction TEXT NOT NULL CHECK (direction IN ('inflow', 'outflow')),
  name TEXT NOT NULL CHECK (LENGTH(name) BETWEEN 1 AND 120),
  amount_minor INTEGER NOT NULL CHECK (amount_minor > 0 AND amount_minor <= 9000000000000),
  scheduled_date TEXT NOT NULL CHECK (scheduled_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  status TEXT NOT NULL CHECK (status IN ('expected', 'invoiced', 'overdue', 'unlikely', 'planned', 'paid')),
  client_name TEXT CHECK (client_name IS NULL OR LENGTH(client_name) <= 120),
  invoice_reference TEXT CHECK (invoice_reference IS NULL OR LENGTH(invoice_reference) <= 80),
  category TEXT CHECK (category IS NULL OR category IN ('contractors', 'software', 'rent', 'insurance', 'tax', 'payroll_owner_pay', 'debt', 'other')),
  recurrence TEXT CHECK (recurrence IS NULL OR recurrence = 'monthly'),
  included INTEGER NOT NULL DEFAULT 1 CHECK (included IN (0, 1)),
  actual_amount_minor INTEGER CHECK (actual_amount_minor IS NULL OR (actual_amount_minor > 0 AND actual_amount_minor <= 9000000000000)),
  completed_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  CHECK (
    (direction = 'inflow' AND status IN ('expected', 'invoiced', 'overdue', 'unlikely', 'paid')) OR
    (direction = 'outflow' AND status IN ('planned', 'paid'))
  ),
  CHECK ((status = 'paid' AND actual_amount_minor IS NOT NULL AND completed_at IS NOT NULL) OR status != 'paid')
);

CREATE INDEX cash_entries_workspace_date_idx ON cash_entries(workspace_id, scheduled_date);
CREATE INDEX cash_entries_workspace_status_idx ON cash_entries(workspace_id, status);

CREATE TABLE subscriptions (
  workspace_id TEXT PRIMARY KEY REFERENCES workspaces(id) ON DELETE CASCADE,
  stripe_customer_id TEXT UNIQUE,
  stripe_subscription_id TEXT UNIQUE,
  stripe_price_id TEXT,
  pending_checkout_token TEXT,
  pending_checkout_session_id TEXT,
  pending_checkout_expires_at INTEGER,
  status TEXT NOT NULL DEFAULT 'trialing' CHECK (status IN ('trialing', 'incomplete', 'incomplete_expired', 'active', 'past_due', 'unpaid', 'paused', 'canceled')),
  current_period_end INTEGER,
  cancel_at_period_end INTEGER NOT NULL DEFAULT 0 CHECK (cancel_at_period_end IN (0, 1)),
  stripe_updated_at INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE billing_events (
  stripe_event_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  stripe_created_at INTEGER NOT NULL,
  livemode INTEGER NOT NULL CHECK (livemode IN (0, 1)),
  status TEXT NOT NULL CHECK (status IN ('received', 'completed', 'failed')),
  attempts INTEGER NOT NULL DEFAULT 1,
  error TEXT,
  received_at INTEGER NOT NULL,
  processed_at INTEGER
);

CREATE INDEX billing_events_status_received_idx ON billing_events(status, received_at);

INSERT INTO subscriptions (workspace_id, status, created_at, updated_at)
SELECT id, 'trialing', created_at, created_at FROM workspaces;
