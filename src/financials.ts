import { currentUser } from "./auth";

const MAX_AMOUNT_MINOR = 9_000_000_000_000;
const JSON_HEADERS = { "cache-control": "no-store", "content-type": "application/json; charset=utf-8" } as const;
const INFLOW_STATUSES = new Set(["expected", "invoiced", "overdue", "unlikely", "paid"]);
const OUTFLOW_STATUSES = new Set(["planned", "paid"]);
const INFLOW_CATEGORIES = new Set([
  "service_income",
  "product_sales",
  "retainer_income",
  "commission_income",
  "interest_income",
  "refund_received",
  "grant_income",
  "loan_proceeds",
  "owner_contribution",
  "asset_sale",
  "transfer_in",
  "other_income",
]);
const OUTFLOW_CATEGORIES = new Set([
  "contractors",
  "payroll_owner_pay",
  "inventory",
  "software",
  "subscriptions",
  "rent",
  "utilities",
  "insurance",
  "professional_services",
  "marketing",
  "advertising",
  "travel",
  "meals",
  "office_supplies",
  "equipment",
  "repairs_maintenance",
  "shipping",
  "vehicle",
  "training",
  "licenses_permits",
  "bank_fees",
  "payment_processing_fees",
  "tax",
  "debt",
  "loan_repayment",
  "owner_draw",
  "refunds",
  "charitable_giving",
  "transfer_out",
  "other",
]);

type CashEntryInput = {
  direction?: unknown;
  name?: unknown;
  amountMinor?: unknown;
  scheduledDate?: unknown;
  status?: unknown;
  clientName?: unknown;
  invoiceReference?: unknown;
  category?: unknown;
  recurrence?: unknown;
  included?: unknown;
  actualAmountMinor?: unknown;
  partyId?: unknown;
};

type FinancialEntry = {
  id: string;
  direction: "inflow" | "outflow";
  name: string;
  amountMinor: number;
  scheduledDate: string;
  status: string;
  recurrence: string | null;
  included: number;
  completedAt: number | null;
  partyName: string | null;
  clientName: string | null;
  invoiceReference: string | null;
  category: string | null;
};

type CashSnapshot = { id: string; balanceMinor: number; effectiveDate: string; confirmedAt: number };

function addDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function addMonths(date: string, offset: number): string {
  const [year, month, day] = date.split("-").map(Number);
  const monthIndex = month - 1 + offset;
  const nextYear = year + Math.floor(monthIndex / 12);
  const nextMonthIndex = ((monthIndex % 12) + 12) % 12;
  const finalDay = new Date(Date.UTC(nextYear, nextMonthIndex + 1, 0)).getUTCDate();
  return `${nextYear}-${String(nextMonthIndex + 1).padStart(2, "0")}-${String(Math.min(day, finalDay)).padStart(2, "0")}`;
}

