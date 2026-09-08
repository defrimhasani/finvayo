import { currentUser } from "./auth";

const JSON_HEADERS = { "cache-control": "no-store", "content-type": "application/json; charset=utf-8" } as const;
const TONES = new Set(["friendly", "direct", "final"]);
const REVIEW_STEPS = new Set(["cash", "income", "expenses", "overdue", "outlook"]);

function json(data: unknown, status = 200): Response {
  return Response.json(data, { status, headers: JSON_HEADERS });
}

async function input(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const value: unknown = await request.json();
    return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

export async function getWorkflows(request: Request, db: D1Database): Promise<Response> {
  const user = await currentUser(request, db);
  if (!user) return json({ error: "Unauthorized" }, 401);
  const [review, followUps] = await Promise.all([
    db.prepare("SELECT id, summary, completed_at AS completedAt FROM weekly_reviews WHERE workspace_id = ? ORDER BY completed_at DESC LIMIT 1").bind(user.workspaceId).first(),
    db.prepare("SELECT id, cash_entry_id AS cashEntryId, tone, message, completed_at AS completedAt FROM follow_ups WHERE workspace_id = ? ORDER BY completed_at DESC LIMIT 20").bind(user.workspaceId).all(),
  ]);
  return json({ lastReview: review ?? null, followUps: followUps.results });
}

export async function completeReview(request: Request, db: D1Database): Promise<Response> {
  const user = await currentUser(request, db);
  if (!user) return json({ error: "Unauthorized" }, 401);
  const body = await input(request);
  if (!body || !Array.isArray(body.completed) || body.completed.length !== REVIEW_STEPS.size || new Set(body.completed).size !== REVIEW_STEPS.size || body.completed.some((item) => typeof item !== "string" || !REVIEW_STEPS.has(item))) {
    return json({ error: "Complete all five review steps" }, 400);
  }
  const now = Math.floor(Date.now() / 1000);
  const snapshot = await db.prepare("SELECT id FROM cash_snapshots WHERE workspace_id = ? AND confirmed_at >= ? LIMIT 1").bind(user.workspaceId, now - 7 * 86_400).first();
  if (!snapshot) return json({ error: "Confirm current cash before completing a review" }, 409);
  const summary = "Cash confirmed; payments, obligations, overdue income, and the next 30 days reviewed.";
  const id = crypto.randomUUID();
  await db.prepare("INSERT INTO weekly_reviews (id, workspace_id, summary, completed_at) VALUES (?, ?, ?, ?)").bind(id, user.workspaceId, summary, now).run();
  return json({ id, summary, completedAt: now }, 201);
}

function followUpMessage(entry: { name: string; amountMinor: number; scheduledDate: string; partyName: string | null; clientName: string | null; invoiceReference: string | null }, tone: string): string {
  const client = entry.partyName || entry.clientName || "there";
  const reference = entry.invoiceReference ? ` for ${entry.invoiceReference}` : "";
  const amount = (entry.amountMinor / 100).toFixed(2);
  if (tone === "direct") return `Hi ${client}, I’m following up on the ${amount} payment${reference}, which was due on ${entry.scheduledDate}. Please let me know when I can expect payment. Thank you.`;
  if (tone === "final") return `Hi ${client}, this is a final reminder that the ${amount} payment${reference} has been outstanding since ${entry.scheduledDate}. Please confirm the payment date or contact me promptly to discuss it.`;
  return `Hi ${client}, just a friendly reminder about the ${amount} payment${reference} that was due on ${entry.scheduledDate}. Could you let me know when it is scheduled? Thank you.`;
}

export async function generateFollowUp(request: Request, db: D1Database): Promise<Response> {
  const user = await currentUser(request, db);
  if (!user) return json({ error: "Unauthorized" }, 401);
  const body = await input(request);
  if (!body || typeof body.entryId !== "string" || typeof body.tone !== "string" || !TONES.has(body.tone)) return json({ error: "Invalid follow-up request" }, 400);
  const entry = await db.prepare(
    `SELECT cash_entries.name, cash_entries.amount_minor AS amountMinor, cash_entries.scheduled_date AS scheduledDate,
      cash_entries.party_name AS partyName, cash_entries.client_name AS clientName,
      cash_entries.invoice_reference AS invoiceReference, workspaces.timezone,
      workspaces.payment_delay_days AS paymentDelayDays
     FROM cash_entries JOIN workspaces ON workspaces.id = cash_entries.workspace_id
     WHERE cash_entries.id = ? AND cash_entries.workspace_id = ? AND direction = 'inflow' AND status IN ('expected', 'invoiced', 'overdue')`,
  ).bind(body.entryId, user.workspaceId).first<{ name: string; amountMinor: number; scheduledDate: string; partyName: string | null; clientName: string | null; invoiceReference: string | null; timezone: string; paymentDelayDays: number }>();
  if (!entry) return json({ error: "Overdue payment not found" }, 404);
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: entry.timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const expectedDate = new Date(`${entry.scheduledDate}T00:00:00Z`);
  expectedDate.setUTCDate(expectedDate.getUTCDate() + entry.paymentDelayDays);
  if (expectedDate.toISOString().slice(0, 10) >= today) return json({ error: "Payment is not overdue" }, 409);
  return json({ message: followUpMessage(entry, body.tone) });
}

export async function completeFollowUp(request: Request, db: D1Database): Promise<Response> {
  const user = await currentUser(request, db);
  if (!user) return json({ error: "Unauthorized" }, 401);
  const body = await input(request);
  if (!body || typeof body.entryId !== "string" || typeof body.tone !== "string" || !TONES.has(body.tone) || typeof body.message !== "string" || body.message.trim().length < 1 || body.message.length > 2000) return json({ error: "Invalid follow-up" }, 400);
  const entry = await db.prepare(
    `SELECT cash_entries.id, cash_entries.scheduled_date AS scheduledDate, workspaces.timezone,
      workspaces.payment_delay_days AS paymentDelayDays
     FROM cash_entries JOIN workspaces ON workspaces.id = cash_entries.workspace_id
     WHERE cash_entries.id = ? AND cash_entries.workspace_id = ? AND direction = 'inflow' AND status IN ('expected', 'invoiced', 'overdue')`,
  ).bind(body.entryId, user.workspaceId).first<{ id: string; scheduledDate: string; timezone: string; paymentDelayDays: number }>();
  if (!entry) return json({ error: "Payment not found" }, 404);
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: entry.timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const expectedDate = new Date(`${entry.scheduledDate}T00:00:00Z`);
  expectedDate.setUTCDate(expectedDate.getUTCDate() + entry.paymentDelayDays);
  if (expectedDate.toISOString().slice(0, 10) >= today) return json({ error: "Payment is not overdue" }, 409);
  const now = Math.floor(Date.now() / 1000);
  const id = crypto.randomUUID();
  await db.prepare("INSERT INTO follow_ups (id, workspace_id, cash_entry_id, tone, message, completed_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)").bind(id, user.workspaceId, body.entryId, body.tone, body.message.trim(), now, now).run();
  return json({ id, completedAt: now }, 201);
}
