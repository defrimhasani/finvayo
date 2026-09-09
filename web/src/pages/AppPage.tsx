import { FormEvent, useEffect, useState } from "react";

import { api } from "../api";
import {
  categoryActivity,
  type CategoryActivity,
  type CashEntry,
  type Direction,
  type Financials,
  type Overview,
  PageHeader,
  previewEntries,
  previewOverview,
  UpcomingLedger,
  fail,
  today,
} from "../appData";
import { AppShell } from "../components/AppShell";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../components/ui/tooltip";
import { money } from "../utils";

export default function AppPage() {
  const bootstrap = window.__FINVAYO__ ?? {};
  const preview = Boolean(bootstrap.preview);
  const [overview, setOverview] = useState<Overview | null>(
    preview ? previewOverview : null,
  );
  const [entries, setEntries] = useState<CashEntry[]>(
    preview ? previewEntries : [],
  );
  const [currency, setCurrency] = useState("USD");
  const [balance, setBalance] = useState({ amount: "", date: today() });
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    const result = await api<Financials>("/api/financials");
    setOverview(result.overview);
    setEntries(result.entries);
    setCurrency(result.currency || "USD");
  }

  useEffect(() => {
    if (!preview)
      load().catch((error) =>
        setMessage(fail(error, "Unable to load your overview.")),
      );
  }, [preview]);

  async function confirmBalance(event: FormEvent) {
    event.preventDefault();
    if (!/^-?\d+(?:\.\d{1,2})?$/.test(balance.amount))
      return setMessage("Enter a valid balance with up to two decimal places.");
    setBusy(true);
    try {
      await api("/api/cash-snapshots", {
        method: "POST",
        body: JSON.stringify({
          balanceMinor: Math.round(Number(balance.amount) * 100),
          effectiveDate: balance.date,
        }),
      });
      await load();
      setMessage("Current cash confirmed and forecast updated.");
    } catch (error) {
      setMessage(fail(error, "Unable to confirm balance."));
    } finally {
      setBusy(false);
    }
  }

  const riskLabel = !overview
    ? "Setup needed"
    : overview.risk === "normal"
      ? "On track"
      : overview.risk === "caution"
        ? "Caution"
        : "At risk";
  const safeSummary = !overview
    ? "Confirm your current cash to calculate a real 90-day outlook."
    : overview.provisional
      ? "Your outlook is provisional because transactions were recorded after the last balance confirmation."
      : overview.risk === "normal"
        ? "Your protected cash stays intact for the next 90 days."
        : overview.risk === "caution"
          ? `Projected cash crosses your protected level on ${overview.firstBreachDate}.`
          : `Projected cash falls below zero by ${overview.firstNegativeDate}.`;
  const inflowActivity = categoryActivity(entries, "inflow");
  const outflowActivity = categoryActivity(entries, "outflow");

  return (
    <AppShell activePage="overview" preview={preview}>
      <main className="app-main" id="app-main">
        {preview ? (
          <div className="preview-banner">
            <span>Product preview</span>
            <p>
              This workspace uses sample data. Create your own workspace in a
              few seconds.
            </p>
            <a href="/signup">Start free</a>
          </div>
        ) : (
          <div className="preview-banner account-banner">
            <span>{bootstrap.user?.trialDays ?? 0} days left in trial</span>
            <p>
              Your workspace is ready. Add real cash data to replace this guided
              example.
            </p>
            <a href="#balance-form">Start setup</a>
          </div>
        )}
        <PageHeader
          kicker="Your cash outlook"
          title={`Good to see you, ${bootstrap.user?.displayName || "there"}.`}
        >
          <div className="review-state" data-risk={overview?.risk}>
            <i />
            <span>{riskLabel}</span>
            <strong>
              {!overview
                ? "Confirm current cash"
                : overview.provisional
                  ? "Balance confirmation needed"
                  : `Based on data through ${overview.horizonEnd}`}
            </strong>
          </div>
        </PageHeader>
        <section className="decision-grid" aria-label="Current cash position">
          <article className="safe-card">
            <div className="card-heading">
              <h2>Safe to spend now</h2>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button className="min-h-0 rounded-full p-0" variant="ghost" size="icon" type="button" aria-label="About safe to spend">
                      ?
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    Your current cash minus reserves, buffer, and planned
                    outgoings.
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <p className="safe-amount">
              {overview ? money(overview.safeToSpendMinor, currency) : "—"}
            </p>
            <p className="safe-summary">
              <i />
              {safeSummary}
            </p>
            <div className="safe-breakdown">
              <div>
                <span>Current cash</span>
                <strong>
                  {overview
                    ? money(overview.currentCashMinor, currency)
                    : "Not confirmed"}
                </strong>
              </div>
              <div>
                <span>Tax reserved</span>
                <strong>
                  {overview ? money(overview.taxReserveMinor, currency) : "—"}
                </strong>
              </div>
              <div>
                <span>Minimum buffer</span>
                <strong>
                  {overview
                    ? money(overview.minimumBufferMinor, currency)
                    : "—"}
                </strong>
              </div>
            </div>
            <form
              className="balance-form"
              id="balance-form"
              onSubmit={confirmBalance}
            >
              <Label className="transaction-field">
                <span>Confirm current cash</span>
                <Input
                  inputMode="decimal"
                  required
                  placeholder="0.00"
                  value={balance.amount}
                  onChange={(event) =>
                    setBalance({ ...balance, amount: event.target.value })
                  }
                  disabled={preview || busy}
                />
              </Label>
              <Label className="transaction-field">
                <span>As of</span>
                <Input
                  type="date"
                  required
                  value={balance.date}
                  onChange={(event) =>
                    setBalance({ ...balance, date: event.target.value })
                  }
                  disabled={preview || busy}
                />
              </Label>
              <Button
                className="button button-secondary"
                variant="secondary"
                type="submit"
                disabled={preview || busy}
              >
                Confirm balance
              </Button>
              <p
                className="transaction-message"
                role="status"
                aria-live="polite"
              >
                {message}
              </p>
            </form>
          </article>
          <article className="action-card">
            <div className="card-heading">
              <span>Recommended action</span>
              <small>Today</small>
            </div>
            <p className="action-type">
              {overview?.recommendation.type || "First step"}
            </p>
            <h2>
              {overview?.recommendation.title ||
                "Confirm the cash currently available to your business."}
            </h2>
            <div className="action-meta">
              <span>
                {overview?.recommendation.detail || "Required for forecast"}
              </span>
              <strong>
                {overview?.recommendation.amountMinor == null
                  ? ""
                  : money(overview.recommendation.amountMinor, currency)}
              </strong>
            </div>
            <a
              href={
                overview?.recommendation.type === "Invoice follow-up"
                  ? "/app/reviews"
                  : overview
                    ? "/app/cash-plan"
                    : "#balance-form"
              }
            >
              Review next step <span aria-hidden="true">→</span>
            </a>
          </article>
        </section>
        <section
          className="category-activity-section"
          aria-labelledby="category-activity-title"
        >
          <div className="transactions-heading">
            <div>
              <p className="app-kicker">Activity mix</p>
              <h2 id="category-activity-title">Activity by category</h2>
            </div>
            <p>
              Recorded and planned entries currently in your workspace, grouped
              by category.
            </p>
          </div>
          <div className="category-activity-grid">
            <CategoryActivityChart
              title="Money in"
              direction="inflow"
              activity={inflowActivity}
              currency={currency}
            />
            <CategoryActivityChart
              title="Money out"
              direction="outflow"
              activity={outflowActivity}
              currency={currency}
            />
          </div>
        </section>
        <section className="overview-upcoming">
          <UpcomingLedger overview={overview} currency={currency} compact />
        </section>
      </main>
    </AppShell>
  );
}

