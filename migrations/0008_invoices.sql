CREATE TABLE invoices (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  customer_id TEXT NOT NULL REFERENCES parties(id) ON DELETE RESTRICT,
  invoice_number TEXT NOT NULL,
  issue_date TEXT NOT NULL CHECK (issue_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  due_date TEXT NOT NULL CHECK (due_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'editing', 'sending', 'sent', 'paid', 'void')),
  subtotal_minor INTEGER NOT NULL CHECK (subtotal_minor >= 0 AND subtotal_minor <= 9000000000000),
  tax_rate_basis_points INTEGER NOT NULL DEFAULT 0 CHECK (tax_rate_basis_points BETWEEN 0 AND 10000),
  tax_minor INTEGER NOT NULL CHECK (tax_minor >= 0 AND tax_minor <= 9000000000000),
  total_minor INTEGER NOT NULL CHECK (total_minor > 0 AND total_minor <= 9000000000000),
  notes TEXT CHECK (notes IS NULL OR LENGTH(notes) <= 1000),
  public_token_hash TEXT UNIQUE,
  sent_at INTEGER,
  paid_at INTEGER,
  paid_date TEXT CHECK (paid_date IS NULL OR paid_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  cash_entry_id TEXT UNIQUE REFERENCES cash_entries(id) ON DELETE SET NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(workspace_id, invoice_number)
);

CREATE TABLE invoice_items (
  id TEXT PRIMARY KEY,
  invoice_id TEXT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  description TEXT NOT NULL CHECK (LENGTH(description) BETWEEN 1 AND 200),
  quantity_milli INTEGER NOT NULL CHECK (quantity_milli > 0 AND quantity_milli <= 1000000000),
  unit_price_minor INTEGER NOT NULL CHECK (unit_price_minor >= 0 AND unit_price_minor <= 9000000000000),
  amount_minor INTEGER NOT NULL CHECK (amount_minor >= 0 AND amount_minor <= 9000000000000),
  position INTEGER NOT NULL CHECK (position >= 0)
);

CREATE INDEX invoices_workspace_created_idx ON invoices(workspace_id, created_at DESC);
CREATE INDEX invoices_workspace_status_due_idx ON invoices(workspace_id, status, due_date);
CREATE INDEX invoice_items_invoice_position_idx ON invoice_items(invoice_id, position);

CREATE TABLE invoice_public_tokens (
  token_hash TEXT PRIMARY KEY,
  invoice_id TEXT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL
);

CREATE INDEX invoice_public_tokens_invoice_idx ON invoice_public_tokens(invoice_id);
