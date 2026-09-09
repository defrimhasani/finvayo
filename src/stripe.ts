import { currentUser } from "./auth";

export type StripeEnv = Env & {
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  STRIPE_MONTHLY_PRICE_ID?: string;
  STRIPE_ANNUAL_PRICE_ID?: string;
};

type StripeObject = Record<string, unknown> & { id: string };
type StripeEvent = {
  id: string;
  type: string;
  created: number;
  livemode: boolean;
  data: { object: StripeObject };
};

const JSON_HEADERS = { "cache-control": "no-store", "content-type": "application/json; charset=utf-8" } as const;
const SUBSCRIPTION_STATUSES = new Set(["trialing", "incomplete", "incomplete_expired", "active", "past_due", "unpaid", "paused", "canceled"]);

function testSecretKey(value: string | undefined): value is string {
  return value?.startsWith("sk_test_") === true || value?.startsWith("rk_test_") === true;
}

function json(data: unknown, status = 200): Response {
  return Response.json(data, { status, headers: JSON_HEADERS });
}

async function stripePost(env: StripeEnv, path: string, parameters: Record<string, string>, idempotencyKey?: string): Promise<StripeObject> {
  if (!testSecretKey(env.STRIPE_SECRET_KEY)) throw new Error("Stripe test mode is not configured");
  const headers: Record<string, string> = {
    authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
    "content-type": "application/x-www-form-urlencoded",
  };
  if (idempotencyKey) headers["idempotency-key"] = idempotencyKey;
  const response = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: "POST",
    headers,
    body: new URLSearchParams(parameters),
  });
  const result = (await response.json()) as StripeObject & { error?: { message?: string } };
  if (!response.ok) throw new Error(result.error?.message ?? "Stripe request failed");
  return result;
}

async function stripeGet(env: StripeEnv, path: string): Promise<StripeObject> {
  if (!testSecretKey(env.STRIPE_SECRET_KEY)) throw new Error("Stripe test mode is not configured");
  const response = await fetch(`https://api.stripe.com/v1/${path}`, {
    headers: { authorization: `Bearer ${env.STRIPE_SECRET_KEY}` },
  });
  const result = (await response.json()) as StripeObject & { error?: { message?: string } };
  if (!response.ok) throw new Error(result.error?.message ?? "Stripe request failed");
  return result;
}

async function ensureCustomer(env: StripeEnv, workspaceId: string, email: string): Promise<string> {
  const subscription = await env.DB
    .prepare("SELECT stripe_customer_id AS stripeCustomerId FROM subscriptions WHERE workspace_id = ?")
    .bind(workspaceId)
    .first<{ stripeCustomerId: string | null }>();
  if (subscription?.stripeCustomerId) return subscription.stripeCustomerId;

  const customer = await stripePost(
    env,
    "customers",
    { email, "metadata[workspace_id]": workspaceId },
    `customer:${workspaceId}`,
  );
  const now = Math.floor(Date.now() / 1000);
  await env.DB
    .prepare(
      `INSERT INTO subscriptions (workspace_id, stripe_customer_id, status, created_at, updated_at)
       VALUES (?, ?, 'trialing', ?, ?)
       ON CONFLICT(workspace_id) DO UPDATE SET stripe_customer_id = excluded.stripe_customer_id, updated_at = excluded.updated_at`,
    )
    .bind(workspaceId, customer.id, now, now)
    .run();
  return customer.id;
}

export async function billingStatus(request: Request, env: StripeEnv): Promise<Response> {
  const user = await currentUser(request, env.DB);
  if (!user) return json({ error: "Unauthorized" }, 401);
  const subscription = await env.DB
    .prepare(
      `SELECT status, stripe_price_id AS stripePriceId, current_period_end AS currentPeriodEnd,
        cancel_at_period_end AS cancelAtPeriodEnd, manual_access_enabled AS manualAccessEnabled,
        manual_access_note AS manualAccessNote
       FROM subscriptions WHERE workspace_id = ?`,
    )
    .bind(user.workspaceId)
    .first();
  if (subscription?.manualAccessEnabled) {
    return json({ subscription: { ...subscription, status: "active", accessSource: "manual" }, trialEndsAt: user.trialEndsAt });
  }
  return json({ subscription: { ...(subscription ?? { status: "trialing" }), accessSource: "stripe" }, trialEndsAt: user.trialEndsAt });
}

