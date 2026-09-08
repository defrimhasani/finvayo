import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";

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

  it("serves the no-cache product preview shell", async () => {
    const response = await SELF.fetch("https://finvayo.test/app/preview/");
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store, private");
    expect(html).toContain("Safe to spend now");
    expect(html).toContain("This workspace uses sample data");
  });
});
