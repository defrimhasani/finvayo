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
      <Card className="relative p-[clamp(2rem,4vw,3.5rem)] shadow-[8px_8px_0_var(--accent)] after:absolute after:right-0 after:top-0 after:h-[7px] after:w-[52px] after:bg-accent sm:shadow-[14px_14px_0_var(--accent)]" aria-labelledby="login-title">
        <p className="font-mono text-xs uppercase tracking-[0.1em] text-muted-foreground">01 / Sign in</p>
        <h2 className="mb-3 mt-10 text-balance text-[clamp(2.1rem,4vw,3.4rem)] font-medium leading-none tracking-[-0.065em]" id="login-title">Welcome back.</h2>
        <p className="text-sm text-muted-foreground">Sign in to review your 90-day cash outlook.</p>
        <FormAlert message={message} success={resetSucceeded} />
        <form className="mt-10 grid gap-3" action="/auth/login" method="post">
          <Label htmlFor="email">Work email</Label>
          <Input className="min-h-[54px]" id="email" name="email" type="email" autoComplete="email" spellCheck={false} placeholder={`you@business.com${"\u2026"}`} required />
          <Label htmlFor="password">Password</Label>
          <Input className="min-h-[54px]" id="password" name="password" type="password" autoComplete="current-password" required />
          <a className="-mt-1 justify-self-end text-xs font-semibold text-muted-foreground underline-offset-4 hover:text-foreground" href="/forgot-password">Forgot your password?</a>
          <Button className="mt-2 w-full" type="submit">
            Sign in <span aria-hidden="true">{"\u2192"}</span>
          </Button>
        </form>
        <p className="mt-5 text-xs leading-5 text-muted-foreground">New to Finvayo? <a className="underline" href="/signup">Create an account and start your 14-day trial.</a></p>
        <div className="mt-10 flex flex-col gap-2 border-t pt-5 text-xs sm:flex-row sm:justify-between">
          <span className="text-muted-foreground">Exploring first?</span>
          <a className="font-semibold underline underline-offset-4" href="/app/preview">View the product shell <span aria-hidden="true">{"\u2192"}</span></a>
        </div>
      </Card>
    </AuthLayout>
  );
}
