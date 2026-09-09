export async function api<T = unknown>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (init?.body && !headers.has("content-type")) headers.set("content-type", "application/json");
  if (!init?.body && !headers.has("accept")) headers.set("accept", "application/json");

  const response = await fetch(path, { ...init, headers });
  if (response.status === 401) {
    const next = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    window.location.assign(`/login?next=${encodeURIComponent(next)}`);
    throw new Error("Your session has expired.");
  }
  if (response.status === 204) return undefined as T;

  const result = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(result.error || "Unable to complete the request.");
  return result;
}
