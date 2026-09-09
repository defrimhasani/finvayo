import { Brand } from "../components/Brand";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";

export function LandingPage() {
  return (
    <>
      <a className="fixed -top-16 left-4 z-50 bg-primary px-4 py-3 text-primary-foreground focus-visible:top-4" href="#main">Skip to content</a>
      <header className="mx-auto flex min-h-18 w-[min(calc(100%-2rem),1240px)] items-center justify-between border-b sm:min-h-20 sm:w-[min(calc(100%-3rem),1240px)]">
        <Brand />
        <nav className="flex items-center gap-0 text-[0.82rem] font-semibold md:gap-8" aria-label="Primary navigation">
          <a className="hidden py-2.5 no-underline md:block" href="#how-it-works">How it works</a>
          <a className="hidden py-2.5 no-underline md:block" href="#principles">Why Finvayo</a>
          <a className="hidden py-2.5 no-underline md:block" href="/login">Sign in</a>
          <Button nativeButton={false} render={<a href="/signup" />} size="sm">Start free</Button>
        </nav>
      </header>

      <main id="main">
        <section className="mx-auto grid min-h-0 w-[min(calc(100%-2rem),1240px)] grid-cols-1 items-center gap-16 py-14 sm:w-[min(calc(100%-3rem),1240px)] sm:py-20 lg:min-h-[690px] lg:grid-cols-[minmax(0,0.88fr)_minmax(520px,1.12fr)] lg:gap-[clamp(3rem,7vw,8rem)] lg:py-24">
          <div>
            <p className="mb-6 font-mono text-[0.7rem] font-medium uppercase tracking-[0.12em] text-muted-foreground before:mr-2.5 before:inline-block before:w-7 before:border-t-2 before:border-accent before:align-middle">A 90-day cash outlook for independent businesses</p>
            <h1 className="mb-7 max-w-[710px] text-balance text-[clamp(3.25rem,16vw,5rem)] font-semibold leading-[0.92] tracking-[-0.072em] sm:text-[clamp(3.5rem,6.4vw,6.7rem)]">Know what your business can <em className="font-serif font-medium text-accent">safely spend.</em></h1>
            <p className="max-w-[590px] text-pretty text-[clamp(1rem,1.5vw,1.18rem)] leading-[1.7] text-muted-foreground">See when cash gets tight, protect money for tax and bills, and know which payment needs your attention. No accounting overhaul required.</p>
            <div className="mt-9 flex flex-col items-start gap-7 sm:flex-row sm:items-center">
              <Button nativeButton={false} render={<a href="/signup" />}>Start free for 14 days <span aria-hidden="true">{"\u2197"}</span></Button>
              <a className="text-sm font-semibold underline underline-offset-[0.3rem]" href="#how-it-works">See how it works <span aria-hidden="true">{"\u2193"}</span></a>
            </div>
            <p className="mt-6 font-mono text-[0.68rem] text-muted-foreground">Built for freelancers, consultants, and small studios.</p>
          </div>

          <Card className="relative overflow-hidden p-[clamp(1.5rem,3vw,2.75rem)] shadow-[8px_8px_0_var(--foreground)] after:absolute after:right-0 after:top-0 after:h-2 after:w-[54px] after:bg-accent sm:shadow-[18px_18px_0_var(--foreground)]" role="img" aria-label="Example cash outlook: $4,280 safe to spend, with projected cash remaining above the protected buffer for 90 days.">
            <div className="flex justify-between border-b pb-6 font-mono text-[0.7rem] uppercase tracking-[0.12em]"><span>90-day outlook</span><span className="text-muted-foreground"><i className="mr-1.5 inline-block size-1.5 rounded-full bg-accent" /> On track</span></div>
            <p className="mb-1 mt-8 font-mono text-[0.7rem] uppercase tracking-[0.12em] text-muted-foreground">Safe to spend now</p>
            <p className="font-mono text-[3.25rem] leading-none tracking-[-0.08em] tabular-nums sm:text-[clamp(3rem,6vw,5.1rem)]">$4,280</p>
            <p className="mt-1 text-xs text-muted-foreground">after tax, bills, and your $2,000 buffer</p>
            <div className="relative my-8 h-[230px] border-y bg-[linear-gradient(var(--border)_1px,transparent_1px)] bg-[size:100%_33.333%]" aria-hidden="true">
              <div className="absolute left-0 top-2 font-mono text-[0.58rem] text-muted-foreground">$12k</div>
              <div className="absolute bottom-[43px] left-0 font-mono text-[0.58rem] text-muted-foreground">$2k</div>
              <div className="absolute bottom-14 right-0 z-10 w-[calc(100%-42px)] border-t border-dashed border-accent"><span className="absolute bottom-1 right-0 font-mono text-[0.55rem] uppercase text-muted-foreground">protected buffer</span></div>
              <svg className="absolute right-0 top-0 h-[190px] w-[calc(100%-42px)] overflow-visible" viewBox="0 0 560 190" preserveAspectRatio="none">
                <path className="fill-accent/10" d="M0 44 H78 V68 H158 V38 H235 V92 H320 V72 H405 V126 H480 V88 H560 V64 V190 H0Z" />
                <path className="fill-none stroke-foreground stroke-[3] [vector-effect:non-scaling-stroke]" d="M0 44 H78 V68 H158 V38 H235 V92 H320 V72 H405 V126 H480 V88 H560 V64" />
                <circle className="fill-card stroke-foreground stroke-[3]" cx="405" cy="126" r="5" />
              </svg>
              <div className="absolute bottom-2.5 right-0 flex w-[calc(100%-42px)] justify-between font-mono text-[0.57rem] text-muted-foreground"><span>Today</span><span>30 days</span><span>60 days</span><span>90 days</span></div>
            </div>
            <div className="grid grid-cols-[34px_1fr] items-start gap-4">
              <span className="grid size-[30px] place-items-center rounded-full border font-mono text-[0.6rem]">01</span>
              <p className="text-xs leading-relaxed">Your lowest projected balance is <strong>$5,940 on 18 Oct</strong>, leaving $1,120 above your protected cash.</p>
            </div>
          </Card>
        </section>

        <section className="grid grid-cols-1 gap-8 bg-primary px-[max(1rem,calc((100vw-1240px)/2))] py-11 text-primary-foreground md:grid-cols-[0.55fr_1.45fr]" aria-label="Questions Finvayo answers">
          <p className="font-mono text-[0.66rem] uppercase tracking-[0.1em] text-white/70">Three questions. One clear view.</p>
          <ol className="grid list-none grid-cols-1 gap-8 p-0 sm:grid-cols-3">
            <li className="text-sm"><span className="mb-2 block font-mono text-[0.6rem] text-accent">01</span> What can I spend?</li>
            <li className="text-sm"><span className="mb-2 block font-mono text-[0.6rem] text-accent">02</span> When does cash get tight?</li>
            <li className="text-sm"><span className="mb-2 block font-mono text-[0.6rem] text-accent">03</span> Who should I follow up?</li>
          </ol>
        </section>

        <section className="mx-auto w-[min(calc(100%-2rem),1240px)] py-22 sm:w-[min(calc(100%-3rem),1240px)] sm:py-32" id="how-it-works">
          <div className="grid grid-cols-1 md:grid-cols-[0.55fr_1.45fr]">
            <p className="mb-6 font-mono text-[0.7rem] font-medium uppercase tracking-[0.12em] text-muted-foreground before:mr-2.5 before:inline-block before:w-7 before:border-t-2 before:border-accent before:align-middle">A calmer weekly rhythm</p>
            <h2 className="mb-12 max-w-[760px] text-balance text-[clamp(2.4rem,5vw,4.8rem)] font-medium leading-none tracking-[-0.065em] sm:mb-18">Five minutes between you and a clearer decision.</h2>
          </div>
          <div className="grid grid-cols-1 border-t md:grid-cols-3">
            <article className="border-b py-6 md:min-h-[280px] md:border-b-0 md:border-r md:pr-9"><span className="font-mono text-[0.7rem] uppercase tracking-[0.12em] text-accent">01 / Set the baseline</span><h3 className="mb-4 mt-8 text-xl font-semibold tracking-[-0.04em] md:mt-16">Start with what is real.</h3><p className="text-sm leading-7 text-muted-foreground">Enter your current cash, upcoming bills, tax reserve, and the balance you refuse to cross.</p></article>
            <article className="border-b py-6 md:min-h-[280px] md:border-b-0 md:border-r md:px-9"><span className="font-mono text-[0.7rem] uppercase tracking-[0.12em] text-accent">02 / Look ahead</span><h3 className="mb-4 mt-8 text-xl font-semibold tracking-[-0.04em] md:mt-16">See the pressure points.</h3><p className="text-sm leading-7 text-muted-foreground">Finvayo lays out the next 90 days and shows exactly which dates and payments shape your runway.</p></article>
            <article className="border-b py-6 md:min-h-[280px] md:border-b-0 md:pl-9"><span className="font-mono text-[0.7rem] uppercase tracking-[0.12em] text-accent">03 / Take one action</span><h3 className="mb-4 mt-8 text-xl font-semibold tracking-[-0.04em] md:mt-16">Know what matters now.</h3><p className="text-sm leading-7 text-muted-foreground">Check a purchase, follow up an overdue invoice, or hold spending before it becomes a cash problem.</p></article>
          </div>
        </section>

        <section className="mx-auto grid w-[min(calc(100%-2rem),1240px)] grid-cols-1 gap-16 border-t py-22 sm:w-[min(calc(100%-3rem),1240px)] sm:py-32 md:grid-cols-2 md:gap-20" id="principles">
          <div><p className="mb-6 font-mono text-[0.7rem] font-medium uppercase tracking-[0.12em] text-muted-foreground before:mr-2.5 before:inline-block before:w-7 before:border-t-2 before:border-accent before:align-middle">Not another accounting dashboard</p><h2 className="max-w-[760px] text-balance text-[clamp(2.4rem,5vw,4.8rem)] font-medium leading-none tracking-[-0.065em]">Your numbers, translated into a decision.</h2></div>
          <div>
            <article className="grid grid-cols-1 gap-3 border-b py-6 sm:grid-cols-[120px_1fr]"><span className="font-mono text-xs uppercase">Clear</span><p className="text-sm leading-7 text-muted-foreground">Every estimate shows the entries and assumptions behind it.</p></article>
            <article className="grid grid-cols-1 gap-3 border-b py-6 sm:grid-cols-[120px_1fr]"><span className="font-mono text-xs uppercase">Conservative</span><p className="text-sm leading-7 text-muted-foreground">Overdue or unlikely income never quietly props up your safe-to-spend amount.</p></article>
            <article className="grid grid-cols-1 gap-3 border-b py-6 sm:grid-cols-[120px_1fr]"><span className="font-mono text-xs uppercase">Private</span><p className="text-sm leading-7 text-muted-foreground">Start without connecting a bank. Your financial data is never sold for advertising.</p></article>
          </div>
        </section>

        <section className="flex min-h-[520px] flex-col items-start justify-center bg-secondary px-[max(1rem,calc((100vw-1240px)/2))] py-24 text-secondary-foreground">
          <p className="mb-6 font-mono text-[0.7rem] font-medium uppercase tracking-[0.12em] before:mr-2.5 before:inline-block before:w-7 before:border-t-2 before:border-accent before:align-middle">Start without a payment method</p>
          <h2 className="mb-10 max-w-[850px] text-balance text-[clamp(2.4rem,5vw,4.8rem)] font-medium leading-none tracking-[-0.065em]">Make the next decision with the next 90 days in view.</h2>
          <Button nativeButton={false} render={<a href="/signup" />}>Start free for 14 days <span aria-hidden="true">{"\u2197"}</span></Button>
        </section>
      </main>

      <footer className="mx-auto flex min-h-[130px] w-[min(calc(100%-2rem),1240px)] flex-col items-start justify-center gap-4 py-10 font-mono text-[0.65rem] text-muted-foreground sm:w-[min(calc(100%-3rem),1240px)] sm:flex-row sm:items-center sm:justify-between sm:py-0">
        <a className="font-sans text-base font-bold tracking-[-0.04em] text-foreground no-underline" href="/">Finvayo</a>
        <p>Calm cash-flow decisions for independent businesses.</p>
        <p>{"\u00a9"} 2026 Finvayo</p>
      </footer>
    </>
  );
}
