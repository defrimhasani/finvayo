export type EmailEnv = Env & { EMAIL?: SendEmail };

const FROM = { email: "hello@finvayo.com", name: "Finvayo" };

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
    return entities[character];
  });
}

async function send(env: EmailEnv, to: string, subject: string, text: string, html: string): Promise<void> {
  if (!env.EMAIL) {
    throw new Error("Email service is not configured");
  }
  await env.EMAIL.send({ to, from: FROM, replyTo: "hello@finvayo.com", subject, text, html });
}

export async function sendWelcomeEmail(env: EmailEnv, email: string): Promise<void> {
  const appUrl = "https://finvayo.com/app";
  await send(
    env,
    email,
    "Welcome to Finvayo",
    `Welcome to Finvayo. Your 14-day trial is ready. Start by confirming your current cash balance: ${appUrl}`,
    `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#17221e"><h1>Welcome to Finvayo.</h1><p>Your 14-day trial is ready.</p><p>Start by confirming your current cash balance, then add expected income and planned expenses to build your 90-day outlook.</p><p><a href="${appUrl}" style="display:inline-block;padding:12px 18px;background:#175f57;color:white;text-decoration:none">Open your workspace</a></p><p style="color:#68736d;font-size:13px">Planning estimates, not financial advice.</p></div>`,
  );
}

export async function sendPasswordResetEmail(env: EmailEnv, email: string, resetUrl: string): Promise<void> {
  const safeUrl = escapeHtml(resetUrl);
  await send(
    env,
    email,
    "Reset your Finvayo password",
    `Reset your Finvayo password using this link: ${resetUrl}\n\nThis link expires in one hour. If you did not request it, you can ignore this email.`,
    `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#17221e"><h1>Reset your password.</h1><p>Use the secure link below to choose a new Finvayo password.</p><p><a href="${safeUrl}" style="display:inline-block;padding:12px 18px;background:#175f57;color:white;text-decoration:none">Reset password</a></p><p>This link expires in one hour and can only be used once.</p><p style="color:#68736d;font-size:13px">If you did not request this, you can safely ignore this email.</p></div>`,
  );
}

export async function sendPasswordChangedEmail(env: EmailEnv, email: string): Promise<void> {
  await send(
    env,
    email,
    "Your Finvayo password was changed",
    "Your Finvayo password was changed and all existing sessions were signed out. If you did not make this change, contact hello@finvayo.com immediately.",
    `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#17221e"><h1>Your password was changed.</h1><p>All existing Finvayo sessions were signed out.</p><p>If you did not make this change, contact <a href="mailto:hello@finvayo.com">hello@finvayo.com</a> immediately.</p></div>`,
  );
}

export async function sendInvoiceEmail(
  env: EmailEnv,
  details: { to: string; customerName: string; businessName: string; invoiceNumber: string; total: string; dueDate: string; publicUrl: string },
): Promise<void> {
  const safe = Object.fromEntries(Object.entries(details).map(([key, value]) => [key, escapeHtml(value)])) as typeof details;
  await send(
    env,
    details.to,
    `Invoice ${details.invoiceNumber} from ${details.businessName}`,
    `${details.businessName} sent you invoice ${details.invoiceNumber} for ${details.total}, due ${details.dueDate}. View and print it here: ${details.publicUrl}`,
    `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#17221e"><p>Hi ${safe.customerName},</p><h1>Invoice ${safe.invoiceNumber}</h1><p>${safe.businessName} sent you an invoice for <strong>${safe.total}</strong>, due ${safe.dueDate}.</p><p><a href="${safe.publicUrl}" style="display:inline-block;padding:12px 18px;background:#175f57;color:white;text-decoration:none">View invoice</a></p><p style="color:#68736d;font-size:13px">Sent securely with Finvayo.</p></div>`,
  );
}
