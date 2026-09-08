const JSON_HEADERS = {
  "cache-control": "no-store",
  "content-type": "application/json; charset=utf-8",
  "x-content-type-options": "nosniff",
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

    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
