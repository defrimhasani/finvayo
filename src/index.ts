import {
  allowAuthAttempt,
  clearSessionCookie,
  createPassword,
  createSession,
  currentUser,
  normalizeEmail,
  revokeSession,
  sameOrigin,
  sessionCookie,
  validPassword,
  verifyPassword,
} from "./auth";
import { sendWelcomeEmail, type EmailEnv } from "./email";
import { deleteAccount, exportWorkspace, resetPlan } from "./data-controls";
import { calculateScenario, createCashEntry, createCashSnapshot, deleteCashEntry, getFinancials, updateCashEntry } from "./financials";
import { createInvoice, deleteInvoice, getInvoice, listInvoices, markInvoicePaid, publicInvoice, sendInvoice, updateInvoice } from "./invoices";
import { requestPasswordReset, resetPassword, validResetToken } from "./password-reset";
import { createParty, deleteParty, getParties, updateParty } from "./parties";
import { getSettings, updateSettings } from "./settings";
import { billingStatus, createCheckout, createPortal, handleStripeWebhook, type StripeEnv } from "./stripe";
import { completeFollowUp, completeReview, generateFollowUp, getWorkflows } from "./workflows";

const JSON_HEADERS = {
  "cache-control": "no-store",
  "content-type": "application/json; charset=utf-8",
  "x-content-type-options": "nosniff",
} as const;

const PAGE_HEADERS = {
  "cache-control": "no-store, private",
  "referrer-policy": "strict-origin-when-cross-origin",
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
} as const;

function redirect(request: Request, path: string, cookie?: string): Response {
  const headers = new Headers({ location: new URL(path, request.url).toString(), ...PAGE_HEADERS });
  if (cookie) headers.set("set-cookie", cookie);
  return new Response(null, { status: 303, headers });
}

function displayName(email: string): string {
  const local = email.split("@")[0].replace(/[._-]+/g, " ").trim();
  if (!local) return "there";
  return local.replace(/\b\w/g, (character) => character.toUpperCase()).slice(0, 40);
}

function serializedBootstrap(value: unknown): string {
  return JSON.stringify(value).replaceAll("<", "\\u003c").replaceAll("\u2028", "\\u2028").replaceAll("\u2029", "\\u2029");
}

async function renderReact(request: Request, env: Env, bootstrap: Record<string, unknown> = {}): Promise<Response> {
  const template = await (await env.ASSETS.fetch(new URL("/index.html", request.url))).text();
  const html = template.replace("</head>", `<script>window.__FINVAYO__=${serializedBootstrap(bootstrap)}</script></head>`);
  return new Response(html, { headers: { ...PAGE_HEADERS, "content-type": "text/html; charset=utf-8" } });
}

async function renderApp(request: Request, env: Env, preview: boolean): Promise<Response> {
  const user = preview ? null : await currentUser(request, env.DB);
  if (!preview && !user) return redirect(request, "/login?next=/app");
  return renderReact(request, env, {
    page: "app",
    preview,
    user: user ? {
      email: user.email,
      workspaceName: user.workspaceName,
      displayName: displayName(user.email),
      trialDays: Math.max(0, Math.ceil((user.trialEndsAt - Date.now() / 1000) / 86_400)),
    } : undefined,
  });
}

async function renderAuthenticatedPage(request: Request, env: Env, page: string): Promise<Response> {
  const user = await currentUser(request, env.DB);
  const url = new URL(request.url);
  if (!user) return redirect(request, `/login?next=${url.pathname}${url.search}`);
  return renderReact(request, env, {
    page,
    user: {
      email: user.email,
      workspaceName: user.workspaceName,
      displayName: displayName(user.email),
      trialDays: Math.max(0, Math.ceil((user.trialEndsAt - Date.now() / 1000) / 86_400)),
    },
  });
}

