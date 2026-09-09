import { AuthLayout } from "../components/AuthLayout";
import { FormAlert } from "../components/FormAlert";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { queryValue } from "../utils/page";

export function ForgotPasswordPage() {
  const sent = queryValue("sent") !== null;
  const error = queryValue("error");
  const message = sent
    ? "If an account exists for that email, a reset link is on its way."
    : error === "expired"
      ? "That reset link is invalid or has expired. Request a new one."
      : error === "rate"
        ? "Too many attempts. Please wait 15 minutes and try again."
        : undefined;

  return (
    <AuthLayout
      skipHref="#forgot-main"
      skipText="Skip to password recovery"
      helpHref="/login"
      helpText="Back to sign in"
      mainId="forgot-main"
      eyebrow="Account recovery"
      heading="Get back to your cash plan."
      intro="We will send a secure, single-use link that expires after one hour."
    >
      <Card className="relative p-[clamp(2rem,4vw,3.5rem)] shadow-[8px_8px_0_var(--accent)] after:absolute after:right-0 after:top-0 after:h-[7px] after:w-[52px] after:bg-accent sm:shadow-[14px_14px_0_var(--accent)]" aria-labelledby="forgot-title">
        <p className="font-mono text-xs uppercase tracking-[0.1em] text-muted-foreground">01 / Recover access</p>
        <h2 className="mb-3 mt-10 text-balance text-[clamp(2.1rem,4vw,3.4rem)] font-medium leading-none tracking-[-0.065em]" id="forgot-title">Reset your password.</h2>
        <p className="text-sm text-muted-foreground">Enter the email associated with your Finvayo workspace.</p>
        <FormAlert message={message} success={sent} role="status" />
        <form className="mt-10 grid gap-3" action="/auth/forgot-password" method="post">
          <Label htmlFor="email">Work email</Label>
          <Input className="min-h-[54px]" id="email" name="email" type="email" autoComplete="email" required />
          <Button className="mt-2 w-full" type="submit">Send reset link <span aria-hidden="true">{"\u2192"}</span></Button>
        </form>
        <p className="mt-5 text-xs leading-5 text-muted-foreground">For privacy, the confirmation is the same whether or not an account exists.</p>
      </Card>
    </AuthLayout>
  );
}
