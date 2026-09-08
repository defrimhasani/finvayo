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

    if (url.pathname.startsWith("/api/")) {
      return Response.json({ error: "Not found" }, { status: 404, headers: JSON_HEADERS });
    }

    if (url.pathname === "/app" || url.pathname === "/app/") {
      return Response.redirect(new URL("/login?next=/app", url), 303);
    }

    const response = await env.ASSETS.fetch(request);

    if (url.pathname.startsWith("/login") || url.pathname.startsWith("/app/")) {
      const headers = new Headers(response.headers);
      for (const [name, value] of Object.entries(PAGE_HEADERS)) headers.set(name, value);
      return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
    }

    return response;
  },
} satisfies ExportedHandler<Env>;
