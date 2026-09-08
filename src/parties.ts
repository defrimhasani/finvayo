import { currentUser } from "./auth";

const JSON_HEADERS = { "cache-control": "no-store", "content-type": "application/json; charset=utf-8" } as const;
const ROLES = new Set(["customer", "supplier", "both"]);

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

function optionalText(value: unknown, maximum: number): string | null | undefined {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" || value.trim().length > maximum) return undefined;
  return value.trim();
}

function validParty(input: Record<string, unknown>): string | null {
  if (typeof input.name !== "string" || input.name.trim().length < 1 || input.name.trim().length > 120) return "Invalid name";
  if (typeof input.role !== "string" || !ROLES.has(input.role)) return "Invalid role";
  if (optionalText(input.email, 254) === undefined) return "Invalid email";
  if (optionalText(input.phone, 40) === undefined) return "Invalid phone";
  if (optionalText(input.notes, 500) === undefined) return "Invalid notes";
  return null;
}

export async function getParties(request: Request, db: D1Database): Promise<Response> {
  const user = await currentUser(request, db);
  if (!user) return json({ error: "Unauthorized" }, 401);
  const parties = await db
    .prepare(
      `SELECT id, name, role, email, phone, notes, created_at AS createdAt, updated_at AS updatedAt
       FROM parties WHERE workspace_id = ? ORDER BY name COLLATE NOCASE, created_at`,
    )
    .bind(user.workspaceId)
    .all();
  return json({ parties: parties.results });
}

export async function createParty(request: Request, db: D1Database): Promise<Response> {
  const user = await currentUser(request, db);
  if (!user) return json({ error: "Unauthorized" }, 401);
  const input = await jsonObject(request);
  if (!input) return json({ error: "Invalid JSON body" }, 400);
  const error = validParty(input);
  if (error) return json({ error }, 400);

  const id = crypto.randomUUID();
  const now = Math.floor(Date.now() / 1000);
  await db
    .prepare(
      `INSERT INTO parties (id, workspace_id, name, role, email, phone, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      id,
      user.workspaceId,
      String(input.name).trim(),
      input.role,
      optionalText(input.email, 254),
      optionalText(input.phone, 40),
      optionalText(input.notes, 500),
      now,
      now,
    )
    .run();
  return json({ id }, 201);
}

export async function deleteParty(request: Request, db: D1Database, id: string): Promise<Response> {
  const user = await currentUser(request, db);
  if (!user) return json({ error: "Unauthorized" }, 401);
  const result = await db.prepare("DELETE FROM parties WHERE id = ? AND workspace_id = ?").bind(id, user.workspaceId).run();
  return result.meta.changes ? new Response(null, { status: 204 }) : json({ error: "Not found" }, 404);
}

export async function updateParty(request: Request, db: D1Database, id: string): Promise<Response> {
  const user = await currentUser(request, db);
  if (!user) return json({ error: "Unauthorized" }, 401);
  const input = await jsonObject(request);
  if (!input) return json({ error: "Invalid JSON body" }, 400);
  const existing = await db.prepare("SELECT name, role, email, phone, notes FROM parties WHERE id = ? AND workspace_id = ?").bind(id, user.workspaceId).first<Record<string, unknown>>();
  if (!existing) return json({ error: "Not found" }, 404);
  const merged = { ...existing, ...input };
  const error = validParty(merged);
  if (error) return json({ error }, 400);
  const now = Math.floor(Date.now() / 1000);
  const result = await db
    .prepare("UPDATE parties SET name = ?, role = ?, email = ?, phone = ?, notes = ?, updated_at = ? WHERE id = ? AND workspace_id = ?")
    .bind(String(merged.name).trim(), merged.role, optionalText(merged.email, 254), optionalText(merged.phone, 40), optionalText(merged.notes, 500), now, id, user.workspaceId)
    .run();
  return result.meta.changes ? json({ id }) : json({ error: "Not found" }, 404);
}