function buildOverview(
  snapshot: CashSnapshot | null,
  entries: FinancialEntry[],
  minimumBufferMinor: number,
  taxReserveMinor: number,
) {
  if (!snapshot) return null;
  const horizonEnd = addDays(snapshot.effectiveDate, 90);
  const events: Array<{ id: string; name: string; direction: "inflow" | "outflow"; amountMinor: number; date: string; status: string; partyName: string | null; invoiceReference: string | null; category: string | null }> = [];

  for (const entry of entries) {
    const projectedInflow = entry.direction === "inflow" && (entry.status === "expected" || entry.status === "invoiced");
    const projectedOutflow = entry.direction === "outflow" && entry.status === "planned";
    if (!entry.included || (!projectedInflow && !projectedOutflow)) continue;
    let occurrence = 0;
    let date = entry.scheduledDate;
    if (entry.recurrence === "monthly" && date < snapshot.effectiveDate) {
      const [startYear, startMonth] = entry.scheduledDate.split("-").map(Number);
      const [endYear, endMonth] = snapshot.effectiveDate.split("-").map(Number);
      occurrence = Math.max(0, (endYear - startYear) * 12 + endMonth - startMonth);
      date = addMonths(entry.scheduledDate, occurrence);
      if (date < snapshot.effectiveDate) {
        occurrence += 1;
        date = addMonths(entry.scheduledDate, occurrence);
      }
    }
    while (date < horizonEnd) {
      if (date >= snapshot.effectiveDate) {
        events.push({
          id: entry.id,
          name: entry.name,
          direction: entry.direction,
          amountMinor: entry.amountMinor,
          date,
          status: entry.status,
          partyName: entry.partyName || entry.clientName,
          invoiceReference: entry.invoiceReference,
          category: entry.category,
        });
      }
      if (entry.recurrence !== "monthly") break;
      occurrence += 1;
      date = addMonths(entry.scheduledDate, occurrence);
    }
  }

  events.sort((first, second) => first.date.localeCompare(second.date) || first.id.localeCompare(second.id));
  const protectedMinor = minimumBufferMinor + taxReserveMinor;
  let balanceMinor = snapshot.balanceMinor;
  let lowestBalanceMinor = balanceMinor;
  let lowestHeadroomMinor = balanceMinor - protectedMinor;
  let limitingDate = snapshot.effectiveDate;
  let firstBreachDate: string | null = balanceMinor < protectedMinor ? snapshot.effectiveDate : null;
  let firstNegativeDate: string | null = balanceMinor < 0 ? snapshot.effectiveDate : null;
  const points = [{ date: snapshot.effectiveDate, balanceMinor }];
  for (let index = 0; index < events.length; ) {
    const date = events[index].date;
    let dailyChangeMinor = 0;
    while (index < events.length && events[index].date === date) {
      dailyChangeMinor += events[index].direction === "inflow" ? events[index].amountMinor : -events[index].amountMinor;
      index += 1;
    }
    balanceMinor += dailyChangeMinor;
    const headroom = balanceMinor - protectedMinor;
    if (balanceMinor < lowestBalanceMinor) lowestBalanceMinor = balanceMinor;
    if (headroom < lowestHeadroomMinor) {
      lowestHeadroomMinor = headroom;
      limitingDate = date;
    }
    if (!firstBreachDate && headroom < 0) firstBreachDate = date;
    if (!firstNegativeDate && balanceMinor < 0) firstNegativeDate = date;
    points.push({ date, balanceMinor });
  }

  const overdue = entries
    .filter((entry) => entry.direction === "inflow" && entry.status === "overdue")
    .sort((first, second) => first.scheduledDate.localeCompare(second.scheduledDate))[0];
  const nextOutflow = events.find((entry) => entry.direction === "outflow");
  const recommendation = overdue
    ? { type: "Invoice follow-up", title: `${overdue.partyName || overdue.clientName || overdue.name} is overdue.`, amountMinor: overdue.amountMinor, detail: overdue.invoiceReference || overdue.name }
    : nextOutflow
      ? { type: "Upcoming expense", title: `Prepare for ${nextOutflow.name}.`, amountMinor: nextOutflow.amountMinor, detail: nextOutflow.date }
      : { type: "Plan ready", title: "Add expected income and expenses to sharpen your outlook.", amountMinor: null, detail: "Next 90 days" };
  const provisional = entries.some((entry) => entry.status === "paid" && Number(entry.completedAt) >= snapshot.confirmedAt);
  return {
    safeToSpendMinor: Math.max(0, lowestHeadroomMinor),
    currentCashMinor: snapshot.balanceMinor,
    minimumBufferMinor,
    taxReserveMinor,
    protectedMinor,
    lowestBalanceMinor,
    lowestHeadroomMinor,
    limitingDate,
    firstBreachDate,
    firstNegativeDate,
    risk: lowestBalanceMinor < 0 ? "at_risk" : lowestHeadroomMinor < 0 ? "caution" : "normal",
    provisional,
    horizonStart: snapshot.effectiveDate,
    horizonEnd,
    points,
    events,
    recommendation,
  };
}

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

function validDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

function validAmount(value: unknown, allowZero = false): value is number {
  return Number.isSafeInteger(value) && (allowZero ? Number(value) >= 0 : Number(value) > 0) && Number(value) <= MAX_AMOUNT_MINOR;
}

function validBalance(value: unknown): value is number {
  return Number.isSafeInteger(value) && Math.abs(Number(value)) <= MAX_AMOUNT_MINOR;
}

function optionalText(value: unknown, maximum: number): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  if (typeof value !== "string" || value.trim().length > maximum) return undefined;
  return value.trim();
}

async function authenticatedWorkspace(request: Request, db: D1Database) {
  return currentUser(request, db);
}

