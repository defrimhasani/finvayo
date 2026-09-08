CREATE TABLE invoice_sequences (
  workspace_id TEXT PRIMARY KEY REFERENCES workspaces(id) ON DELETE CASCADE,
  next_number INTEGER NOT NULL DEFAULT 1 CHECK (next_number > 0)
);

INSERT INTO invoice_sequences (workspace_id, next_number)
SELECT workspaces.id,
  COALESCE(MAX(CASE WHEN invoices.invoice_number GLOB 'INV-[0-9]*' THEN CAST(SUBSTR(invoices.invoice_number, 5) AS INTEGER) END), 0) + 1
FROM workspaces
LEFT JOIN invoices ON invoices.workspace_id = workspaces.id
GROUP BY workspaces.id;
