import { AuthLayout } from "../components/AuthLayout";
import { FormAlert } from "../components/FormAlert";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { queryValue } from "../utils/page";

interface ResetPasswordPageProps {
  token?: string;
}

export function ResetPasswordPage({ token }: ResetPasswordPageProps) {
  const message = queryValue("error") === "invalid"
    ? "Passwords must match and contain at least 12 characters."
    : undefined;

  return (
    <AuthLayout
      skipHref="#reset-main"
      skipText="Skip to password reset"
      helpHref="/login"
      helpText="Back to sign in"
      mainId="reset-main"
      eyebrow="Secure reset"
      heading="Choose a new password."
      intro="Your reset link works once and expires after one hour."
    >
      <Card className="login-panel" aria-labelledby="reset-title">
        <p className="panel-count">02 / New password</p>
        <h2 id="reset-title">Secure your account.</h2>
        <p className="panel-copy">Use at least 12 characters that you do not use elsewhere.</p>
        <FormAlert message={message} />
        <form className="login-form" action="/auth/reset-password" method="post">
          <Input name="token" type="hidden" value={token ?? ""} />
          <Label htmlFor="password">New password</Label>
          <Input id="password" name="password" type="password" autoComplete="new-password" minLength={12} maxLength={128} required />
          <Label htmlFor="password-confirmation">Confirm new password</Label>
          <Input id="password-confirmation" name="passwordConfirmation" type="password" autoComplete="new-password" minLength={12} maxLength={128} required />
          <Button className="button button-primary" type="submit">Reset password <span aria-hidden="true">{"\u2192"}</span></Button>
        </form>
      </Card>
    </AuthLayout>
  );
}