function CategoryActivityChart({
  title,
  direction,
  activity,
  currency,
}: {
  title: string;
  direction: Direction;
  activity: CategoryActivity[];
  currency: string;
}) {
  const maximum = Math.max(...activity.map((item) => item.amountMinor), 1);
  const total = activity.reduce((sum, item) => sum + item.amountMinor, 0);
  return (
    <article className={`category-chart ${direction}`}>
      <div className="category-chart-heading">
        <div>
          <span>{title}</span>
          <strong>{money(total, currency)}</strong>
        </div>
        <small>
          {activity.reduce((sum, item) => sum + item.count, 0)} entries
        </small>
      </div>
      {activity.length === 0 ? (
        <p className="transaction-empty">
          No {direction === "inflow" ? "income" : "expense"} activity has been
          categorized yet.
        </p>
      ) : (
        <div
          className="category-bars"
          role="img"
          aria-label={`${title} by category. ${activity.map((item) => `${item.label}: ${money(item.amountMinor, currency)}`).join("; ")}`}
        >
          {activity.slice(0, 6).map((item) => (
            <div className="category-bar-row" key={item.category}>
              <div className="category-bar-label">
                <span>{item.label}</span>
                <strong>{money(item.amountMinor, currency)}</strong>
              </div>
              <div className="category-bar-track" aria-hidden="true">
                <span
                  style={{
                    width: `${Math.max(4, (item.amountMinor / maximum) * 100)}%`,
                  }}
                />
              </div>
              <small>
                {item.count} {item.count === 1 ? "entry" : "entries"}
              </small>
            </div>
          ))}
        </div>
      )}
    </article>
  );
}
