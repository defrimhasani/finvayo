const SESSION_SECONDS = 60 * 60 * 24 * 30;
const PBKDF2_ITERATIONS = 120_000;

export type AuthUser = {
  id: string;
  email: string;
  workspaceId: string;
  workspaceName: string;
  trialEndsAt: number;
};

function toBase64(value: ArrayBuffer | Uint8Array): string {
  const bytes = value instanceof Uint8Array ? value : new Uint8Array(value);
  return btoa(String.fromCharCode(...bytes));
}

function fromBase64(value: string): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
}

async function digest(value: string): Promise<string> {
  return toBase64(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
}

async function derivePassword(password: string, salt: Uint8Array<ArrayBuffer>): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, [
    "deriveBits",
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations: PBKDF2_ITERATIONS },
    key,
    256,
  );
  return toBase64(bits);
}

function randomToken(bytes = 32): string {
  const value = new Uint8Array(bytes);
  crypto.getRandomValues(value);
  return toBase64(value).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

export function normalizeEmail(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return email;
}

export function validPassword(value: FormDataEntryValue | null): value is string {
  return typeof value === "string" && value.length >= 12 && value.length <= 128;
}

export function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  return origin === null || origin === new URL(request.url).origin;
}

export async function allowAuthAttempt(request: Request, db: D1Database, action: string): Promise<boolean> {
  const address = request.headers.get("cf-connecting-ip") ?? "local";
  const bucket = `${action}:${await digest(address)}`;
  const now = Math.floor(Date.now() / 1000);
  const windowStart = now - (now % 900);
  const current = await db
    .prepare("SELECT attempts, window_started_at AS windowStartedAt FROM auth_rate_limits WHERE bucket = ?")
    .bind(bucket)
    .first<{ attempts: number; windowStartedAt: number }>();

  if (!current || current.windowStartedAt !== windowStart) {
    await db
      .prepare(
        `INSERT INTO auth_rate_limits (bucket, attempts, window_started_at) VALUES (?, 1, ?)
         ON CONFLICT(bucket) DO UPDATE SET attempts = 1, window_started_at = excluded.window_started_at`,
      )
      .bind(bucket, windowStart)
      .run();
    return true;
  }

  if (current.attempts >= 10) return false;
  await db.prepare("UPDATE auth_rate_limits SET attempts = attempts + 1 WHERE bucket = ?").bind(bucket).run();
  return true;
}

export async function createPassword(password: string): Promise<{ hash: string; salt: string }> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return { hash: await derivePassword(password, salt), salt: toBase64(salt) };
}

export async function verifyPassword(password: string, expected: string, salt: string): Promise<boolean> {
  const actual = await derivePassword(password, fromBase64(salt));
  if (actual.length !== expected.length) return false;
  let difference = 0;
  for (let index = 0; index < actual.length; index += 1) {
    difference |= actual.charCodeAt(index) ^ expected.charCodeAt(index);
  }
  return difference === 0;
}

export async function createSession(db: D1Database, userId: string): Promise<string> {
  const token = randomToken();
  const now = Math.floor(Date.now() / 1000);
  await db
    .prepare("INSERT INTO sessions (token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)")
    .bind(await digest(token), userId, now + SESSION_SECONDS, now)
    .run();
  return token;
}

function cookieValue(request: Request, name: string): string | null {
  const cookie = request.headers.get("cookie");
  if (!cookie) return null;
  for (const part of cookie.split(";")) {
    const [key, ...value] = part.trim().split("=");
    if (key === name) return value.join("=");
  }
  return null;
}

export async function currentUser(request: Request, db: D1Database): Promise<AuthUser | null> {
  const token = cookieValue(request, "finvayo_session");
  if (!token) return null;
  const now = Math.floor(Date.now() / 1000);
  const user = await db
    .prepare(
      `SELECT users.id, users.email, workspaces.id AS workspaceId,
        workspaces.name AS workspaceName, workspaces.trial_ends_at AS trialEndsAt
       FROM sessions
       JOIN users ON users.id = sessions.user_id
       JOIN workspaces ON workspaces.owner_user_id = users.id
       WHERE sessions.token_hash = ? AND sessions.expires_at > ?`,
    )
    .bind(await digest(token), now)
    .first<AuthUser>();
  return user ?? null;
}

export async function revokeSession(request: Request, db: D1Database): Promise<void> {
  const token = cookieValue(request, "finvayo_session");
  if (token) await db.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(await digest(token)).run();
}

export function sessionCookie(token: string): string {
  return `finvayo_session=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_SECONDS}`;
}

export const clearSessionCookie =
  "finvayo_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0";