async function handleSignup(request: Request, env: Env): Promise<Response> {
  if (!sameOrigin(request)) return new Response("Forbidden", { status: 403, headers: PAGE_HEADERS });
  const form = await request.formData();
  const email = normalizeEmail(form.get("email"));
  if (!(await allowAuthAttempt(request, env.DB, `signup:${email ?? "invalid"}`))) return redirect(request, "/signup?error=rate");
  const password = form.get("password");
  const acceptedTerms = form.get("terms") === "on";
  if (!email || !validPassword(password) || !acceptedTerms) return redirect(request, "/signup?error=invalid");

  const existing = await env.DB.prepare("SELECT id FROM users WHERE email = ?").bind(email).first();
  if (existing) return redirect(request, "/login?error=exists");

  const now = Math.floor(Date.now() / 1000);
  const userId = crypto.randomUUID();
  const workspaceId = crypto.randomUUID();
  const passwordRecord = await createPassword(password);
  const workspaceName = `${displayName(email)}'s workspace`;

  try {
    await env.DB.batch([
      env.DB
        .prepare("INSERT INTO users (id, email, password_hash, password_salt, password_iterations, created_at) VALUES (?, ?, ?, ?, 100000, ?)")
        .bind(userId, email, passwordRecord.hash, passwordRecord.salt, now),
      env.DB
        .prepare(
          "INSERT INTO workspaces (id, owner_user_id, name, currency, timezone, trial_ends_at, created_at) VALUES (?, ?, ?, 'USD', 'UTC', ?, ?)",
        )
        .bind(workspaceId, userId, workspaceName, now + 14 * 86_400, now),
      env.DB
        .prepare("INSERT INTO subscriptions (workspace_id, status, created_at, updated_at) VALUES (?, 'trialing', ?, ?)")
        .bind(workspaceId, now, now),
    ]);
  } catch {
    return redirect(request, "/signup?error=unavailable");
  }

  const session = await createSession(env.DB, userId);
  try {
    await sendWelcomeEmail(env as EmailEnv, email);
  } catch (error) {
    console.error("Welcome email failed", { error: error instanceof Error ? error.message : String(error) });
  }
  return redirect(request, "/app", sessionCookie(session));
}

async function handleLogin(request: Request, env: Env): Promise<Response> {
  if (!sameOrigin(request)) return new Response("Forbidden", { status: 403, headers: PAGE_HEADERS });
  const form = await request.formData();
  const email = normalizeEmail(form.get("email"));
  if (!(await allowAuthAttempt(request, env.DB, `login:${email ?? "invalid"}`))) return redirect(request, "/login?error=rate");
  const password = form.get("password");
  if (!email || typeof password !== "string") return redirect(request, "/login?error=invalid");

  const user = await env.DB
    .prepare(
      `SELECT id, password_hash AS passwordHash, password_salt AS passwordSalt,
        password_iterations AS passwordIterations FROM users WHERE email = ?`,
    )
    .bind(email)
    .first<{ id: string; passwordHash: string; passwordSalt: string; passwordIterations: number }>();
  if (!user || !(await verifyPassword(password, user.passwordHash, user.passwordSalt, user.passwordIterations))) {
    return redirect(request, "/login?error=credentials");
  }
  if (user.passwordIterations !== 100_000) {
    const upgraded = await createPassword(password);
    await env.DB
      .prepare("UPDATE users SET password_hash = ?, password_salt = ?, password_iterations = 100000 WHERE id = ?")
      .bind(upgraded.hash, upgraded.salt, user.id)
      .run();
  }
  return redirect(request, "/app", sessionCookie(await createSession(env.DB, user.id)));
}