export async function createCheckout(request: Request, env: StripeEnv): Promise<Response> {
  const user = await currentUser(request, env.DB);
  if (!user) return json({ error: "Unauthorized" }, 401);
  let input: { interval?: unknown };
  try {
    const value: unknown = await request.json();
    if (value === null || typeof value !== "object" || Array.isArray(value)) throw new Error();
    input = value;
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }
  const priceId = input.interval === "annual" ? env.STRIPE_ANNUAL_PRICE_ID : input.interval === "monthly" ? env.STRIPE_MONTHLY_PRICE_ID : null;
  if (!priceId?.startsWith("price_")) return json({ error: "Stripe test pricing is not configured" }, 503);

  const customerId = await ensureCustomer(env, user.workspaceId, user.email);
  const now = Math.floor(Date.now() / 1000);
  const pendingToken = crypto.randomUUID();
  const reserved = await env.DB
    .prepare(
      `UPDATE subscriptions SET pending_checkout_token = ?, pending_checkout_expires_at = ?, updated_at = ?
       WHERE workspace_id = ?
         AND status NOT IN ('active', 'past_due', 'unpaid', 'paused', 'incomplete')
         AND (pending_checkout_expires_at IS NULL OR pending_checkout_expires_at < ?)`,
    )
    .bind(pendingToken, now + 1800, now, user.workspaceId, now)
    .run();
  if (!reserved.meta.changes) return json({ error: "A subscription or Checkout session already exists" }, 409);

  const origin = new URL(request.url).origin;
  try {
    const session = await stripePost(
      env,
      "checkout/sessions",
      {
        mode: "subscription",
        customer: customerId,
        "line_items[0][price]": priceId,
        "line_items[0][quantity]": "1",
        success_url: `${origin}/app/settings?billing=confirming`,
        cancel_url: `${origin}/app/settings?billing=canceled`,
        client_reference_id: user.workspaceId,
        "metadata[workspace_id]": user.workspaceId,
        "subscription_data[metadata][workspace_id]": user.workspaceId,
      },
      `checkout:${user.workspaceId}:${pendingToken}`,
    );
    if (typeof session.url !== "string") throw new Error("Stripe Checkout did not return a URL");
    await env.DB
      .prepare("UPDATE subscriptions SET pending_checkout_session_id = ? WHERE workspace_id = ? AND pending_checkout_token = ?")
      .bind(session.id, user.workspaceId, pendingToken)
      .run();
    return json({ url: session.url }, 201);
  } catch (error) {
    await env.DB
      .prepare(
        "UPDATE subscriptions SET pending_checkout_token = NULL, pending_checkout_expires_at = NULL WHERE workspace_id = ? AND pending_checkout_token = ?",
      )
      .bind(user.workspaceId, pendingToken)
      .run();
    throw error;
  }
}

export async function createPortal(request: Request, env: StripeEnv): Promise<Response> {
  const user = await currentUser(request, env.DB);
  if (!user) return json({ error: "Unauthorized" }, 401);
  const subscription = await env.DB
    .prepare("SELECT stripe_customer_id AS stripeCustomerId FROM subscriptions WHERE workspace_id = ?")
    .bind(user.workspaceId)
    .first<{ stripeCustomerId: string | null }>();
  if (!subscription?.stripeCustomerId) return json({ error: "No billing account exists" }, 409);
  const session = await stripePost(env, "billing_portal/sessions", {
    customer: subscription.stripeCustomerId,
    return_url: `${new URL(request.url).origin}/app/settings`,
  });
  if (typeof session.url !== "string") throw new Error("Stripe Portal did not return a URL");
  return json({ url: session.url }, 201);
}

function hexBytes(value: string): Uint8Array<ArrayBuffer> | null {
  if (!/^[0-9a-f]{64}$/i.test(value)) return null;
  return Uint8Array.from(value.match(/../g) ?? [], (pair) => Number.parseInt(pair, 16));
}

async function verifiedEvent(request: Request, secret: string): Promise<StripeEvent> {
  const signatureHeader = request.headers.get("stripe-signature");
  if (!signatureHeader) throw new Error("Missing Stripe signature");
  let timestamp: string | undefined;
  const signatures: string[] = [];
  for (const part of signatureHeader.split(",")) {
    const [name, value] = part.trim().split("=", 2);
    if (name === "t" && !timestamp) timestamp = value;
    if (name === "v1" && value) signatures.push(value);
  }
  if (!timestamp || !/^\d+$/.test(timestamp) || signatures.length === 0) throw new Error("Malformed Stripe signature");
  const eventTime = Number(timestamp);
  if (!Number.isSafeInteger(eventTime) || Math.abs(Math.floor(Date.now() / 1000) - eventTime) > 300) {
    throw new Error("Expired Stripe signature");
  }

  const body = new Uint8Array(await request.arrayBuffer());
  const prefix = new TextEncoder().encode(`${timestamp}.`);
  const payload = new Uint8Array(prefix.length + body.length);
  payload.set(prefix);
  payload.set(body, prefix.length);
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
  for (const signature of signatures) {
    const bytes = hexBytes(signature);
    if (bytes && (await crypto.subtle.verify("HMAC", key, bytes, payload))) {
      return JSON.parse(new TextDecoder().decode(body)) as StripeEvent;
    }
  }
  throw new Error("Invalid Stripe signature");
}

