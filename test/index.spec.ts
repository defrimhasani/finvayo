import { env } from "cloudflare:workers";
import { SELF } from "cloudflare:test";
import { afterEach, describe, expect, it, vi } from "vitest";
import worker from "../src/index";

async function stripeSignature(body: string, secret: string, timestamp: number): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${timestamp}.${body}`)),
  );
  return Array.from(signature, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("Finvayo Worker", () => {
  it("reports service health", async () => {
    const response = await SELF.fetch("https://finvayo.test/health");

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({ status: "ok", service: "finvayo" });
  });

  it("rejects unsupported health methods", async () => {
    const response = await SELF.fetch("https://finvayo.test/health", { method: "POST" });

    expect(response.status).toBe(405);
    expect(response.headers.get("allow")).toBe("GET, HEAD");
  });

  it("returns JSON for unknown API routes", async () => {
    const response = await SELF.fetch("https://finvayo.test/api/missing");

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "Not found" });
  });

  it("serves the static landing page", async () => {
    const response = await SELF.fetch("https://finvayo.test/");
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/html");
    expect(html).toContain("Know what your business can safely spend");
  });

  it("serves the login experience without caching it", async () => {
    const response = await SELF.fetch("https://finvayo.test/login/");
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store, private");
    expect(html).toContain("Welcome back");
    expect(html).toContain('action="/auth/login"');
  });

  it("redirects an unauthenticated app entry to login", async () => {
    const response = await SELF.fetch("https://finvayo.test/app", { redirect: "manual" });

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("https://finvayo.test/login?next=/app");
  });

  it("creates an account, session, and workspace without approval", async () => {
    const email = `owner-${crypto.randomUUID()}@example.com`;
    const form = new FormData();
    form.set("email", email);
    form.set("password", "correct-horse-battery-staple");
    form.set("terms", "on");

    const signup = await SELF.fetch("https://finvayo.test/auth/signup", {
      method: "POST",
      body: form,
      redirect: "manual",
    });

    expect(signup.status).toBe(303);
    expect(signup.headers.get("location")).toBe("https://finvayo.test/app");
    expect(signup.headers.get("set-cookie")).toContain("finvayo_session=");

    const cookie = signup.headers.get("set-cookie")?.split(";")[0];
    const app = await SELF.fetch("https://finvayo.test/app", { headers: { cookie: cookie ?? "" } });
    const html = await app.text();

    expect(app.status).toBe(200);
    expect(html).toContain(email);
    expect(html).toContain("days left in trial");
    expect(html).toContain("Record a transaction");
    expect(html).toContain('data-preview="false"');
  });

  it("signs an existing account in and rejects a wrong password", async () => {
    const email = `login-${crypto.randomUUID()}@example.com`;
    const signupForm = new FormData();
    signupForm.set("email", email);
    signupForm.set("password", "a-secure-example-password");
    signupForm.set("terms", "on");
    await SELF.fetch("https://finvayo.test/auth/signup", { method: "POST", body: signupForm });

    const invalidForm = new FormData();
    invalidForm.set("email", email);
    invalidForm.set("password", "incorrect-password");
    const invalid = await SELF.fetch("https://finvayo.test/auth/login", {
      method: "POST",
      body: invalidForm,
      redirect: "manual",
    });
    expect(invalid.headers.get("location")).toBe("https://finvayo.test/login?error=credentials");

    const validForm = new FormData();
    validForm.set("email", email);
    validForm.set("password", "a-secure-example-password");
    const valid = await SELF.fetch("https://finvayo.test/auth/login", {
      method: "POST",
      body: validForm,
      redirect: "manual",
    });
    expect(valid.headers.get("location")).toBe("https://finvayo.test/app");
    expect(valid.headers.get("set-cookie")).toContain("HttpOnly");
    expect(valid.headers.get("set-cookie")).toContain("Secure");
    expect(valid.headers.get("set-cookie")).toContain("SameSite=Lax");
  });

  it("sends onboarding email after creating an account", async () => {
    const send = vi.fn().mockResolvedValue({ messageId: "welcome-message" });
    const email = `welcome-${crypto.randomUUID()}@example.com`;
    const form = new FormData();
    form.set("email", email);
    form.set("password", "a-secure-example-password");
    form.set("terms", "on");
    const emailEnv = { ...env, EMAIL: { send } } as unknown as Env;

    const response = await worker.fetch(
      new Request("https://finvayo.test/auth/signup", { method: "POST", headers: { "cf-connecting-ip": "192.0.2.10" }, body: form }) as Parameters<typeof worker.fetch>[0],
      emailEnv,
    );

    expect(response.status).toBe(303);
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: email,
        from: { email: "hello@finvayo.com", name: "Finvayo" },
        subject: "Welcome to Finvayo",
      }),
    );
  });

  it("resets a password with a single-use emailed token and revokes sessions", async () => {
    const send = vi.fn().mockResolvedValue({ messageId: "email-message" });
    const emailEnv = { ...env, EMAIL: { send } } as unknown as Env;
    const email = `reset-${crypto.randomUUID()}@example.com`;
    const signupForm = new FormData();
    signupForm.set("email", email);
    signupForm.set("password", "original-secure-password");
    signupForm.set("terms", "on");
    const signup = await worker.fetch(
      new Request("https://finvayo.test/auth/signup", { method: "POST", headers: { "cf-connecting-ip": "192.0.2.11" }, body: signupForm }) as Parameters<typeof worker.fetch>[0],
      emailEnv,
    );
    const oldCookie = signup.headers.get("set-cookie")?.split(";")[0] ?? "";
    send.mockClear();

    const forgotForm = new FormData();
    forgotForm.set("email", email);
    const forgot = await worker.fetch(
      new Request("https://finvayo.test/auth/forgot-password", { method: "POST", headers: { "cf-connecting-ip": "192.0.2.12" }, body: forgotForm }) as Parameters<typeof worker.fetch>[0],
      emailEnv,
    );
    expect(forgot.status).toBe(303);
    expect(forgot.headers.get("location")).toBe("https://finvayo.test/forgot-password?sent=1");
    expect(send).toHaveBeenCalledTimes(1);
    const sent = send.mock.calls[0][0] as { text: string };
    const resetUrl = sent.text.match(/https:\/\/finvayo\.test\/reset-password\?token=[A-Za-z0-9_-]+/)?.[0];
    expect(resetUrl).toBeDefined();

    const resetPage = await worker.fetch(new Request(resetUrl ?? "") as Parameters<typeof worker.fetch>[0], emailEnv);
    expect(resetPage.status).toBe(200);
    expect(await resetPage.text()).toContain("Choose a new password");
    const token = new URL(resetUrl ?? "").searchParams.get("token") ?? "";
    const resetForm = new FormData();
    resetForm.set("token", token);
    resetForm.set("password", "replacement-secure-password");
    resetForm.set("passwordConfirmation", "replacement-secure-password");
    const reset = await worker.fetch(
      new Request("https://finvayo.test/auth/reset-password", {
        method: "POST",
        headers: { "cf-connecting-ip": "192.0.2.13", origin: "null" },
        body: resetForm,
      }) as Parameters<typeof worker.fetch>[0],
      emailEnv,
    );
    expect(reset.status).toBe(303);
    expect(reset.headers.get("location")).toBe("https://finvayo.test/login?reset=success");
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ to: email, subject: "Your Finvayo password was changed" }));

    const oldSession = await worker.fetch(
      new Request("https://finvayo.test/app", { headers: { cookie: oldCookie }, redirect: "manual" }) as Parameters<typeof worker.fetch>[0],
      emailEnv,
    );
    expect(oldSession.headers.get("location")).toBe("https://finvayo.test/login?next=/app");
    const reused = await worker.fetch(new Request(resetUrl ?? "", { redirect: "manual" }) as Parameters<typeof worker.fetch>[0], emailEnv);
    expect(reused.headers.get("location")).toBe("https://finvayo.test/forgot-password?error=expired");

    const loginForm = new FormData();
    loginForm.set("email", email);
    loginForm.set("password", "replacement-secure-password");
    const login = await worker.fetch(
      new Request("https://finvayo.test/auth/login", { method: "POST", body: loginForm }) as Parameters<typeof worker.fetch>[0],
      emailEnv,
    );
    expect(login.headers.get("location")).toBe("https://finvayo.test/app");
  });

  it("does not reveal whether a password-reset account exists", async () => {
    const send = vi.fn().mockResolvedValue({ messageId: "unused" });
    const emailEnv = { ...env, EMAIL: { send } } as unknown as Env;
    const form = new FormData();
    form.set("email", `missing-${crypto.randomUUID()}@example.com`);
    const response = await worker.fetch(
      new Request("https://finvayo.test/auth/forgot-password", { method: "POST", headers: { "cf-connecting-ip": "192.0.2.14" }, body: form }) as Parameters<typeof worker.fetch>[0],
      emailEnv,
    );
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("https://finvayo.test/forgot-password?sent=1");
    expect(send).not.toHaveBeenCalled();
  });

  it("stores workspace cash snapshots and entries in integer minor units", async () => {
    const form = new FormData();
    form.set("email", `cash-${crypto.randomUUID()}@example.com`);
    form.set("password", "a-secure-example-password");
    form.set("terms", "on");
    const signup = await SELF.fetch("https://finvayo.test/auth/signup", { method: "POST", body: form, redirect: "manual" });
    const cookie = signup.headers.get("set-cookie")?.split(";")[0] ?? "";
    const headers = { cookie, origin: "https://finvayo.test", "content-type": "application/json" };

    const snapshot = await SELF.fetch("https://finvayo.test/api/cash-snapshots", {
      method: "POST",
      headers,
      body: JSON.stringify({ balanceMinor: 125050, effectiveDate: "2026-09-08" }),
    });
    expect(snapshot.status).toBe(201);

    const entry = await SELF.fetch("https://finvayo.test/api/cash-entries", {
      method: "POST",
      headers,
      body: JSON.stringify({
        direction: "inflow",
        name: "September retainer",
        amountMinor: 240000,
        scheduledDate: "2026-09-20",
        status: "invoiced",
        clientName: "Acme Studio",
        invoiceReference: "INV-024",
      }),
    });
    expect(entry.status).toBe(201);
    const { id } = (await entry.json()) as { id: string };

    const paid = await SELF.fetch(`https://finvayo.test/api/cash-entries/${id}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ status: "paid", actualAmountMinor: 240000 }),
    });
    expect(paid.status).toBe(200);

    const financials = await SELF.fetch("https://finvayo.test/api/financials", { headers: { cookie } });
    const data = (await financials.json()) as {
      currency: string;
      snapshot: { balanceMinor: number };
      entries: Array<{ amountMinor: number; status: string; actualAmountMinor: number }>;
    };
    expect(data.currency).toBe("USD");
    expect(data.snapshot.balanceMinor).toBe(125050);
    expect(data.entries).toEqual(expect.arrayContaining([expect.objectContaining({ amountMinor: 240000, status: "paid", actualAmountMinor: 240000 })]));
  });

  it("calculates the 90-day overview from real workspace data", async () => {
    const form = new FormData();
    form.set("email", `overview-${crypto.randomUUID()}@example.com`);
    form.set("password", "a-secure-example-password");
    form.set("terms", "on");
    const signup = await SELF.fetch("https://finvayo.test/auth/signup", { method: "POST", body: form, redirect: "manual" });
    const cookie = signup.headers.get("set-cookie")?.split(";")[0] ?? "";
    const headers = { cookie, origin: "https://finvayo.test", "content-type": "application/json" };
    await SELF.fetch("https://finvayo.test/api/settings", {
      method: "PATCH",
      headers,
      body: JSON.stringify({ name: "Forecast Co", currency: "USD", timezone: "UTC", minimumBufferMinor: 10000, taxReserveMinor: 5000 }),
    });
    await SELF.fetch("https://finvayo.test/api/cash-snapshots", {
      method: "POST",
      headers,
      body: JSON.stringify({ balanceMinor: 100000, effectiveDate: "2026-01-01" }),
    });
    await SELF.fetch("https://finvayo.test/api/cash-entries", {
      method: "POST",
      headers,
      body: JSON.stringify({
        direction: "inflow", name: "January invoice", amountMinor: 20000, scheduledDate: "2026-01-05",
        status: "invoiced", category: "service_income",
      }),
    });
    await SELF.fetch("https://finvayo.test/api/cash-entries", {
      method: "POST",
      headers,
      body: JSON.stringify({
        direction: "outflow", name: "Month-end subscription", amountMinor: 30000, scheduledDate: "2026-01-31",
        status: "planned", category: "subscriptions", recurrence: "monthly",
      }),
    });

    const response = await SELF.fetch("https://finvayo.test/api/financials", { headers: { cookie } });
    const data = (await response.json()) as {
      overview: {
        currentCashMinor: number; protectedMinor: number; lowestBalanceMinor: number; safeToSpendMinor: number;
        limitingDate: string; risk: string; events: Array<{ date: string }>;
      };
    };
    expect(data.overview).toEqual(expect.objectContaining({
      currentCashMinor: 100000,
      protectedMinor: 15000,
      lowestBalanceMinor: 30000,
      safeToSpendMinor: 15000,
      limitingDate: "2026-03-31",
      risk: "normal",
    }));
    expect(data.overview.events.map((event) => event.date)).toEqual(["2026-01-05", "2026-01-31", "2026-02-28", "2026-03-31"]);
  });

  it("records and deletes a paid business expense", async () => {
    const form = new FormData();
    form.set("email", `expense-${crypto.randomUUID()}@example.com`);
    form.set("password", "a-secure-example-password");
    form.set("terms", "on");
    const signup = await SELF.fetch("https://finvayo.test/auth/signup", { method: "POST", body: form, redirect: "manual" });
    const cookie = signup.headers.get("set-cookie")?.split(";")[0] ?? "";
    const headers = { cookie, origin: "https://finvayo.test", "content-type": "application/json" };

    const created = await SELF.fetch("https://finvayo.test/api/cash-entries", {
      method: "POST",
      headers,
      body: JSON.stringify({
        direction: "outflow",
        name: "Accounting software",
        amountMinor: 4999,
        actualAmountMinor: 4999,
        scheduledDate: "2026-09-08",
        status: "paid",
        category: "software",
      }),
    });
    expect(created.status).toBe(201);
    const { id } = (await created.json()) as { id: string };

    const financials = await SELF.fetch("https://finvayo.test/api/financials", { headers: { cookie } });
    const data = (await financials.json()) as { entries: Array<Record<string, unknown>> };
    expect(data.entries).toContainEqual(
      expect.objectContaining({
        id,
        direction: "outflow",
        status: "paid",
        amountMinor: 4999,
        actualAmountMinor: 4999,
        category: "software",
      }),
    );

    const removed = await SELF.fetch(`https://finvayo.test/api/cash-entries/${id}`, { method: "DELETE", headers });
    expect(removed.status).toBe(204);
    const afterDelete = (await (await SELF.fetch("https://finvayo.test/api/financials", { headers: { cookie } })).json()) as {
      entries: Array<{ id: string }>;
    };
    expect(afterDelete.entries.some((entry) => entry.id === id)).toBe(false);
  });

  it("registers parties and preserves their names on transaction history", async () => {
    const form = new FormData();
    form.set("email", `parties-${crypto.randomUUID()}@example.com`);
    form.set("password", "a-secure-example-password");
    form.set("terms", "on");
    const signup = await SELF.fetch("https://finvayo.test/auth/signup", { method: "POST", body: form, redirect: "manual" });
    const cookie = signup.headers.get("set-cookie")?.split(";")[0] ?? "";
    const headers = { cookie, origin: "https://finvayo.test", "content-type": "application/json" };

    const createdParty = await SELF.fetch("https://finvayo.test/api/parties", {
      method: "POST",
      headers,
      body: JSON.stringify({ name: "Northstar Ltd", role: "customer", email: "accounts@northstar.example" }),
    });
    expect(createdParty.status).toBe(201);
    const { id: partyId } = (await createdParty.json()) as { id: string };

    const parties = await SELF.fetch("https://finvayo.test/api/parties", { headers: { cookie } });
    await expect(parties.json()).resolves.toEqual({
      parties: expect.arrayContaining([
        expect.objectContaining({ id: partyId, name: "Northstar Ltd", role: "customer", email: "accounts@northstar.example" }),
      ]),
    });

    const incompatible = await SELF.fetch("https://finvayo.test/api/cash-entries", {
      method: "POST",
      headers,
      body: JSON.stringify({
        direction: "outflow",
        name: "Incorrect supplier payment",
        amountMinor: 1000,
        actualAmountMinor: 1000,
        scheduledDate: "2026-09-08",
        status: "paid",
        category: "other",
        partyId,
      }),
    });
    expect(incompatible.status).toBe(400);
    await expect(incompatible.json()).resolves.toEqual({ error: "Party must be a supplier" });

    const transaction = await SELF.fetch("https://finvayo.test/api/cash-entries", {
      method: "POST",
      headers,
      body: JSON.stringify({
        direction: "inflow",
        name: "Northstar retainer",
        amountMinor: 320000,
        actualAmountMinor: 320000,
        scheduledDate: "2026-09-08",
        status: "paid",
        invoiceReference: "INV-100",
        partyId,
      }),
    });
    expect(transaction.status).toBe(201);
    const { id: transactionId } = (await transaction.json()) as { id: string };

    const removedParty = await SELF.fetch(`https://finvayo.test/api/parties/${partyId}`, { method: "DELETE", headers });
    expect(removedParty.status).toBe(204);
    const financials = (await (await SELF.fetch("https://finvayo.test/api/financials", { headers: { cookie } })).json()) as {
      entries: Array<{ id: string; partyId: string | null; partyName: string }>;
    };
    expect(financials.entries).toContainEqual(
      expect.objectContaining({ id: transactionId, partyId: null, partyName: "Northstar Ltd" }),
    );
  });

  it("supports direction-specific income and expense categories", async () => {
    const form = new FormData();
    form.set("email", `categories-${crypto.randomUUID()}@example.com`);
    form.set("password", "a-secure-example-password");
    form.set("terms", "on");
    const signup = await SELF.fetch("https://finvayo.test/auth/signup", { method: "POST", body: form, redirect: "manual" });
    const cookie = signup.headers.get("set-cookie")?.split(";")[0] ?? "";
    const headers = { cookie, origin: "https://finvayo.test", "content-type": "application/json" };
    const entry = (direction: string, category: string) => ({
      direction,
      name: `${category} transaction`,
      amountMinor: 25000,
      actualAmountMinor: 25000,
      scheduledDate: "2026-09-08",
      status: "paid",
      category,
    });

    const income = await SELF.fetch("https://finvayo.test/api/cash-entries", {
      method: "POST",
      headers,
      body: JSON.stringify(entry("inflow", "owner_contribution")),
    });
    expect(income.status).toBe(201);
    const expense = await SELF.fetch("https://finvayo.test/api/cash-entries", {
      method: "POST",
      headers,
      body: JSON.stringify(entry("outflow", "payment_processing_fees")),
    });
    expect(expense.status).toBe(201);
    const invalid = await SELF.fetch("https://finvayo.test/api/cash-entries", {
      method: "POST",
      headers,
      body: JSON.stringify(entry("inflow", "rent")),
    });
    expect(invalid.status).toBe(400);
    await expect(invalid.json()).resolves.toEqual({ error: "Invalid category" });

    const financials = (await (await SELF.fetch("https://finvayo.test/api/financials", { headers: { cookie } })).json()) as {
      entries: Array<{ category: string }>;
    };
    expect(financials.entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ category: "owner_contribution" }),
        expect.objectContaining({ category: "payment_processing_fees" }),
      ]),
    );
  });

  it("updates workspace settings and locks currency after financial activity", async () => {
    const form = new FormData();
    const email = `settings-${crypto.randomUUID()}@example.com`;
    form.set("email", email);
    form.set("password", "a-secure-example-password");
    form.set("terms", "on");
    const signup = await SELF.fetch("https://finvayo.test/auth/signup", { method: "POST", body: form, redirect: "manual" });
    const cookie = signup.headers.get("set-cookie")?.split(";")[0] ?? "";
    const headers = { cookie, origin: "https://finvayo.test", "content-type": "application/json" };

    const page = await SELF.fetch("https://finvayo.test/app/settings", { headers: { cookie } });
    expect(page.status).toBe(200);
    expect(page.headers.get("cache-control")).toBe("no-store, private");
    expect(await page.text()).toContain("Workspace controls");

    const updated = await SELF.fetch("https://finvayo.test/api/settings", {
      method: "PATCH",
      headers,
      body: JSON.stringify({
        name: "Consulting HQ",
        currency: "EUR",
        timezone: "Europe/Tirane",
        minimumBufferMinor: 150000,
        taxReserveMinor: 42000,
      }),
    });
    expect(updated.status).toBe(200);
    const settings = await SELF.fetch("https://finvayo.test/api/settings", { headers: { cookie } });
    await expect(settings.json()).resolves.toEqual({
      settings: expect.objectContaining({
        name: "Consulting HQ",
        email,
        currency: "EUR",
        timezone: "Europe/Tirane",
        minimumBufferMinor: 150000,
        taxReserveMinor: 42000,
        currencyLocked: 0,
      }),
    });

    await SELF.fetch("https://finvayo.test/api/cash-snapshots", {
      method: "POST",
      headers,
      body: JSON.stringify({ balanceMinor: 500000, effectiveDate: "2026-09-08" }),
    });
    const locked = await SELF.fetch("https://finvayo.test/api/settings", {
      method: "PATCH",
      headers,
      body: JSON.stringify({
        name: "Consulting HQ",
        currency: "GBP",
        timezone: "Europe/London",
        minimumBufferMinor: 150000,
        taxReserveMinor: 42000,
      }),
    });
    expect(locked.status).toBe(409);
    await expect(locked.json()).resolves.toEqual({ error: "Currency cannot change after financial records exist" });
  });

  it("protects settings routes with authentication and same-origin checks", async () => {
    const page = await SELF.fetch("https://finvayo.test/app/settings", { redirect: "manual" });
    expect(page.status).toBe(303);
    expect(page.headers.get("location")).toBe("https://finvayo.test/login?next=/app/settings");
    expect((await SELF.fetch("https://finvayo.test/api/settings")).status).toBe(401);
    const forbidden = await SELF.fetch("https://finvayo.test/api/settings", {
      method: "PATCH",
      headers: { origin: "https://attacker.example", "content-type": "application/json" },
      body: "{}",
    });
    expect(forbidden.status).toBe(403);
  });

  it("requires authentication and same-origin writes for financial data", async () => {
    const unauthorized = await SELF.fetch("https://finvayo.test/api/financials");
    expect(unauthorized.status).toBe(401);

    const forbidden = await SELF.fetch("https://finvayo.test/api/cash-entries", {
      method: "POST",
      headers: { origin: "https://attacker.example", "content-type": "application/json" },
      body: "{}",
    });
    expect(forbidden.status).toBe(403);
  });

  it("projects signed Stripe test subscription events idempotently", async () => {
    const email = `billing-${crypto.randomUUID()}@example.com`;
    const form = new FormData();
    form.set("email", email);
    form.set("password", "a-secure-example-password");
    form.set("terms", "on");
    await SELF.fetch("https://finvayo.test/auth/signup", { method: "POST", body: form });
    const workspace = await env.DB
      .prepare("SELECT workspaces.id FROM workspaces JOIN users ON users.id = workspaces.owner_user_id WHERE users.email = ?")
      .bind(email)
      .first<{ id: string }>();
    expect(workspace).not.toBeNull();

    const event = JSON.stringify({
      id: `evt_${crypto.randomUUID()}`,
      type: "customer.subscription.updated",
      created: Math.floor(Date.now() / 1000),
      livemode: false,
      data: {
        object: {
          id: "sub_test",
          customer: "cus_test",
          status: "active",
          cancel_at_period_end: false,
          metadata: { workspace_id: workspace?.id },
          items: { data: [{ price: { id: "price_monthly_test" }, current_period_end: 1_800_000_000 }] },
        },
      },
    });
    const timestamp = Math.floor(Date.now() / 1000);
    const secret = "whsec_test_secret";
    const signature = await stripeSignature(event, secret, timestamp);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json({
          id: "sub_test",
          customer: "cus_test",
          status: "active",
          cancel_at_period_end: false,
          metadata: { workspace_id: workspace?.id },
          items: { data: [{ price: { id: "price_monthly_test" }, current_period_end: 1_800_000_000 }] },
        }),
      ),
    );
    const stripeEnv = { ...env, STRIPE_SECRET_KEY: "sk_test_secret", STRIPE_WEBHOOK_SECRET: secret } as unknown as Env;
    const request = () =>
      new Request("https://finvayo.test/api/stripe/webhook", {
        method: "POST",
        headers: { "stripe-signature": `t=${timestamp},v1=${signature}` },
        body: event,
      }) as Parameters<typeof worker.fetch>[0];

    expect((await worker.fetch(request(), stripeEnv)).status).toBe(200);
    expect((await worker.fetch(request(), stripeEnv)).status).toBe(200);
    const subscription = await env.DB
      .prepare("SELECT status, stripe_subscription_id AS stripeSubscriptionId FROM subscriptions WHERE workspace_id = ?")
      .bind(workspace?.id)
      .first<{ status: string; stripeSubscriptionId: string }>();
    expect(subscription).toEqual({ status: "active", stripeSubscriptionId: "sub_test" });
  });

  it("rejects unsigned Stripe webhooks", async () => {
    const stripeEnv = { ...env, STRIPE_WEBHOOK_SECRET: "whsec_test_secret" } as unknown as Env;
    const request = new Request("https://finvayo.test/api/stripe/webhook", { method: "POST", body: "{}" }) as Parameters<
      typeof worker.fetch
    >[0];
    const response = await worker.fetch(request, stripeEnv);
    expect(response.status).toBe(400);
  });

  it("serves the no-cache product preview shell", async () => {
    const response = await SELF.fetch("https://finvayo.test/app/preview/");
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store, private");
    expect(html).toContain("Safe to spend now");
    expect(html).toContain("This workspace uses sample data");
    expect(html).toContain('data-preview="true"');
  });

  it("returns a controlled response when a request handler throws", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const env = {
      ASSETS: { fetch: () => Promise.reject(new Error("Asset service unavailable")) },
    } as unknown as Env;

    const request = new Request("https://finvayo.test/") as Parameters<typeof worker.fetch>[0];
    const response = await worker.fetch(request, env);

    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toBe("no-store, private");
    await expect(response.text()).resolves.toBe("Service temporarily unavailable");
    expect(consoleError).toHaveBeenCalledWith(
      "Unhandled request error",
      expect.objectContaining({ method: "GET", pathname: "/", rayId: null }),
    );
  });
});