async function handleRequest(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const appPath = url.pathname.replace(/\/+$/, "") || "/";

  if (url.pathname === "/health") {
    if (request.method !== "GET" && request.method !== "HEAD") {
      return Response.json(
        { error: "Method not allowed" },
        { status: 405, headers: { ...JSON_HEADERS, allow: "GET, HEAD" } },
      );
    }

    return Response.json(
      {
        status: "ok",
        service: "finvayo",
      },
      { headers: JSON_HEADERS },
    );
  }

  if (url.pathname === "/auth/signup" && request.method === "POST") return handleSignup(request, env);
  if (url.pathname === "/auth/login" && request.method === "POST") return handleLogin(request, env);
  if (url.pathname === "/auth/forgot-password" && request.method === "POST") {
    return requestPasswordReset(request, env as EmailEnv);
  }
  if (url.pathname === "/auth/reset-password" && request.method === "POST") {
    return resetPassword(request, env as EmailEnv);
  }
  if (url.pathname === "/auth/logout" && request.method === "POST") {
    if (!sameOrigin(request)) return new Response("Forbidden", { status: 403, headers: PAGE_HEADERS });
    await revokeSession(request, env.DB);
    return redirect(request, "/login", clearSessionCookie);
  }

  if (url.pathname === "/api/stripe/webhook" && request.method === "POST") {
    return handleStripeWebhook(request, env as StripeEnv);
  }

  if (["/login", "/login/", "/signup", "/signup/", "/forgot-password", "/forgot-password/"].includes(url.pathname)) {
    return renderReact(request, env, { page: url.pathname.split("/")[1] });
  }

  if (url.pathname.startsWith("/api/") && request.method !== "GET" && !sameOrigin(request)) {
    return Response.json({ error: "Forbidden" }, { status: 403, headers: JSON_HEADERS });
  }

  if (url.pathname === "/api/financials" && request.method === "GET") return getFinancials(request, env.DB);
  if (url.pathname === "/api/cash-snapshots" && request.method === "POST") return createCashSnapshot(request, env.DB);
  if (url.pathname === "/api/scenarios" && request.method === "POST") return calculateScenario(request, env.DB);
  if (url.pathname === "/api/invoices" && request.method === "GET") return listInvoices(request, env.DB);
  if (url.pathname === "/api/invoices" && request.method === "POST") return createInvoice(request, env.DB);
  const invoiceActionMatch = url.pathname.match(/^\/api\/invoices\/([0-9a-f-]+)\/(send|paid)$/i);
  if (invoiceActionMatch && request.method === "POST" && invoiceActionMatch[2] === "send") return sendInvoice(request, env as EmailEnv, invoiceActionMatch[1]);
  if (invoiceActionMatch && request.method === "POST" && invoiceActionMatch[2] === "paid") return markInvoicePaid(request, env.DB, invoiceActionMatch[1]);
  const invoiceMatch = url.pathname.match(/^\/api\/invoices\/([0-9a-f-]+)$/i);
  if (invoiceMatch && request.method === "GET") return getInvoice(request, env.DB, invoiceMatch[1]);
  if (invoiceMatch && request.method === "PATCH") return updateInvoice(request, env.DB, invoiceMatch[1]);
  if (invoiceMatch && request.method === "DELETE") return deleteInvoice(request, env.DB, invoiceMatch[1]);
  if (url.pathname === "/api/cash-entries" && request.method === "POST") return createCashEntry(request, env.DB);
  const cashEntryMatch = url.pathname.match(/^\/api\/cash-entries\/([0-9a-f-]+)$/i);
  if (cashEntryMatch && request.method === "PATCH") return updateCashEntry(request, env.DB, cashEntryMatch[1]);
  if (cashEntryMatch && request.method === "DELETE") return deleteCashEntry(request, env.DB, cashEntryMatch[1]);
  if (url.pathname === "/api/parties" && request.method === "GET") return getParties(request, env.DB);
  if (url.pathname === "/api/parties" && request.method === "POST") return createParty(request, env.DB);
  const partyMatch = url.pathname.match(/^\/api\/parties\/([0-9a-f-]+)$/i);
  if (partyMatch && request.method === "PATCH") return updateParty(request, env.DB, partyMatch[1]);
  if (partyMatch && request.method === "DELETE") return deleteParty(request, env.DB, partyMatch[1]);
  if (url.pathname === "/api/settings" && request.method === "GET") return getSettings(request, env.DB);
  if (url.pathname === "/api/settings" && request.method === "PATCH") return updateSettings(request, env.DB);
  if (url.pathname === "/api/export" && request.method === "GET") return exportWorkspace(request, env.DB);
  if (url.pathname === "/api/plan/reset" && request.method === "POST") return resetPlan(request, env.DB);
  if (url.pathname === "/api/account" && request.method === "DELETE") return deleteAccount(request, env.DB);
  if (url.pathname === "/api/workflows" && request.method === "GET") return getWorkflows(request, env.DB);
  if (url.pathname === "/api/weekly-reviews" && request.method === "POST") return completeReview(request, env.DB);
  if (url.pathname === "/api/follow-ups/preview" && request.method === "POST") return generateFollowUp(request, env.DB);
  if (url.pathname === "/api/follow-ups" && request.method === "POST") return completeFollowUp(request, env.DB);
  if (url.pathname === "/api/billing" && request.method === "GET") return billingStatus(request, env as StripeEnv);
  if (url.pathname === "/api/billing/checkout" && request.method === "POST") return createCheckout(request, env as StripeEnv);
  if (url.pathname === "/api/billing/portal" && request.method === "POST") return createPortal(request, env as StripeEnv);

  if (url.pathname.startsWith("/api/")) {
    return Response.json({ error: "Not found" }, { status: 404, headers: JSON_HEADERS });
  }

  if (appPath === "/app") {
    return renderApp(request, env, false);
  }

  if (appPath === "/app/preview") {
    return renderApp(request, env, true);
  }

  const appPages: Record<string, string> = {
    "/app/transactions": "transactions",
    "/app/parties": "parties",
    "/app/invoices": "invoices",
    "/app/cash-plan": "cash-plan",
    "/app/scenarios": "scenarios",
    "/app/reviews": "reviews",
    "/app/settings": "settings",
  };
  if (appPages[appPath]) return renderAuthenticatedPage(request, env, appPages[appPath]);

  const publicInvoiceMatch = url.pathname.match(/^\/invoice\/([A-Za-z0-9_-]+)$/);
  if (publicInvoiceMatch && request.method === "GET") return publicInvoice(request, env.DB, publicInvoiceMatch[1]);

  if (url.pathname === "/reset-password" || url.pathname === "/reset-password/") {
    const token = url.searchParams.get("token");
    if (!(await validResetToken(env.DB, token))) return redirect(request, "/forgot-password?error=expired");
    return renderReact(request, env, { page: "reset-password", resetToken: token });
  }

  const response = await env.ASSETS.fetch(request);

  if (
    url.pathname.startsWith("/login") ||
    url.pathname.startsWith("/signup") ||
    url.pathname.startsWith("/forgot-password") ||
    url.pathname.startsWith("/reset-password") ||
    url.pathname.startsWith("/app/")
  ) {
    const headers = new Headers(response.headers);
    for (const [name, value] of Object.entries(PAGE_HEADERS)) headers.set(name, value);
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
  }

  return response;
}

export default {
  async fetch(request, env): Promise<Response> {
    try {
      return await handleRequest(request, env);
    } catch (error) {
      const url = new URL(request.url);
      console.error("Unhandled request error", {
        error: error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : String(error),
        method: request.method,
        pathname: url.pathname,
        rayId: request.headers.get("cf-ray"),
      });
      if (url.pathname.startsWith("/api/")) {
        return Response.json({ error: "Service temporarily unavailable" }, { status: 503, headers: JSON_HEADERS });
      }
      return new Response("Service temporarily unavailable", { status: 503, headers: PAGE_HEADERS });
    }
  },
} satisfies ExportedHandler<Env>;