export async function getFinancials(request: Request, db: D1Database): Promise<Response> {
  const user = await authenticatedWorkspace(request, db);
  if (!user) return json({ error: "Unauthorized" }, 401);

  const [workspace, snapshot, entries] = await Promise.all([
    db
      .prepare(
        `SELECT currency, timezone, minimum_buffer_minor AS minimumBufferMinor,
          tax_reserve_minor AS taxReserveMinor FROM workspaces WHERE id = ?`,
      )
      .bind(user.workspaceId)
      .first<{ currency: string; timezone: string; minimumBufferMinor: number; taxReserveMinor: number }>(),
    db
      .prepare(
        `SELECT id, balance_minor AS balanceMinor, effective_date AS effectiveDate, confirmed_at AS confirmedAt
         FROM cash_snapshots WHERE workspace_id = ?
         ORDER BY effective_date DESC, confirmed_at DESC LIMIT 1`,
      )
      .bind(user.workspaceId)
      .first<CashSnapshot>(),
    db
      .prepare(
        `SELECT id, direction, name, amount_minor AS amountMinor, scheduled_date AS scheduledDate,
          status, client_name AS clientName, invoice_reference AS invoiceReference,
          COALESCE(transaction_category, category) AS category,
          recurrence, included, actual_amount_minor AS actualAmountMinor, completed_at AS completedAt,
          party_id AS partyId, party_name AS partyName,
          created_at AS createdAt, updated_at AS updatedAt
         FROM cash_entries WHERE workspace_id = ? ORDER BY scheduled_date, created_at`,
      )
      .bind(user.workspaceId)
      .all<FinancialEntry>(),
  ]);

  const overview = workspace
    ? buildOverview(snapshot ?? null, entries.results, workspace.minimumBufferMinor, workspace.taxReserveMinor)
    : null;
  return json({ currency: workspace?.currency, timezone: workspace?.timezone, snapshot: snapshot ?? null, entries: entries.results, overview });
}

