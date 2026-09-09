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
      <Card className="relative p-[clamp(2rem,4vw,3.5rem)] shadow-[8px_8px_0_var(--accent)] after:absolute after:right-0 after:top-0 after:h-[7px] after:w-[52px] after:bg-accent sm:shadow-[14px_14px_0_var(--accent)]" aria-labelledby="reset-title">
        <p className="font-mono text-xs uppercase tracking-[0.1em] text-muted-foreground">02 / New password</p>
        <h2 className="mb-3 mt-10 text-balance text-[clamp(2.1rem,4vw,3.4rem)] font-medium leading-none tracking-[-0.065em]" id="reset-title">Secure your account.</h2>
        <p className="text-sm text-muted-foreground">Use at least 12 characters that you do not use elsewhere.</p>
        <FormAlert message={message} />
        <form className="mt-10 grid gap-3" action="/auth/reset-password" method="post">
          <Input name="token" type="hidden" value={token ?? ""} />
          <Label htmlFor="password">New password</Label>
          <Input className="min-h-[54px]" id="password" name="password" type="password" autoComplete="new-password" minLength={12} maxLength={128} required />
          <Label htmlFor="password-confirmation">Confirm new password</Label>
          <Input className="min-h-[54px]" id="password-confirmation" name="passwordConfirmation" type="password" autoComplete="new-password" minLength={12} maxLength={128} required />
          <Button className="mt-2 w-full" type="submit">Reset password <span aria-hidden="true">{"\u2192"}</span></Button>
        </form>
      </Card>
    </AuthLayout>
  );
}
