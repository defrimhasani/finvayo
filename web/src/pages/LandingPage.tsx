import { Brand } from "../components/Brand";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";

export function LandingPage() {
  return (
    <>
      <a className="skip-link" href="#main">Skip to content</a>
      <header className="site-header">
        <Brand />
        <nav aria-label="Primary navigation">
          <a href="#how-it-works">How it works</a>
          <a href="#principles">Why Finvayo</a>
          <a href="/login">Sign in</a>
          <Button asChild className="nav-cta"><a href="/signup">Start free</a></Button>
        </nav>
      </header>

      <main id="main">
        <section className="hero">
          <div className="hero-copy">
            <p className="eyebrow">A 90-day cash outlook for independent businesses</p>
            <h1>Know what your business can <em>safely spend.</em></h1>
            <p className="lede">See when cash gets tight, protect money for tax and bills, and know which payment needs your attention. No accounting overhaul required.</p>
            <div className="hero-actions">
              <Button asChild className="button button-primary"><a href="/signup">Start free for 14 days <span aria-hidden="true">{"\u2197"}</span></a></Button>
              <a className="text-link" href="#how-it-works">See how it works <span aria-hidden="true">{"\u2193"}</span></a>
            </div>
            <p className="quiet-note">Built for freelancers, consultants, and small studios.</p>
          </div>

          <Card className="forecast-card" role="img" aria-label="Example cash outlook: $4,280 safe to spend, with projected cash remaining above the protected buffer for 90 days.">
            <div className="card-topline"><span>90-day outlook</span><span className="status"><i /> On track</span></div>
            <p className="metric-label">Safe to spend now</p>
            <p className="metric">$4,280</p>
            <p className="metric-context">after tax, bills, and your $2,000 buffer</p>
            <div className="chart" aria-hidden="true">
              <div className="chart-label label-high">$12k</div>
              <div className="chart-label label-low">$2k</div>
              <div className="buffer-line"><span>protected buffer</span></div>
              <svg viewBox="0 0 560 190" preserveAspectRatio="none">
                <path className="area" d="M0 44 H78 V68 H158 V38 H235 V92 H320 V72 H405 V126 H480 V88 H560 V64 V190 H0Z" />
                <path className="line" d="M0 44 H78 V68 H158 V38 H235 V92 H320 V72 H405 V126 H480 V88 H560 V64" />
                <circle cx="405" cy="126" r="5" />
              </svg>
              <div className="chart-dates"><span>Today</span><span>30 days</span><span>60 days</span><span>90 days</span></div>
            </div>
            <div className="forecast-note">
              <span className="note-index">01</span>
              <p>Your lowest projected balance is <strong>$5,940 on 18 Oct</strong>, leaving $1,120 above your protected cash.</p>
            </div>
          </Card>
        </section>

        <section className="decision-strip" aria-label="Questions Finvayo answers">
          <p>Three questions. One clear view.</p>
          <ol>
            <li><span>01</span> What can I spend?</li>
            <li><span>02</span> When does cash get tight?</li>
            <li><span>03</span> Who should I follow up?</li>
          </ol>
        </section>

        <section className="process" id="how-it-works">
          <div className="section-heading">
            <p className="eyebrow">A calmer weekly rhythm</p>
            <h2>Five minutes between you and a clearer decision.</h2>
          </div>
          <div className="steps">
            <article><span>01 / Set the baseline</span><h3>Start with what is real.</h3><p>Enter your current cash, upcoming bills, tax reserve, and the balance you refuse to cross.</p></article>
            <article><span>02 / Look ahead</span><h3>See the pressure points.</h3><p>Finvayo lays out the next 90 days and shows exactly which dates and payments shape your runway.</p></article>
            <article><span>03 / Take one action</span><h3>Know what matters now.</h3><p>Check a purchase, follow up an overdue invoice, or hold spending before it becomes a cash problem.</p></article>
          </div>
        </section>

        <section className="principles" id="principles">
          <div><p className="eyebrow">Not another accounting dashboard</p><h2>Your numbers, translated into a decision.</h2></div>
          <div className="principle-list">
            <article><span>Clear</span><p>Every estimate shows the entries and assumptions behind it.</p></article>
            <article><span>Conservative</span><p>Overdue or unlikely income never quietly props up your safe-to-spend amount.</p></article>
            <article><span>Private</span><p>Start without connecting a bank. Your financial data is never sold for advertising.</p></article>
          </div>
        </section>

        <section className="closing">
          <p className="eyebrow">Start without a payment method</p>
          <h2>Make the next decision with the next 90 days in view.</h2>
          <Button asChild className="button button-light" variant="light"><a href="/signup">Start free for 14 days <span aria-hidden="true">{"\u2197"}</span></a></Button>
        </section>
      </main>

      <footer>
        <a className="wordmark footer-mark" href="/">Finvayo</a>
        <p>Calm cash-flow decisions for independent businesses.</p>
        <p>{"\u00a9"} 2026 Finvayo</p>
      </footer>
    </>
  );
}