export async function createCashSnapshot(request: Request, db: D1Database): Promise<Response> {
  const user = await authenticatedWorkspace(request, db);
  if (!user) return json({ error: "Unauthorized" }, 401);
  const input = await jsonObject(request);
  if (!input) return json({ error: "Invalid JSON body" }, 400);
  if (!validBalance(input.balanceMinor) || !validDate(input.effectiveDate)) {
    return json({ error: "Invalid balance or effective date" }, 400);
  }

  const id = crypto.randomUUID();
  const now = Math.floor(Date.now() / 1000);
  await db
    .prepare(
      "INSERT INTO cash_snapshots (id, workspace_id, balance_minor, effective_date, confirmed_at, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    )
    .bind(id, user.workspaceId, input.balanceMinor, input.effectiveDate, now, now)
    .run();
  return json({ id }, 201);
}

function validateEntry(input: CashEntryInput): string | null {
  if (input.direction !== "inflow" && input.direction !== "outflow") return "Invalid direction";
  if (typeof input.name !== "string" || input.name.trim().length < 1 || input.name.trim().length > 120) return "Invalid name";
  if (!validAmount(input.amountMinor) || !validDate(input.scheduledDate)) return "Invalid amount or date";
  const statuses = input.direction === "inflow" ? INFLOW_STATUSES : OUTFLOW_STATUSES;
  if (typeof input.status !== "string" || !statuses.has(input.status)) return "Invalid status";
  if (optionalText(input.clientName, 120) === undefined && input.clientName !== undefined) return "Invalid client name";
  if (optionalText(input.invoiceReference, 80) === undefined && input.invoiceReference !== undefined) return "Invalid invoice reference";
  const categories = input.direction === "inflow" ? INFLOW_CATEGORIES : OUTFLOW_CATEGORIES;
  if (input.category !== undefined && input.category !== null && !categories.has(String(input.category))) return "Invalid category";
  if (input.recurrence !== undefined && input.recurrence !== null && input.recurrence !== "monthly") return "Invalid recurrence";
  if (input.included !== undefined && typeof input.included !== "boolean") return "Invalid inclusion setting";
  if (input.status === "paid" && !validAmount(input.actualAmountMinor)) return "Paid entries require an actual amount";
  if (input.partyId !== undefined && input.partyId !== null && typeof input.partyId !== "string") return "Invalid party";
  return null;
}

export async function createCashEntry(request: Request, db: D1Database): Promise<Response> {
  const user = await authenticatedWorkspace(request, db);
  if (!user) return json({ error: "Unauthorized" }, 401);
  const input = (await jsonObject(request)) as CashEntryInput | null;
  if (!input) return json({ error: "Invalid JSON body" }, 400);
  const error = validateEntry(input);
  if (error) return json({ error }, 400);

  const id = crypto.randomUUID();
  const now = Math.floor(Date.now() / 1000);
  const paid = input.status === "paid";
  let party: { id: string; name: string; role: string } | null = null;
  if (input.partyId) {
    party = await db
      .prepare("SELECT id, name, role FROM parties WHERE id = ? AND workspace_id = ?")
      .bind(input.partyId, user.workspaceId)
      .first<{ id: string; name: string; role: string }>();
    if (!party) return json({ error: "Party not found" }, 400);
    const requiredRole = input.direction === "inflow" ? "customer" : "supplier";
    if (party.role !== requiredRole && party.role !== "both") return json({ error: `Party must be a ${requiredRole}` }, 400);
  }
  await db
    .prepare(
      `INSERT INTO cash_entries
       (id, workspace_id, direction, name, amount_minor, scheduled_date, status, client_name,
         invoice_reference, category, transaction_category, recurrence, included, actual_amount_minor, completed_at,
         party_id, party_name, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      id,
      user.workspaceId,
      input.direction,
      String(input.name).trim(),
      input.amountMinor,
      input.scheduledDate,
      input.status,
      optionalText(input.clientName, 120) ?? null,
      optionalText(input.invoiceReference, 80) ?? null,
      null,
      input.category ?? null,
      input.recurrence ?? null,
      input.included === false ? 0 : 1,
      paid ? input.actualAmountMinor : null,
      paid ? now : null,
      party?.id ?? null,
      party?.name ?? null,
      now,
      now,
    )
    .run();
  return json({ id }, 201);
}

export async function updateCashEntry(request: Request, db: D1Database, id: string): Promise<Response> {
  const user = await authenticatedWorkspace(request, db);
  if (!user) return json({ error: "Unauthorized" }, 401);
  const input = await jsonObject(request);
  if (!input) return json({ error: "Invalid JSON body" }, 400);
  if (input.included !== undefined && typeof input.included !== "boolean") return json({ error: "Invalid inclusion setting" }, 400);
  if (input.status !== undefined && input.status !== "paid") return json({ error: "Only paid status updates are supported" }, 400);
  if (input.status === "paid" && !validAmount(input.actualAmountMinor)) return json({ error: "Paid entries require an actual amount" }, 400);
  if (input.status === undefined && input.included === undefined) return json({ error: "No changes supplied" }, 400);

  const existing = await db
    .prepare("SELECT id FROM cash_entries WHERE id = ? AND workspace_id = ?")
    .bind(id, user.workspaceId)
    .first();
  if (!existing) return json({ error: "Not found" }, 404);

  const now = Math.floor(Date.now() / 1000);
  await db
    .prepare(
      `UPDATE cash_entries SET
        status = COALESCE(?, status),
        actual_amount_minor = CASE WHEN ? = 'paid' THEN ? ELSE actual_amount_minor END,
        completed_at = CASE WHEN ? = 'paid' THEN ? ELSE completed_at END,
        included = COALESCE(?, included), updated_at = ?
       WHERE id = ? AND workspace_id = ?`,
    )
    .bind(
      input.status ?? null,
      input.status ?? null,
      input.actualAmountMinor ?? null,
      input.status ?? null,
      now,
      input.included === undefined ? null : input.included ? 1 : 0,
      now,
      id,
      user.workspaceId,
    )
    .run();
  return json({ id });
}

export async function deleteCashEntry(request: Request, db: D1Database, id: string): Promise<Response> {
  const user = await authenticatedWorkspace(request, db);
  if (!user) return json({ error: "Unauthorized" }, 401);
  const result = await db.prepare("DELETE FROM cash_entries WHERE id = ? AND workspace_id = ?").bind(id, user.workspaceId).run();
  return result.meta.changes ? new Response(null, { status: 204 }) : json({ error: "Not found" }, 404);
}
