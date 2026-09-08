ALTER TABLE users ADD COLUMN password_iterations INTEGER NOT NULL DEFAULT 100000
  CHECK (password_iterations IN (100000, 120000));

-- Authentication launched with 120,000 iterations. The 100,000-iteration Worker
-- reached production at 2026-09-08 11:38:57 UTC.
UPDATE users SET password_iterations = 120000 WHERE created_at < 1788867537;
