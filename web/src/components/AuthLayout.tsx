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
    <div className="min-h-screen bg-primary text-primary-foreground [color-scheme:dark]">
      <a className="fixed -top-16 left-4 z-50 bg-card px-4 py-3 text-card-foreground focus-visible:top-4" href={skipHref}>{skipText}</a>
      <header className="mx-auto flex min-h-20 w-[min(calc(100%-2rem),1380px)] items-center justify-between border-b border-white/15 sm:min-h-22 sm:w-[min(calc(100%-3rem),1380px)]">
        <Brand />
        <a className="text-xs text-white/70 underline-offset-4 hover:text-white sm:text-sm" href={helpHref}>{helpText}</a>
      </header>
      <main className="mx-auto grid min-h-[calc(100vh-10rem)] w-[min(calc(100%-2rem),1380px)] grid-cols-1 items-center gap-16 bg-[linear-gradient(rgba(255,255,255,0.045)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.045)_1px,transparent_1px)] bg-[size:80px_80px] py-16 md:w-[min(calc(100%-3rem),1380px)] md:grid-cols-[minmax(0,1.2fr)_minmax(380px,0.7fr)] md:gap-[clamp(3rem,10vw,10rem)] md:py-20" id={mainId}>
        <section>
          <p className="mb-5 font-mono text-[0.7rem] font-medium uppercase tracking-[0.12em] text-accent before:mr-2.5 before:inline-block before:w-7 before:border-t-2 before:border-accent before:align-middle">{eyebrow}</p>
          <h1 className="mb-8 max-w-[760px] text-balance text-[clamp(3.2rem,15vw,5rem)] font-semibold leading-[0.92] tracking-[-0.075em] md:text-[clamp(3.4rem,7vw,7rem)]">{heading}</h1>
          <p className="max-w-[530px] text-base leading-7 text-white/65">{intro}</p>
          {proofItems ? (
            <div className="mt-12 flex flex-wrap gap-3" aria-label={proofLabel}>
              {proofItems.map((item) => <span className="min-h-8 border border-white/30 px-3 py-2 font-mono text-[0.7rem] uppercase text-white/80" key={item}>{item}</span>)}
            </div>
          ) : null}
        </section>
        {children}
      </main>
      <footer className="mx-auto flex min-h-22 w-[min(calc(100%-2rem),1380px)] flex-col items-start justify-center gap-2 border-t border-white/15 py-6 font-mono text-[0.58rem] text-white/55 sm:w-[min(calc(100%-3rem),1380px)] sm:flex-row sm:items-center sm:justify-between sm:py-0">
        <p>{"\u00a9"} 2026 Finvayo</p>
        <p>Planning estimates, not financial advice.</p>
      </footer>
    </div>
  );
}
