import { AuthLayout } from "../components/AuthLayout";
import { FormAlert } from "../components/FormAlert";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { queryValue } from "../utils/page";

const errorMessages: Record<string, string> = {
  credentials: "The email or password is incorrect.",
  exists: "An account already exists. Sign in instead.",
  invalid: "Enter a valid email and password.",
  rate: "Too many attempts. Please wait 15 minutes and try again.",
};

export function LoginPage() {
  const resetSucceeded = queryValue("reset") === "success";
  const error = queryValue("error");
  const message = resetSucceeded
    ? "Your password has been reset. Sign in with your new password."
    : error ? errorMessages[error] : undefined;

  return (
    <AuthLayout
      skipHref="#login-main"
      skipText="Skip to sign in"
      helpHref="mailto:hello@finvayo.com"
      helpText="Need help?"
      mainId="login-main"
      eyebrow="Your week in focus"
      heading="Cash clarity starts with a quiet five minutes."
      intro="Review what changed, see the next pressure point, and make one informed decision."
      proofLabel="Finvayo principles"
      proofItems={["90-day outlook", "Transparent estimates", "No bank connection required"]}
    >
      <Card className="login-panel" aria-labelledby="login-title">
        <p className="panel-count">01 / Sign in</p>
        <h2 id="login-title">Welcome back.</h2>
        <p className="panel-copy">Sign in to review your 90-day cash outlook.</p>
        <FormAlert message={message} success={resetSucceeded} />
        <form className="login-form" action="/auth/login" method="post">
          <Label htmlFor="email">Work email</Label>
          <Input id="email" name="email" type="email" autoComplete="email" spellCheck={false} placeholder={`you@business.com${"\u2026"}`} required />
          <Label htmlFor="password">Password</Label>
          <Input id="password" name="password" type="password" autoComplete="current-password" required />
          <a className="forgot-link" href="/forgot-password">Forgot your password?</a>
          <Button className="button button-primary" type="submit">
            Sign in <span aria-hidden="true">{"\u2192"}</span>
          </Button>
        </form>
        <p className="login-terms">New to Finvayo? <a href="/signup">Create an account and start your 14-day trial.</a></p>
        <div className="preview-link">
          <span>Exploring first?</span>
          <a href="/app/preview">View the product shell <span aria-hidden="true">{"\u2192"}</span></a>
        </div>
      </Card>
    </AuthLayout>
  );
}
