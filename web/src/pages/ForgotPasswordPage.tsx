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
      <Card className="login-panel" aria-labelledby="forgot-title">
        <p className="panel-count">01 / Recover access</p>
        <h2 id="forgot-title">Reset your password.</h2>
        <p className="panel-copy">Enter the email associated with your Finvayo workspace.</p>
        <FormAlert message={message} success={sent} role="status" />
        <form className="login-form" action="/auth/forgot-password" method="post">
          <Label htmlFor="email">Work email</Label>
          <Input id="email" name="email" type="email" autoComplete="email" required />
          <Button className="button button-primary" type="submit">Send reset link <span aria-hidden="true">{"\u2192"}</span></Button>
        </form>
        <p className="login-terms">For privacy, the confirmation is the same whether or not an account exists.</p>
      </Card>
    </AuthLayout>
  );
}
