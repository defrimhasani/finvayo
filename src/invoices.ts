import { currentUser } from "./auth";
import { sendInvoiceEmail, type EmailEnv } from "./email";

const JSON_HEADERS = { "cache-control": "no-store", "content-type": "application/json; charset=utf-8" } as const;
const MAX_AMOUNT_MINOR = 9_000_000_000_000;

type InvoiceItemInput = { description?: unknown; quantity?: unknown; unitPriceMinor?: unknown };
type InvoiceInput = { customerId?: unknown; issueDate?: unknown; dueDate?: unknown; taxRateBasisPoints?: unknown; notes?: unknown; items?: unknown };
type InvoiceDetails = {
  id: string;
  invoiceNumber: string;
  issueDate: string;
  dueDate: string;
  status: string;
  subtotalMinor: number;
  taxRateBasisPoints: number;
  taxMinor: number;
  totalMinor: number;
  notes: string | null;
  sentAt: number | null;
  paidAt: number | null;
  paidDate: string | null;
  customerId: string;
  customerName: string;
  customerEmail: string | null;
  businessName: string;
  currency: string;
  timezone: string;
};

function json(data: unknown, status = 200): Response {
  return Response.json(data, { status, headers: JSON_HEADERS });
}

async function jsonObject(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const value: unknown = await request.json();
    return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

function validDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

function parseInvoice(input: InvoiceInput) {
  if (typeof input.customerId !== "string" || !/^[0-9a-f-]+$/i.test(input.customerId)) return { error: "Choose a customer" } as const;
  if (!validDate(input.issueDate) || !validDate(input.dueDate) || input.dueDate < input.issueDate) return { error: "Enter valid issue and due dates" } as const;
  if (!Number.isSafeInteger(input.taxRateBasisPoints) || Number(input.taxRateBasisPoints) < 0 || Number(input.taxRateBasisPoints) > 10000) return { error: "Invalid tax rate" } as const;
  if (input.notes !== undefined && input.notes !== null && (typeof input.notes !== "string" || input.notes.trim().length > 1000)) return { error: "Notes are too long" } as const;
  if (!Array.isArray(input.items) || input.items.length < 1 || input.items.length > 100) return { error: "Add between 1 and 100 line items" } as const;
  const items = input.items.map((raw) => {
    const item = raw as InvoiceItemInput;
    const description = typeof item.description === "string" ? item.description.trim() : "";
    const quantity = typeof item.quantity === "number" ? item.quantity : Number.NaN;
    const unitPriceMinor = item.unitPriceMinor;
    if (!description || description.length > 200 || !Number.isFinite(quantity) || quantity <= 0 || quantity > 1_000_000 || Math.round(quantity * 1000) !== quantity * 1000 || !Number.isSafeInteger(unitPriceMinor) || Number(unitPriceMinor) < 0 || Number(unitPriceMinor) > MAX_AMOUNT_MINOR) return null;
    const quantityMilli = Math.round(quantity * 1000);
    const amountMinor = Math.round(quantityMilli * Number(unitPriceMinor) / 1000);
    if (!Number.isSafeInteger(amountMinor) || amountMinor < 0 || amountMinor > MAX_AMOUNT_MINOR) return null;
    return { description, quantityMilli, unitPriceMinor: Number(unitPriceMinor), amountMinor };
  });
  if (items.some((item) => item === null)) return { error: "Invalid line item" } as const;
  const subtotalMinor = items.reduce((sum, item) => sum + (item?.amountMinor ?? 0), 0);
  const taxRateBasisPoints = Number(input.taxRateBasisPoints);
  const taxMinor = Math.round(subtotalMinor * taxRateBasisPoints / 10000);
  const totalMinor = subtotalMinor + taxMinor;
  if (!Number.isSafeInteger(totalMinor) || totalMinor <= 0 || totalMinor > MAX_AMOUNT_MINOR) return { error: "Invalid invoice total" } as const;
  return { value: { customerId: input.customerId, issueDate: input.issueDate, dueDate: input.dueDate, taxRateBasisPoints, notes: typeof input.notes === "string" && input.notes.trim() ? input.notes.trim() : null, items: items as NonNullable<(typeof items)[number]>[], subtotalMinor, taxMinor, totalMinor } } as const;
}

function token(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

async function tokenHash(value: string): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
  return Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function customer(db: D1Database, workspaceId: string, id: string) {
  return db.prepare("SELECT id, name, email, role FROM parties WHERE id = ? AND workspace_id = ? AND role IN ('customer', 'both')").bind(id, workspaceId).first<{ id: string; name: string; email: string | null; role: string }>();
}

async function invoiceDetails(db: D1Database, workspaceId: string, id: string) {
  const invoice = await db.prepare(
    `SELECT invoices.id, invoices.invoice_number AS invoiceNumber, invoices.issue_date AS issueDate,
      invoices.due_date AS dueDate, invoices.status, invoices.subtotal_minor AS subtotalMinor,
      invoices.tax_rate_basis_points AS taxRateBasisPoints, invoices.tax_minor AS taxMinor,
      invoices.total_minor AS totalMinor, invoices.notes, invoices.sent_at AS sentAt,
      invoices.paid_at AS paidAt, invoices.paid_date AS paidDate, invoices.customer_id AS customerId,
      parties.name AS customerName, parties.email AS customerEmail, workspaces.name AS businessName,
      workspaces.currency, workspaces.timezone
     FROM invoices JOIN parties ON parties.id = invoices.customer_id
     JOIN workspaces ON workspaces.id = invoices.workspace_id
     WHERE invoices.id = ? AND invoices.workspace_id = ?`,
  ).bind(id, workspaceId).first<InvoiceDetails>();
  if (!invoice) return null;
  const items = await db.prepare("SELECT id, description, quantity_milli AS quantityMilli, unit_price_minor AS unitPriceMinor, amount_minor AS amountMinor, position FROM invoice_items WHERE invoice_id = ? ORDER BY position").bind(id).all();
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: String(invoice.timezone), year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  return { ...invoice, status: invoice.status === "sent" && String(invoice.dueDate) < today ? "overdue" : invoice.status, items: items.results };
}

export async function listInvoices(request: Request, db: D1Database): Promise<Response> {
  const user = await currentUser(request, db);
  if (!user) return json({ error: "Unauthorized" }, 401);
  const rows = await db.prepare(
    `SELECT invoices.id, invoice_number AS invoiceNumber, issue_date AS issueDate, due_date AS dueDate,
      status, total_minor AS totalMinor, parties.name AS customerName, workspaces.timezone
     FROM invoices JOIN parties ON parties.id = invoices.customer_id JOIN workspaces ON workspaces.id = invoices.workspace_id
     WHERE invoices.workspace_id = ? ORDER BY invoices.created_at DESC`,
  ).bind(user.workspaceId).all<Record<string, unknown>>();
  return json({ invoices: rows.results.map((invoice) => {
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: String(invoice.timezone), year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
    const { timezone: _, ...result } = invoice;
    return { ...result, status: invoice.status === "sent" && String(invoice.dueDate) < today ? "overdue" : invoice.status };
  }) });
}

export async function getInvoice(request: Request, db: D1Database, id: string): Promise<Response> {
  const user = await currentUser(request, db);
  if (!user) return json({ error: "Unauthorized" }, 401);
  const invoice = await invoiceDetails(db, user.workspaceId, id);
  return invoice ? json({ invoice }) : json({ error: "Not found" }, 404);
}

export async function createInvoice(request: Request, db: D1Database): Promise<Response> {
  const user = await currentUser(request, db);
  if (!user) return json({ error: "Unauthorized" }, 401);
  const parsed = parseInvoice((await jsonObject(request)) as InvoiceInput);
  if ("error" in parsed) return json({ error: parsed.error }, 400);
  const value = parsed.value;
  if (!(await customer(db, user.workspaceId, value.customerId))) return json({ error: "Customer not found" }, 400);
  const id = crypto.randomUUID();
  const now = Math.floor(Date.now() / 1000);
  const sequence = await db.prepare(
    `INSERT INTO invoice_sequences (workspace_id, next_number) VALUES (?, 2)
     ON CONFLICT(workspace_id) DO UPDATE SET next_number = next_number + 1
     RETURNING next_number - 1 AS number`,
  ).bind(user.workspaceId).first<{ number: number }>();
  const invoiceNumber = `INV-${String(sequence?.number ?? 1).padStart(4, "0")}`;
  try {
    await db.batch([
      db.prepare("INSERT INTO invoices (id, workspace_id, customer_id, invoice_number, issue_date, due_date, subtotal_minor, tax_rate_basis_points, tax_minor, total_minor, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(id, user.workspaceId, value.customerId, invoiceNumber, value.issueDate, value.dueDate, value.subtotalMinor, value.taxRateBasisPoints, value.taxMinor, value.totalMinor, value.notes, now, now),
      ...value.items.map((item, position) => db.prepare("INSERT INTO invoice_items (id, invoice_id, description, quantity_milli, unit_price_minor, amount_minor, position) VALUES (?, ?, ?, ?, ?, ?, ?)").bind(crypto.randomUUID(), id, item.description, item.quantityMilli, item.unitPriceMinor, item.amountMinor, position)),
    ]);
  } catch {
    return json({ error: "Invoice number already exists or invoice data is invalid" }, 409);
  }
  return json({ id, invoiceNumber }, 201);
}

export async function updateInvoice(request: Request, db: D1Database, id: string): Promise<Response> {
  const user = await currentUser(request, db);
  if (!user) return json({ error: "Unauthorized" }, 401);
  const existing = await db.prepare("SELECT status FROM invoices WHERE id = ? AND workspace_id = ?").bind(id, user.workspaceId).first<{ status: string }>();
  if (!existing) return json({ error: "Not found" }, 404);
  if (existing.status !== "draft") return json({ error: "Only draft invoices can be edited" }, 409);
  const parsed = parseInvoice((await jsonObject(request)) as InvoiceInput);
  if ("error" in parsed) return json({ error: parsed.error }, 400);
  const value = parsed.value;
  if (!(await customer(db, user.workspaceId, value.customerId))) return json({ error: "Customer not found" }, 400);
  const now = Math.floor(Date.now() / 1000);
  const reserved = await db.prepare("UPDATE invoices SET status = 'editing', updated_at = ? WHERE id = ? AND workspace_id = ? AND status = 'draft'").bind(now, id, user.workspaceId).run();
  if (!reserved.meta.changes) return json({ error: "Invoice is no longer editable" }, 409);
  try {
    await db.batch([
      db.prepare("UPDATE invoices SET customer_id = ?, issue_date = ?, due_date = ?, subtotal_minor = ?, tax_rate_basis_points = ?, tax_minor = ?, total_minor = ?, notes = ?, status = 'draft', updated_at = ? WHERE id = ? AND workspace_id = ? AND status = 'editing'").bind(value.customerId, value.issueDate, value.dueDate, value.subtotalMinor, value.taxRateBasisPoints, value.taxMinor, value.totalMinor, value.notes, now, id, user.workspaceId),
      db.prepare("DELETE FROM invoice_items WHERE invoice_id = ?").bind(id),
      ...value.items.map((item, position) => db.prepare("INSERT INTO invoice_items (id, invoice_id, description, quantity_milli, unit_price_minor, amount_minor, position) VALUES (?, ?, ?, ?, ?, ?, ?)").bind(crypto.randomUUID(), id, item.description, item.quantityMilli, item.unitPriceMinor, item.amountMinor, position)),
    ]);
  } catch {
    await db.prepare("UPDATE invoices SET status = 'draft', updated_at = ? WHERE id = ? AND workspace_id = ? AND status = 'editing'").bind(now, id, user.workspaceId).run();
    return json({ error: "Invoice number already exists or invoice data is invalid" }, 409);
  }
  return json({ id });
}

export async function deleteInvoice(request: Request, db: D1Database, id: string): Promise<Response> {
  const user = await currentUser(request, db);
  if (!user) return json({ error: "Unauthorized" }, 401);
  const result = await db.prepare("DELETE FROM invoices WHERE id = ? AND workspace_id = ? AND status = 'draft'").bind(id, user.workspaceId).run();
  return result.meta.changes ? new Response(null, { status: 204 }) : json({ error: "Only draft invoices can be deleted" }, 409);
}

export async function sendInvoice(request: Request, env: EmailEnv, id: string): Promise<Response> {
  const user = await currentUser(request, env.DB);
  if (!user) return json({ error: "Unauthorized" }, 401);
  const invoice = await invoiceDetails(env.DB, user.workspaceId, id);
  if (!invoice) return json({ error: "Not found" }, 404);
  if (invoice.status === "paid" || invoice.status === "void" || invoice.status === "editing" || invoice.status === "sending") return json({ error: "Invoice cannot be sent" }, 409);
  if (typeof invoice.customerEmail !== "string" || !invoice.customerEmail) return json({ error: "Add an email address to this customer before sending" }, 409);
  const publicToken = token();
  const publicUrl = `${new URL(request.url).origin}/invoice/${publicToken}`;
  const total = new Intl.NumberFormat("en", { style: "currency", currency: String(invoice.currency) }).format(Number(invoice.totalMinor) / 100);
  const now = Math.floor(Date.now() / 1000);
  const reserved = await env.DB.prepare("UPDATE invoices SET status = 'sending', updated_at = ? WHERE id = ? AND workspace_id = ? AND status IN ('draft', 'sent')").bind(now, id, user.workspaceId).run();
  if (!reserved.meta.changes) return json({ error: "Invoice is already being sent" }, 409);
  const hash = await tokenHash(publicToken);
  await env.DB.prepare("INSERT INTO invoice_public_tokens (token_hash, invoice_id, created_at) VALUES (?, ?, ?)").bind(hash, id, now).run();
  try {
    await sendInvoiceEmail(env, { to: invoice.customerEmail, customerName: String(invoice.customerName), businessName: String(invoice.businessName), invoiceNumber: String(invoice.invoiceNumber), total, dueDate: String(invoice.dueDate), publicUrl });
  } catch (error) {
    await env.DB.batch([
      env.DB.prepare("DELETE FROM invoice_public_tokens WHERE token_hash = ?").bind(hash),
      env.DB.prepare("UPDATE invoices SET status = ?, updated_at = ? WHERE id = ? AND workspace_id = ? AND status = 'sending'").bind(invoice.sentAt ? "sent" : "draft", now, id, user.workspaceId),
    ]);
    return json({ error: error instanceof Error ? error.message : "Unable to send invoice" }, 503);
  }
  await env.DB.prepare("UPDATE invoices SET status = 'sent', public_token_hash = ?, sent_at = COALESCE(sent_at, ?), updated_at = ? WHERE id = ? AND workspace_id = ? AND status = 'sending'").bind(hash, now, now, id, user.workspaceId).run();
  return json({ sent: true });
}

export async function markInvoicePaid(request: Request, db: D1Database, id: string): Promise<Response> {
  const user = await currentUser(request, db);
  if (!user) return json({ error: "Unauthorized" }, 401);
  const body = await jsonObject(request);
  if (!body || !validDate(body.paidDate)) return json({ error: "Invalid payment date" }, 400);
  const invoice = await invoiceDetails(db, user.workspaceId, id);
  if (!invoice) return json({ error: "Not found" }, 404);
  if (invoice.status === "paid") return json({ error: "Invoice is already paid" }, 409);
  if (invoice.status === "void") return json({ error: "Void invoices cannot be paid" }, 409);
  const entryId = invoice.id;
  const now = Math.floor(Date.now() / 1000);
  const results = await db.batch([
    db.prepare(
      `INSERT OR IGNORE INTO cash_entries (id, workspace_id, direction, name, amount_minor, scheduled_date, status,
        invoice_reference, transaction_category, included, actual_amount_minor, actual_date, completed_at,
        party_id, party_name, created_at, updated_at)
       VALUES (?, ?, 'inflow', ?, ?, ?, 'paid', ?, 'service_income', 1, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(entryId, user.workspaceId, `Invoice ${invoice.invoiceNumber}`, invoice.totalMinor, invoice.dueDate, invoice.invoiceNumber, invoice.totalMinor, body.paidDate, now, invoice.customerId, invoice.customerName, now, now),
    db.prepare("UPDATE invoices SET status = 'paid', paid_at = ?, paid_date = ?, cash_entry_id = ?, updated_at = ? WHERE id = ? AND workspace_id = ? AND status != 'paid' AND cash_entry_id IS NULL").bind(now, body.paidDate, entryId, now, id, user.workspaceId),
  ]);
  if (!results[1].meta.changes) return json({ error: "Invoice is already paid" }, 409);
  return json({ paid: true, cashEntryId: entryId });
}

function escapeHtml(value: unknown): string {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character] ?? character);
}

export async function publicInvoice(request: Request, db: D1Database, publicToken: string): Promise<Response> {
  if (!/^[A-Za-z0-9_-]{40,64}$/.test(publicToken)) return new Response("Invoice not found", { status: 404 });
  const invoice = await db.prepare(
    `SELECT invoices.id, invoice_number AS invoiceNumber, issue_date AS issueDate, due_date AS dueDate,
      invoices.status, invoices.subtotal_minor AS subtotalMinor, invoices.tax_rate_basis_points AS taxRateBasisPoints,
      invoices.tax_minor AS taxMinor, invoices.total_minor AS totalMinor, invoices.notes, parties.name AS customerName,
      workspaces.name AS businessName, workspaces.currency, workspaces.timezone
     FROM invoices JOIN parties ON parties.id = invoices.customer_id JOIN workspaces ON workspaces.id = invoices.workspace_id
     WHERE EXISTS(SELECT 1 FROM invoice_public_tokens WHERE invoice_public_tokens.invoice_id = invoices.id AND invoice_public_tokens.token_hash = ?)
       AND invoices.status IN ('sent', 'paid')`,
  ).bind(await tokenHash(publicToken)).first<Record<string, unknown>>();
  if (!invoice) return new Response("Invoice not found", { status: 404 });
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: String(invoice.timezone), year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  if (invoice.status === "sent" && String(invoice.dueDate) < today) invoice.status = "overdue";
  const items = await db.prepare("SELECT description, quantity_milli AS quantityMilli, unit_price_minor AS unitPriceMinor, amount_minor AS amountMinor FROM invoice_items WHERE invoice_id = ? ORDER BY position").bind(invoice.id).all<Record<string, unknown>>();
  const money = (amount: unknown) => new Intl.NumberFormat("en", { style: "currency", currency: String(invoice.currency) }).format(Number(amount) / 100);
  const rows = items.results.map((item) => `<tr><td>${escapeHtml(item.description)}</td><td>${Number(item.quantityMilli) / 1000}</td><td>${money(item.unitPriceMinor)}</td><td>${money(item.amountMinor)}</td></tr>`).join("");
  const html = `<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Invoice ${escapeHtml(invoice.invoiceNumber)} | Finvayo</title><link rel="stylesheet" href="/assets/invoice.css"></head><body class="invoice-public"><main class="invoice-document"><header><a class="wordmark" href="/"><svg aria-hidden="true" viewBox="0 0 32 32"><path d="M5 24V8h22M8 20l5-5 4 3 8-9" /></svg>Finvayo</a><button onclick="window.print()">Print / save PDF</button></header><section class="invoice-title"><div><p>From</p><h1>${escapeHtml(invoice.businessName)}</h1></div><div><p>Invoice</p><strong>${escapeHtml(invoice.invoiceNumber)}</strong><span>${escapeHtml(invoice.status)}</span></div></section><section class="invoice-meta"><div><span>Bill to</span><strong>${escapeHtml(invoice.customerName)}</strong></div><div><span>Issued</span><strong>${escapeHtml(invoice.issueDate)}</strong></div><div><span>Due</span><strong>${escapeHtml(invoice.dueDate)}</strong></div></section><table><thead><tr><th>Description</th><th>Quantity</th><th>Unit price</th><th>Amount</th></tr></thead><tbody>${rows}</tbody></table><section class="invoice-totals"><div><span>Subtotal</span><strong>${money(invoice.subtotalMinor)}</strong></div><div><span>Tax (${Number(invoice.taxRateBasisPoints) / 100}%)</span><strong>${money(invoice.taxMinor)}</strong></div><div class="invoice-total"><span>Total</span><strong>${money(invoice.totalMinor)}</strong></div></section>${invoice.notes ? `<section class="invoice-notes"><span>Notes</span><p>${escapeHtml(invoice.notes)}</p></section>` : ""}<footer>Issued with Finvayo · Payment is arranged directly with ${escapeHtml(invoice.businessName)}.</footer></main></body></html>`;
  return new Response(html, { headers: { "cache-control": "no-store, private", "content-type": "text/html; charset=utf-8", "referrer-policy": "no-referrer", "x-frame-options": "DENY", "x-robots-tag": "noindex, nofollow" } });
}
