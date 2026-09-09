import { FormEvent, useEffect, useState } from "react";

import { api } from "../api";
import { type Financials, type Overview, PageHeader, previewOverview, UpcomingLedger, fail, today } from "../appData";
import { AppShell } from "../components/AppShell";
import { money } from "../utils";

export default function AppPage() {
  const bootstrap = window.__FINVAYO__ ?? {};
  const preview = Boolean(bootstrap.preview);
  const [overview, setOverview] = useState<Overview | null>(preview ? previewOverview : null);
  const [currency, setCurrency] = useState("USD");
  const [balance, setBalance] = useState({ amount: "", date: today() });
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    const result = await api<Financials>("/api/financials");
    setOverview(result.overview);
    setCurrency(result.currency || "USD");
  }

  useEffect(() => {
    if (!preview) load().catch((error) => setMessage(fail(error, "Unable to load your overview.")));
  }, [preview]);

  async function confirmBalance(event: FormEvent) {
    event.preventDefault();
    if (!/^-?\d+(?:\.\d{1,2})?$/.test(balance.amount)) return setMessage("Enter a valid balance with up to two decimal places.");
    setBusy(true);
    try {
      await api("/api/cash-snapshots", { method: "POST", body: JSON.stringify({ balanceMinor: Math.round(Number(balance.amount) * 100), effectiveDate: balance.date }) });
      await load();
      setMessage("Current cash confirmed and forecast updated.");
    } catch (error) { setMessage(fail(error, "Unable to confirm balance.")); } finally { setBusy(false); }
  }

  const riskLabel = !overview ? "Setup needed" : overview.risk === "normal" ? "On track" : overview.risk === "caution" ? "Caution" : "At risk";
  const safeSummary = !overview ? "Confirm your current cash to calculate a real 90-day outlook." : overview.provisional ? "Your outlook is provisional because transactions were recorded after the last balance confirmation." : overview.risk === "normal" ? "Your protected cash stays intact for the next 90 days." : overview.risk === "caution" ? `Projected cash crosses your protected level on ${overview.firstBreachDate}.` : `Projected cash falls below zero by ${overview.firstNegativeDate}.`;

  return <AppShell activePage="overview" preview={preview}><main className="app-main" id="app-main">
    {preview ? <div className="preview-banner"><span>Product preview</span><p>This workspace uses sample data. Create your own workspace in a few seconds.</p><a href="/signup">Start free</a></div> : <div className="preview-banner account-banner"><span>{bootstrap.user?.trialDays ?? 0} days left in trial</span><p>Your workspace is ready. Add real cash data to replace this guided example.</p><a href="#balance-form">Start setup</a></div>}
    <PageHeader kicker="Your cash outlook" title={`Good to see you, ${bootstrap.user?.displayName || "there"}.`}><div className="review-state" data-risk={overview?.risk}><i /><span>{riskLabel}</span><strong>{!overview ? "Confirm current cash" : overview.provisional ? "Balance confirmation needed" : `Based on data through ${overview.horizonEnd}`}</strong></div></PageHeader>
    <section className="decision-grid" aria-label="Current cash position">
      <article className="safe-card"><div className="card-heading"><h2>Safe to spend now</h2><button type="button" aria-label="About safe to spend" title="Your current cash minus reserves, buffer, and planned outgoings.">?</button></div><p className="safe-amount">{overview ? money(overview.safeToSpendMinor, currency) : "—"}</p><p className="safe-summary"><i />{safeSummary}</p><div className="safe-breakdown"><div><span>Current cash</span><strong>{overview ? money(overview.currentCashMinor, currency) : "Not confirmed"}</strong></div><div><span>Tax reserved</span><strong>{overview ? money(overview.taxReserveMinor, currency) : "—"}</strong></div><div><span>Minimum buffer</span><strong>{overview ? money(overview.minimumBufferMinor, currency) : "—"}</strong></div></div><form className="balance-form" id="balance-form" onSubmit={confirmBalance}><label className="transaction-field"><span>Confirm current cash</span><input inputMode="decimal" required placeholder="0.00" value={balance.amount} onChange={(event) => setBalance({ ...balance, amount: event.target.value })} disabled={preview || busy} /></label><label className="transaction-field"><span>As of</span><input type="date" required value={balance.date} onChange={(event) => setBalance({ ...balance, date: event.target.value })} disabled={preview || busy} /></label><button className="button button-secondary" type="submit" disabled={preview || busy}>Confirm balance</button><p className="transaction-message" role="status" aria-live="polite">{message}</p></form></article>
      <article className="action-card"><div className="card-heading"><span>Recommended action</span><small>Today</small></div><p className="action-type">{overview?.recommendation.type || "First step"}</p><h2>{overview?.recommendation.title || "Confirm the cash currently available to your business."}</h2><div className="action-meta"><span>{overview?.recommendation.detail || "Required for forecast"}</span><strong>{overview?.recommendation.amountMinor == null ? "" : money(overview.recommendation.amountMinor, currency)}</strong></div><a href={overview?.recommendation.type === "Invoice follow-up" ? "/app/reviews" : overview ? "/app/cash-plan" : "#balance-form"}>Review next step <span aria-hidden="true">→</span></a></article>
    </section>
    <section className="overview-upcoming"><UpcomingLedger overview={overview} currency={currency} compact /></section>
  </main></AppShell>;
}