function stringId(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "id" in value && typeof value.id === "string") return value.id;
  return null;
}

async function workspaceForObject(db: D1Database, object: StripeObject): Promise<string | null> {
  const metadata = object.metadata as Record<string, unknown> | undefined;
  const direct = metadata?.workspace_id ?? object.client_reference_id;
  if (typeof direct === "string") return direct;
  const customerId = stringId(object.customer);
  if (!customerId) return null;
  const row = await db
    .prepare("SELECT workspace_id AS workspaceId FROM subscriptions WHERE stripe_customer_id = ?")
    .bind(customerId)
    .first<{ workspaceId: string }>();
  return row?.workspaceId ?? null;
}

async function applyEvent(env: StripeEnv, event: StripeEvent): Promise<void> {
  let object = event.data.object;
  const db = env.DB;
  const workspaceId = await workspaceForObject(db, object);
  if (!workspaceId) return;
  const now = Math.floor(Date.now() / 1000);

  if (event.type === "checkout.session.completed") {
    await db
      .prepare(
        `UPDATE subscriptions SET stripe_customer_id = COALESCE(?, stripe_customer_id),
          stripe_subscription_id = COALESCE(stripe_subscription_id, ?), pending_checkout_token = NULL,
          pending_checkout_session_id = NULL, pending_checkout_expires_at = NULL, updated_at = ?
         WHERE workspace_id = ? AND (pending_checkout_session_id IS NULL OR pending_checkout_session_id = ?)`,
      )
      .bind(stringId(object.customer), stringId(object.subscription), now, workspaceId, object.id)
      .run();
    return;
  }

  if (!event.type.startsWith("customer.subscription.")) return;
  object = await stripeGet(env, `subscriptions/${encodeURIComponent(object.id)}`);
  const status = event.type === "customer.subscription.deleted" ? "canceled" : object.status;
  if (typeof status !== "string" || !SUBSCRIPTION_STATUSES.has(status)) return;
  const items = object.items as { data?: Array<{ price?: { id?: string }; current_period_end?: number }> } | undefined;
  const item = items?.data?.[0];
  await db
    .prepare(
      `UPDATE subscriptions SET stripe_customer_id = COALESCE(?, stripe_customer_id), stripe_subscription_id = ?,
        stripe_price_id = ?, status = ?, current_period_end = ?, cancel_at_period_end = ?,
        pending_checkout_token = NULL, pending_checkout_session_id = NULL, pending_checkout_expires_at = NULL,
        stripe_updated_at = MAX(stripe_updated_at, ?), updated_at = ?
       WHERE workspace_id = ?`,
    )
    .bind(
      stringId(object.customer),
      object.id,
      item?.price?.id ?? null,
      status,
      item?.current_period_end ?? object.current_period_end ?? null,
      object.cancel_at_period_end === true ? 1 : 0,
      event.created,
      now,
      workspaceId,
    )
    .run();
}

export async function handleStripeWebhook(request: Request, env: StripeEnv): Promise<Response> {
  if (!env.STRIPE_WEBHOOK_SECRET?.startsWith("whsec_")) return json({ error: "Stripe webhook is not configured" }, 503);
  let event: StripeEvent;
  try {
    event = await verifiedEvent(request, env.STRIPE_WEBHOOK_SECRET);
  } catch {
    return json({ error: "Invalid webhook signature" }, 400);
  }
  if (event.livemode) return json({ error: "Live Stripe events are disabled" }, 400);

  const now = Math.floor(Date.now() / 1000);
  const existing = await env.DB
    .prepare("SELECT status FROM billing_events WHERE stripe_event_id = ?")
    .bind(event.id)
    .first<{ status: string }>();
  if (existing?.status === "completed") return json({ received: true });

  await env.DB
    .prepare(
      `INSERT INTO billing_events
       (stripe_event_id, event_type, stripe_created_at, livemode, status, attempts, received_at)
       VALUES (?, ?, ?, 0, 'received', 1, ?)
       ON CONFLICT(stripe_event_id) DO UPDATE SET status = 'received', attempts = attempts + 1, error = NULL`,
    )
    .bind(event.id, event.type, event.created, now)
    .run();
  try {
    await applyEvent(env, event);
    await env.DB
      .prepare("UPDATE billing_events SET status = 'completed', processed_at = ? WHERE stripe_event_id = ?")
      .bind(now, event.id)
      .run();
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 500) : "Webhook processing failed";
    await env.DB
      .prepare("UPDATE billing_events SET status = 'failed', error = ? WHERE stripe_event_id = ?")
      .bind(message, event.id)
      .run();
    return json({ error: "Webhook processing failed" }, 500);
  }
  return json({ received: true });
}
