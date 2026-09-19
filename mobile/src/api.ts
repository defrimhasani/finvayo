import type { Financials, Invoice, InvoiceSummary, Party, ScenarioResult, Settings, Workflows } from "./types";

export const API_URL = process.env.EXPO_PUBLIC_API_URL || "https://finvayo.com";

export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      Accept: "application/json",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
  });
  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const body = (await response.json()) as { error?: string };
      if (body.error) message = body.error;
    } catch {
      // Some authentication endpoints return HTML redirects.
    }
    throw new ApiError(message, response.status);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  financials: () => request<Financials>("/api/financials"),
  invoices: () => request<{ invoices: InvoiceSummary[] }>("/api/invoices"),
  invoice: (id: string) => request<{ invoice: Invoice }>(`/api/invoices/${id}`),
  parties: () => request<{ parties: Party[] }>("/api/parties"),
  settings: () => request<{ settings: Settings | null }>("/api/settings"),
  workflows: () => request<Workflows>("/api/workflows"),
  billing: () =>
    request<{ subscription: { status: string; currentPeriodEnd?: number | null }; trialEndsAt: number }>("/api/billing"),
  post: <T>(path: string, body: unknown) => request<T>(path, { method: "POST", body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) => request<T>(path, { method: "PATCH", body: JSON.stringify(body) }),
  delete: (path: string) => request<void>(path, { method: "DELETE" }),
  scenario: (body: { amountMinor: number; date: string }) => request<ScenarioResult>("/api/scenarios", { method: "POST", body: JSON.stringify(body) }),
};

async function authRequest(path: string, values: Record<string, string>) {
  const body = new URLSearchParams(values).toString();
  const response = await fetch(`${API_URL}${path}`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (response.status >= 400) throw new ApiError("Unable to complete sign in.", response.status);
  const location = response.headers.get("location") || response.url;
  if (location.includes("error=credentials")) throw new ApiError("Email or password is incorrect.", 401);
  if (location.includes("error=rate")) throw new ApiError("Too many attempts. Try again shortly.", 429);
  if (location.includes("error=invalid")) throw new ApiError("Check the information entered.", 400);
  if (location.includes("error=exists")) throw new ApiError("An account already exists for this email.", 409);
}

export const authApi = {
  login: (email: string, password: string) => authRequest("/auth/login", { email, password }),
  signup: (email: string, password: string) => authRequest("/auth/signup", { email, password, terms: "on" }),
  logout: () => authRequest("/auth/logout", {}),
};
