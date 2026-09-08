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

function safeText(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
    return entities[character];
  });
}

function displayName(email: string): string {
  const local = email.split("@")[0].replace(/[._-]+/g, " ").trim();
  if (!local) return "there";
  return local.replace(/\b\w/g, (character) => character.toUpperCase()).slice(0, 40);
}

async function renderApp(request: Request, env: Env, preview: boolean): Promise<Response> {
  const user = preview ? null : await currentUser(request, env.DB);
  if (!preview && !user) return redirect(request, "/login?next=/app");

  const templateUrl = new URL("/app-shell.html", request.url);
  const template = await (await env.ASSETS.fetch(templateUrl)).text();
  const name = user ? displayName(user.email) : "Alex";
  const workspace = user?.workspaceName ?? "Demo workspace";
  const accountLabel = user?.email ?? "Sample data";
  const trialDays = user ? Math.max(0, Math.ceil((user.trialEndsAt - Date.now() / 1000) / 86_400)) : 0;
  const banner = preview
    ? `<div class="preview-banner"><span>Product preview</span><p>This workspace uses sample data. Create your own workspace in a few seconds.</p><a href="/signup">Start free</a></div>`
    : `<div class="preview-banner account-banner"><span>${trialDays} days left in trial</span><p>Your workspace is ready. Add real cash data to replace this guided example.</p><a href="#setup">Start setup</a></div>`;
  const exit = preview
    ? `<a href="/login"><span aria-hidden="true">↪</span> Leave preview</a>`
    : `<form class="logout-form" action="/auth/logout" method="post"><button type="submit"><span aria-hidden="true">↪</span> Sign out</button></form>`;
  const html = template
    .replaceAll("{{ROBOTS}}", preview ? '<meta name="robots" content="noindex" />' : '<meta name="robots" content="noindex, noarchive" />')
    .replaceAll("{{BANNER}}", banner)
    .replaceAll("{{NAME}}", safeText(name))
    .replaceAll("{{WORKSPACE}}", safeText(workspace))
    .replaceAll("{{ACCOUNT_LABEL}}", safeText(accountLabel))
    .replaceAll("{{EXIT}}", exit);
  return new Response(html, { headers: { ...PAGE_HEADERS, "content-type": "text/html; charset=utf-8" } });
}

async function handleSignup(request: Request, env: Env): Promise<Response> {
  if (!sameOrigin(request)) return new Response("Forbidden", { status: 403, headers: PAGE_HEADERS });
  if (!(await allowAuthAttempt(request, env.DB, "signup"))) return redirect(request, "/signup?error=rate");
  const form = await request.formData();
  const email = normalizeEmail(form.get("email"));
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
        .prepare("INSERT INTO users (id, email, password_hash, password_salt, created_at) VALUES (?, ?, ?, ?, ?)")
        .bind(userId, email, passwordRecord.hash, passwordRecord.salt, now),
      env.DB
        .prepare(
          "INSERT INTO workspaces (id, owner_user_id, name, currency, timezone, trial_ends_at, created_at) VALUES (?, ?, ?, 'USD', 'UTC', ?, ?)",
        )
        .bind(workspaceId, userId, workspaceName, now + 14 * 86_400, now),
    ]);
  } catch {
    return redirect(request, "/signup?error=unavailable");
  }

  return redirect(request, "/app", sessionCookie(await createSession(env.DB, userId)));
}

async function handleLogin(request: Request, env: Env): Promise<Response> {
  if (!sameOrigin(request)) return new Response("Forbidden", { status: 403, headers: PAGE_HEADERS });
  if (!(await allowAuthAttempt(request, env.DB, "login"))) return redirect(request, "/login?error=rate");
  const form = await request.formData();
  const email = normalizeEmail(form.get("email"));
  const password = form.get("password");
  if (!email || typeof password !== "string") return redirect(request, "/login?error=invalid");

  const user = await env.DB
    .prepare("SELECT id, password_hash AS passwordHash, password_salt AS passwordSalt FROM users WHERE email = ?")
    .bind(email)
    .first<{ id: string; passwordHash: string; passwordSalt: string }>();
  if (!user || !(await verifyPassword(password, user.passwordHash, user.passwordSalt))) {
    return redirect(request, "/login?error=credentials");
  }
  return redirect(request, "/app", sessionCookie(await createSession(env.DB, user.id)));
}

export default {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url);

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
    if (url.pathname === "/auth/logout" && request.method === "POST") {
      if (!sameOrigin(request)) return new Response("Forbidden", { status: 403, headers: PAGE_HEADERS });
      await revokeSession(request, env.DB);
      return redirect(request, "/login", clearSessionCookie);
    }

    if (url.pathname.startsWith("/api/")) {
      return Response.json({ error: "Not found" }, { status: 404, headers: JSON_HEADERS });
    }

    if (url.pathname === "/app" || url.pathname === "/app/") {
      return renderApp(request, env, false);
    }

    if (url.pathname === "/app/preview" || url.pathname === "/app/preview/") {
      return renderApp(request, env, true);
    }

    if (url.pathname === "/app-shell.html") {
      return new Response("Not found", { status: 404, headers: PAGE_HEADERS });
    }

    const response = await env.ASSETS.fetch(request);

    if (url.pathname.startsWith("/login") || url.pathname.startsWith("/signup") || url.pathname.startsWith("/app/")) {
      const headers = new Headers(response.headers);
      for (const [name, value] of Object.entries(PAGE_HEADERS)) headers.set(name, value);
      return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
    }

    return response;
  },
} satisfies ExportedHandler<Env>;
