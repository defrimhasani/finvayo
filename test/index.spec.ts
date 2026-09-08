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
    expect(html).toContain("Welcome to Finvayo");
    expect(html).toContain("Private beta access is currently invitation-only");
  });

  it("redirects the protected app entry to login", async () => {
    const response = await SELF.fetch("https://finvayo.test/app", { redirect: "manual" });

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("https://finvayo.test/login?next=/app");
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
