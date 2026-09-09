import type { ReactNode } from "react";
import { Brand } from "./Brand";

interface AuthLayoutProps {
  skipHref: string;
  skipText: string;
  helpHref: string;
  helpText: string;
  mainId: string;
  eyebrow: string;
  heading: string;
  intro: string;
  proofLabel?: string;
  proofItems?: string[];
  children: ReactNode;
}

export function AuthLayout({
  skipHref,
  skipText,
  helpHref,
  helpText,
  mainId,
  eyebrow,
  heading,
  intro,
  proofLabel,
  proofItems,
  children,
}: AuthLayoutProps) {
  return (
    <>
      <a className="skip-link" href={skipHref}>{skipText}</a>
      <header className="login-header">
        <Brand />
        <a className="login-help" href={helpHref}>{helpText}</a>
      </header>
      <main className="login-layout" id={mainId}>
        <section className="login-intro">
          <p className="eyebrow">{eyebrow}</p>
          <h1>{heading}</h1>
          <p>{intro}</p>
          {proofItems ? (
            <div className="login-proof" aria-label={proofLabel}>
              {proofItems.map((item) => <span key={item}>{item}</span>)}
            </div>
          ) : null}
        </section>
        {children}
      </main>
      <footer className="login-footer">
        <p>{"\u00a9"} 2026 Finvayo</p>
        <p>Planning estimates, not financial advice.</p>
      </footer>
    </>
  );
}
