import { AuthLayout } from "../components/AuthLayout";
import { FormAlert } from "../components/FormAlert";
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
      <section className="login-panel" aria-labelledby="signup-title">
        <p className="panel-count">01 / Create account</p>
        <h2 id="signup-title">Start your workspace.</h2>
        <p className="panel-copy">Your trial begins when the account is created.</p>
        <FormAlert message={error ? errorMessages[error] : undefined} />
        <form className="login-form" action="/auth/signup" method="post">
          <label htmlFor="email">Work email</label>
          <input id="email" name="email" type="email" autoComplete="email" spellCheck={false} placeholder={`you@business.com${"\u2026"}`} required />
          <label htmlFor="password">Create password</label>
          <input id="password" name="password" type="password" autoComplete="new-password" minLength={12} maxLength={128} aria-describedby="password-help" required />
          <small id="password-help">Use at least 12 characters.</small>
          <label className="terms-check">
            <input name="terms" type="checkbox" required />
            <span>I agree to the Terms and Privacy Policy.</span>
          </label>
          <button className="button button-primary" type="submit">Create account <span aria-hidden="true">{"\u2192"}</span></button>
        </form>
        <p className="login-terms">No payment method required. Your 14-day trial includes all current features.</p>
      </section>
    </AuthLayout>
  );
}
