import { currentUser, type AuthUser } from "./auth";

const JSON_HEADERS = { "cache-control": "no-store", "content-type": "application/json; charset=utf-8" };

function json(value: unknown, status = 200): Response {
  return Response.json(value, { status, headers: JSON_HEADERS });
}

async function platformAdmin(request: Request, db: D1Database): Promise<AuthUser | Response> {
  const user = await currentUser(request, db);
  if (!user) return json({ error: "Unauthorized" }, 401);
  if (!user.isPlatformAdmin) return json({ error: "Forbidden" }, 403);
  return user;
}

export async function listAdminWorkspaces(request: Request, db: D1Database): Promise<Response> {
  const auth = await platformAdmin(request, db);
  if (auth instanceof Response) return auth;
  const query = new URL(request.url).searchParams.get("q")?.trim().slice(0, 100) ?? "";
  const result = await db.prepare(
    `SELECT workspaces.id, workspaces.name, workspaces.currency, workspaces.created_at AS createdAt,
      users.email AS ownerEmail, subscriptions.status AS stripeStatus,
      subscriptions.stripe_subscription_id AS stripeSubscriptionId,
      subscriptions.manual_access_enabled AS manualAccessEnabled,
      subscriptions.manual_access_note AS manualAccessNote,
      subscriptions.manual_access_updated_at AS manualAccessUpdatedAt,
      admin.email AS manualAccessUpdatedBy
     FROM workspaces
     JOIN users ON users.id = workspaces.owner_user_id
     JOIN subscriptions ON subscriptions.workspace_id = workspaces.id
     LEFT JOIN users admin ON admin.id = subscriptions.manual_access_updated_by
     WHERE (? = '' OR instr(lower(workspaces.name), lower(?)) > 0 OR instr(lower(users.email), lower(?)) > 0)
     ORDER BY workspaces.created_at DESC
     LIMIT 200`,
  ).bind(query, query, query).all();
  return json({ workspaces: result.results });
}

export async function updateAdminSubscription(request: Request, db: D1Database, workspaceId: string): Promise<Response> {
  const auth = await platformAdmin(request, db);
  if (auth instanceof Response) return auth;
  let input: { enabled?: unknown; note?: unknown };
  try {
    const value: unknown = await request.json();
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error();
    input = value;
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }
  if (typeof input.enabled !== "boolean") return json({ error: "Enabled must be true or false" }, 400);
  if (input.note !== undefined && input.note !== null && typeof input.note !== "string") return json({ error: "Note must be text" }, 400);
  const note = typeof input.note === "string" ? input.note.trim() : "";
  if (note.length > 500) return json({ error: "Note must be 500 characters or fewer" }, 400);
  const now = Math.floor(Date.now() / 1000);
  const updated = await db.prepare(
    `UPDATE subscriptions SET manual_access_enabled = ?, manual_access_note = ?,
      manual_access_updated_at = ?, manual_access_updated_by = ?, updated_at = ?
     WHERE workspace_id = ?`,
  ).bind(input.enabled ? 1 : 0, note || null, now, auth.id, now, workspaceId).run();
  if (!updated.meta.changes) return json({ error: "Workspace not found" }, 404);
  await db.prepare(
    `INSERT INTO admin_subscription_changes
      (id, workspace_id, admin_user_id, manual_access_enabled, note, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).bind(crypto.randomUUID(), workspaceId, auth.id, input.enabled ? 1 : 0, note || null, now).run();
  return json({ updated: true, manualAccessEnabled: input.enabled });
}
