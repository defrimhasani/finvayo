import { allowAuthAttempt, createPassword, normalizeEmail, validPassword } from "./auth";
import { sendPasswordChangedEmail, sendPasswordResetEmail, type EmailEnv } from "./email";

const TOKEN_SECONDS = 60 * 60;

function redirect(request: Request, path: string): Response {
  return new Response(null, {
    status: 303,
    headers: {
      location: new URL(path, request.url).toString(),
      "cache-control": "no-store, private",
      "referrer-policy": "no-referrer",
      "x-content-type-options": "nosniff",
      "x-frame-options": "DENY",
    },
  });
}

function randomToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

async function hashToken(token: string): Promise<string> {
  const bytes = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token)));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function requestPasswordReset(request: Request, env: EmailEnv): Promise<Response> {
  if (!(await allowAuthAttempt(request, env.DB, "forgot-password"))) return redirect(request, "/forgot-password?sent=1");
  const form = await request.formData();
  const email = normalizeEmail(form.get("email"));
  if (email) {
    const user = await env.DB.prepare("SELECT id FROM users WHERE email = ?").bind(email).first<{ id: string }>();
    if (user) {
      const token = randomToken();
      const now = Math.floor(Date.now() / 1000);
      await env.DB.batch([
        env.DB.prepare("DELETE FROM password_reset_tokens WHERE user_id = ? OR expires_at <= ?").bind(user.id, now),
        env.DB
          .prepare("INSERT INTO password_reset_tokens (token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)")
          .bind(await hashToken(token), user.id, now + TOKEN_SECONDS, now),
      ]);
      try {
        await sendPasswordResetEmail(env, email, `${new URL(request.url).origin}/reset-password?token=${encodeURIComponent(token)}`);
      } catch (error) {
        console.error("Password reset email failed", { error: error instanceof Error ? error.message : String(error) });
      }
    }
  }
  return redirect(request, "/forgot-password?sent=1");
}

export async function validResetToken(db: D1Database, token: string | null): Promise<boolean> {
  if (!token || !/^[A-Za-z0-9_-]{40,64}$/.test(token)) return false;
  const row = await db
    .prepare("SELECT token_hash FROM password_reset_tokens WHERE token_hash = ? AND used_at IS NULL AND expires_at > ?")
    .bind(await hashToken(token), Math.floor(Date.now() / 1000))
    .first();
  return Boolean(row);
}

export async function resetPassword(request: Request, env: EmailEnv): Promise<Response> {
  if (!(await allowAuthAttempt(request, env.DB, "reset-password"))) return redirect(request, "/forgot-password?error=rate");
  const form = await request.formData();
  const token = form.get("token");
  const password = form.get("password");
  const confirmation = form.get("passwordConfirmation");
  if (typeof token !== "string" || !validPassword(password) || password !== confirmation) {
    return redirect(request, `/reset-password?token=${encodeURIComponent(typeof token === "string" ? token : "")}&error=invalid`);
  }
  const now = Math.floor(Date.now() / 1000);
  const tokenHash = await hashToken(token);
  const record = await env.DB
    .prepare(
      `SELECT password_reset_tokens.user_id AS userId, users.email
       FROM password_reset_tokens JOIN users ON users.id = password_reset_tokens.user_id
       WHERE token_hash = ? AND used_at IS NULL AND expires_at > ?`,
    )
    .bind(tokenHash, now)
    .first<{ userId: string; email: string }>();
  if (!record) return redirect(request, "/forgot-password?error=expired");

  const passwordRecord = await createPassword(password);
  const consumed = await env.DB
    .prepare("UPDATE password_reset_tokens SET used_at = ? WHERE token_hash = ? AND used_at IS NULL AND expires_at > ?")
    .bind(now, tokenHash, now)
    .run();
  if (!consumed.meta.changes) return redirect(request, "/forgot-password?error=expired");
  await env.DB.batch([
    env.DB.prepare("UPDATE users SET password_hash = ?, password_salt = ? WHERE id = ?").bind(passwordRecord.hash, passwordRecord.salt, record.userId),
    env.DB.prepare("DELETE FROM sessions WHERE user_id = ?").bind(record.userId),
  ]);
  try {
    await sendPasswordChangedEmail(env, record.email);
  } catch (error) {
    console.error("Password changed email failed", { error: error instanceof Error ? error.message : String(error) });
  }
  return redirect(request, "/login?reset=success");
}
