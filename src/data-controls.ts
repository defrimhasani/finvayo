import { currentUser, verifyPassword } from "./auth";

const JSON_HEADERS = { "cache-control": "no-store", "content-type": "application/json; charset=utf-8" } as const;

function json(data: unknown, status = 200): Response {
  return Response.json(data, { status, headers: JSON_HEADERS });
}

async function passwordInput(request: Request): Promise<string | null> {
  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) return null;
    const password = (body as Record<string, unknown>).password;
    return typeof password === "string" ? password : null;
  } catch {
    return null;
  }
}

async function verifyOwner(request: Request, db: D1Database) {
  const user = await currentUser(request, db);
  if (!user) return null;
  const password = await passwordInput(request);
  if (!password) return false;
  const credentials = await db.prepare("SELECT password_hash AS hash, password_salt AS salt, password_iterations AS iterations FROM users WHERE id = ?").bind(user.id).first<{ hash: string; salt: string; iterations: number }>();
  return credentials && await verifyPassword(password, credentials.hash, credentials.salt, credentials.iterations) ? user : false;
}

function csvCell(value: unknown): string {
  let text = value === null || value === undefined ? "" : String(value);
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

export async function exportWorkspace(request: Request, db: D1Database): Promise<Response> {
  const user = await currentUser(request, db);
  if (!user) return json({ error: "Unauthorized" }, 401);
  const [workspace, snapshots, entries, parties, reviews, followUps] = await Promise.all([
    db.prepare("SELECT name, currency, timezone, minimum_buffer_minor AS minimumBufferMinor, tax_reserve_minor AS taxReserveMinor, tax_reserve_mode AS taxReserveMode, tax_rate_basis_points AS taxRateBasisPoints, payment_delay_days AS paymentDelayDays FROM workspaces WHERE id = ?").bind(user.workspaceId).first(),
    db.prepare("SELECT balance_minor AS balanceMinor, effective_date AS effectiveDate, confirmed_at AS confirmedAt FROM cash_snapshots WHERE workspace_id = ? ORDER BY effective_date").bind(user.workspaceId).all(),
    db.prepare("SELECT id, direction, name, amount_minor AS amountMinor, scheduled_date AS scheduledDate, status, client_name AS clientName, invoice_reference AS invoiceReference, COALESCE(transaction_category, category) AS category, recurrence, included, actual_amount_minor AS actualAmountMinor, actual_date AS actualDate, completed_at AS completedAt, party_id AS partyId, party_name AS partyName, created_at AS createdAt, updated_at AS updatedAt FROM cash_entries WHERE workspace_id = ? ORDER BY scheduled_date").bind(user.workspaceId).all(),
    db.prepare("SELECT id, name, role, email, phone, notes, created_at AS createdAt, updated_at AS updatedAt FROM parties WHERE workspace_id = ? ORDER BY name COLLATE NOCASE").bind(user.workspaceId).all(),
    db.prepare("SELECT summary, completed_at AS completedAt FROM weekly_reviews WHERE workspace_id = ? ORDER BY completed_at").bind(user.workspaceId).all(),
    db.prepare("SELECT cash_entry_id AS cashEntryId, tone, message, completed_at AS completedAt FROM follow_ups WHERE workspace_id = ? ORDER BY completed_at").bind(user.workspaceId).all(),
  ]);
  const url = new URL(request.url);
  const format = url.searchParams.get("format") ?? "json";
  if (format === "csv") {
    const columns = ["direction", "name", "amountMinor", "scheduledDate", "status", "category", "partyName", "recurrence", "included", "actualAmountMinor", "actualDate"];
    const rows = [columns.map(csvCell).join(","), ...entries.results.map((entry) => columns.map((column) => csvCell((entry as Record<string, unknown>)[column])).join(","))];
    return new Response(`${rows.join("\n")}\n`, { headers: { "cache-control": "no-store, private", "content-type": "text/csv; charset=utf-8", "content-disposition": "attachment; filename=finvayo-transactions.csv" } });
  }
  if (format !== "json") return json({ error: "Invalid export format" }, 400);
  return new Response(JSON.stringify({ exportedAt: new Date().toISOString(), account: { email: user.email }, workspace, snapshots: snapshots.results, entries: entries.results, parties: parties.results, reviews: reviews.results, followUps: followUps.results }, null, 2), {
    headers: { "cache-control": "no-store, private", "content-type": "application/json; charset=utf-8", "content-disposition": "attachment; filename=finvayo-data.json" },
  });
}

export async function resetPlan(request: Request, db: D1Database): Promise<Response> {
  const user = await verifyOwner(request, db);
  if (user === null) return json({ error: "Unauthorized" }, 401);
  if (!user) return json({ error: "Password is incorrect" }, 403);
  await db.batch([
    db.prepare("DELETE FROM follow_ups WHERE workspace_id = ?").bind(user.workspaceId),
    db.prepare("DELETE FROM weekly_reviews WHERE workspace_id = ?").bind(user.workspaceId),
    db.prepare("DELETE FROM cash_entries WHERE workspace_id = ?").bind(user.workspaceId),
    db.prepare("DELETE FROM cash_snapshots WHERE workspace_id = ?").bind(user.workspaceId),
  ]);
  return json({ reset: true });
}

export async function deleteAccount(request: Request, db: D1Database): Promise<Response> {
  const user = await verifyOwner(request, db);
  if (user === null) return json({ error: "Unauthorized" }, 401);
  if (!user) return json({ error: "Password is incorrect" }, 403);
  const active = await db.prepare(
    `SELECT status FROM subscriptions WHERE workspace_id = ? AND (
      (stripe_subscription_id IS NOT NULL AND status IN ('trialing', 'active', 'past_due', 'unpaid', 'paused', 'incomplete')) OR
      (pending_checkout_session_id IS NOT NULL AND pending_checkout_expires_at > ?)
    )`,
  ).bind(user.workspaceId, Math.floor(Date.now() / 1000)).first();
  if (active) return json({ error: "Cancel the active subscription in Billing before deleting this account" }, 409);
  await db.prepare("DELETE FROM users WHERE id = ?").bind(user.id).run();
  return new Response(null, { status: 204, headers: { "cache-control": "no-store, private" } });
}
