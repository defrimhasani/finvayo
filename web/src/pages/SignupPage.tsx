import { AuthLayout } from "../components/AuthLayout";
import { FormAlert } from "../components/FormAlert";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Checkbox } from "../components/ui/checkbox";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { queryValue } from "../utils/page";

const errorMessages: Record<string, string> = {
  invalid: "Use a valid email, a password of at least 12 characters, and accept the terms.",
  unavailable: "We could not create the account. Please try again.",
  exists: "An account already exists. Sign in instead.",
  rate: "Too many attempts. Please wait 15 minutes and try again.",
};

export function SignupPage() {
  const error = queryValue("error");

  return (
    <AuthLayout
      skipHref="#signup-main"
      skipText="Skip to account creation"
      helpHref="/login"
      helpText="Already have an account?"
      mainId="signup-main"
      eyebrow="14 days free"
      heading="Build your first cash outlook today."
      intro="No payment method and no bank connection required. Start with the numbers you already know."
      proofLabel="Trial details"
      proofItems={["Full product access", "Cancel anytime", "Your data stays private"]}
    >
      <Card className="relative p-[clamp(2rem,4vw,3.5rem)] shadow-[8px_8px_0_var(--accent)] after:absolute after:right-0 after:top-0 after:h-[7px] after:w-[52px] after:bg-accent sm:shadow-[14px_14px_0_var(--accent)]" aria-labelledby="signup-title">
        <p className="font-mono text-xs uppercase tracking-[0.1em] text-muted-foreground">01 / Create account</p>
        <h2 className="mb-3 mt-10 text-balance text-[clamp(2.1rem,4vw,3.4rem)] font-medium leading-none tracking-[-0.065em]" id="signup-title">Start your workspace.</h2>
        <p className="text-sm text-muted-foreground">Your trial begins when the account is created.</p>
        <FormAlert message={error ? errorMessages[error] : undefined} />
        <form className="mt-10 grid gap-3" action="/auth/signup" method="post">
          <Label htmlFor="email">Work email</Label>
          <Input className="min-h-[54px]" id="email" name="email" type="email" autoComplete="email" spellCheck={false} placeholder={`you@business.com${"\u2026"}`} required />
          <Label htmlFor="password">Create password</Label>
          <Input className="min-h-[54px]" id="password" name="password" type="password" autoComplete="new-password" minLength={12} maxLength={128} aria-describedby="password-help" required />
          <small className="-mt-1 text-xs text-muted-foreground" id="password-help">Use at least 12 characters.</small>
          <label className="my-2 grid grid-cols-[20px_1fr] items-start gap-3 text-xs leading-5">
            <Checkbox className="mt-0.5" name="terms" required />
            <span>I agree to the Terms and Privacy Policy.</span>
          </label>
          <Button className="mt-2 w-full" type="submit">Create account <span aria-hidden="true">{"\u2192"}</span></Button>
        </form>
        <p className="mt-5 text-xs leading-5 text-muted-foreground">No payment method required. Your 14-day trial includes all current features.</p>
      </Card>
    </AuthLayout>
  );
}
