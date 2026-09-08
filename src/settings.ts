import { currentUser } from "./auth";

const JSON_HEADERS = { "cache-control": "no-store", "content-type": "application/json; charset=utf-8" } as const;
const CURRENCIES = new Set(["USD", "EUR", "GBP"]);
const TIMEZONES = new Set([
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Toronto",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Zurich",
  "Europe/Tirane",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Australia/Sydney",
]);
const MAX_AMOUNT_MINOR = 9_000_000_000_000;

function json(data: unknown, status = 200): Response {
  return Response.json(data, { status, headers: JSON_HEADERS });
}

async function jsonObject(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const value: unknown = await request.json();
    return value !== null && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export async function getSettings(request: Request, db: D1Database): Promise<Response> {
  const user = await currentUser(request, db);
  if (!user) return json({ error: "Unauthorized" }, 401);
  const settings = await db
    .prepare(
      `SELECT workspaces.name, workspaces.currency, workspaces.timezone,
        workspaces.minimum_buffer_minor AS minimumBufferMinor,
        workspaces.tax_reserve_minor AS taxReserveMinor,
        workspaces.tax_reserve_mode AS taxReserveMode,
        workspaces.tax_rate_basis_points AS taxRateBasisPoints,
        workspaces.payment_delay_days AS paymentDelayDays,
        users.email,
        EXISTS(SELECT 1 FROM cash_snapshots WHERE workspace_id = workspaces.id) OR
        EXISTS(SELECT 1 FROM cash_entries WHERE workspace_id = workspaces.id) AS currencyLocked
       FROM workspaces JOIN users ON users.id = workspaces.owner_user_id
       WHERE workspaces.id = ?`,
    )
    .bind(user.workspaceId)
    .first();
  return json({ settings });
}

export async function updateSettings(request: Request, db: D1Database): Promise<Response> {
  const user = await currentUser(request, db);
  if (!user) return json({ error: "Unauthorized" }, 401);
  const input = await jsonObject(request);
  if (!input) return json({ error: "Invalid JSON body" }, 400);
  if (typeof input.name !== "string" || input.name.trim().length < 1 || input.name.trim().length > 80) {
    return json({ error: "Workspace name must be between 1 and 80 characters" }, 400);
  }
  if (typeof input.currency !== "string" || !CURRENCIES.has(input.currency)) return json({ error: "Invalid currency" }, 400);
  if (typeof input.timezone !== "string" || !TIMEZONES.has(input.timezone)) return json({ error: "Invalid timezone" }, 400);
  if (!Number.isSafeInteger(input.minimumBufferMinor) || Number(input.minimumBufferMinor) < 0 || Number(input.minimumBufferMinor) > MAX_AMOUNT_MINOR) {
    return json({ error: "Invalid minimum buffer" }, 400);
  }
  if (!Number.isSafeInteger(input.taxReserveMinor) || Number(input.taxReserveMinor) < 0 || Number(input.taxReserveMinor) > MAX_AMOUNT_MINOR) {
    return json({ error: "Invalid tax reserve" }, 400);
  }
  if (input.taxReserveMode !== "fixed" && input.taxReserveMode !== "percentage") return json({ error: "Invalid tax reserve mode" }, 400);
  if (!Number.isSafeInteger(input.taxRateBasisPoints) || Number(input.taxRateBasisPoints) < 0 || Number(input.taxRateBasisPoints) > 10000) return json({ error: "Invalid tax rate" }, 400);
  if (!Number.isSafeInteger(input.paymentDelayDays) || Number(input.paymentDelayDays) < 0 || Number(input.paymentDelayDays) > 365) return json({ error: "Invalid payment delay" }, 400);

  const result = await db
    .prepare(
      `UPDATE workspaces SET name = ?, currency = ?, timezone = ?, minimum_buffer_minor = ?, tax_reserve_minor = ?,
        tax_reserve_mode = ?, tax_rate_basis_points = ?, payment_delay_days = ?
       WHERE id = ? AND (
         currency = ? OR (
           NOT EXISTS(SELECT 1 FROM cash_snapshots WHERE workspace_id = workspaces.id) AND
           NOT EXISTS(SELECT 1 FROM cash_entries WHERE workspace_id = workspaces.id)
         )
       )`,
    )
    .bind(
      input.name.trim(),
      input.currency,
      input.timezone,
      input.minimumBufferMinor,
      input.taxReserveMinor,
      input.taxReserveMode,
      input.taxRateBasisPoints,
      input.paymentDelayDays,
      user.workspaceId,
      input.currency,
    )
    .run();
  if (!result.meta.changes) return json({ error: "Currency cannot change after financial records exist" }, 409);
  return json({ updated: true });
}
