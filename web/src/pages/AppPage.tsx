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
import { Card } from "../components/ui/card";
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
      <main
        className="min-h-screen w-full px-4 pt-6 pb-[calc(7rem+env(safe-area-inset-bottom))] min-[761px]:px-6 min-[761px]:pt-8 min-[761px]:pb-20 min-[1200px]:px-8"
        id="app-main"
      >
        {preview ? (
          <div className="-mx-4 -mt-6 mb-6 flex min-h-10 items-center gap-5 bg-secondary px-4 py-3 text-[0.7rem] min-[761px]:mx-[clamp(-3.5rem,-3vw,-1.5rem)] min-[761px]:-mt-8 min-[761px]:mb-8 min-[761px]:px-[clamp(1.5rem,3vw,3.5rem)]">
            <span className="font-mono font-medium uppercase">
              Product preview
            </span>
            <p className="hidden sm:block">
              This workspace uses sample data. Create your own workspace in a
              few seconds.
            </p>
            <Button
              nativeButton={false}
              render={<a href="/signup" />}
              variant="link"
              className="ml-auto text-[0.7rem] font-bold"
            >
              Start free
            </Button>
          </div>
        ) : (
          <div className="-mx-4 -mt-6 mb-6 flex min-h-10 items-center gap-5 bg-[#d8e4dc] px-4 py-3 text-[0.7rem] min-[761px]:mx-[clamp(-3.5rem,-3vw,-1.5rem)] min-[761px]:-mt-8 min-[761px]:mb-8 min-[761px]:px-[clamp(1.5rem,3vw,3.5rem)]">
            <span className="font-mono font-medium uppercase">
              {bootstrap.user?.trialDays ?? 0} days left in trial
            </span>
            <p className="hidden sm:block">
              Your workspace is ready. Add real cash data to replace this guided
              example.
            </p>
            <Button
              nativeButton={false}
              render={<a href="#balance-form" />}
              variant="link"
              className="ml-auto text-[0.7rem] font-bold"
            >
              Start setup
            </Button>
          </div>
        )}
        <PageHeader
          kicker="Your cash outlook"
          title={`Good to see you, ${bootstrap.user?.displayName || "there"}.`}
        >
          <div
            className="grid grid-cols-[8px_auto] items-center gap-x-2.5"
            data-risk={overview?.risk}
          >
            <i className="row-span-2 size-[7px] rounded-full bg-[#175f57]" />
            <span className="font-mono text-[0.65rem] uppercase text-[#175f57]">
              {riskLabel}
            </span>
            <strong className="mt-0.5 hidden text-[0.65rem] font-medium text-muted-foreground min-[521px]:block">
              {!overview
                ? "Confirm current cash"
                : overview.provisional
                  ? "Balance confirmation needed"
                  : `Based on data through ${overview.horizonEnd}`}
            </strong>
          </div>
        </PageHeader>
        <section
          className="grid grid-cols-1 gap-5 min-[981px]:grid-cols-[minmax(0,1.5fr)_minmax(300px,0.8fr)]"
          aria-label="Current cash position"
        >
          <Card
            className="min-h-[360px] p-[clamp(1.5rem,3vw,2.5rem)] max-[520px]:shadow-[3px_3px_0_rgba(23,24,21,0.12)]"
            role="article"
          >
            <div className="flex items-center justify-between">
              <h2 className="m-0 font-mono text-[0.7rem] leading-[1.35] font-medium tracking-[0.08em] uppercase">
                Safe to spend now
              </h2>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger
                    render={<Button
                      className="size-6 min-h-0 rounded-full border-border p-0 text-muted-foreground"
                      variant="ghost"
                      size="icon"
                      type="button"
                      aria-label="About safe to spend"
                    />}
                  >
                    ?
                  </TooltipTrigger>
                  <TooltipContent>
                    Your current cash minus reserves, buffer, and planned
                    outgoings.
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <p className="mt-11 mb-2 font-mono text-[clamp(3.7rem,7vw,6.2rem)] leading-[0.9] tracking-[-0.085em] tabular-nums">
              {overview ? money(overview.safeToSpendMinor, currency) : "—"}
            </p>
            <p className="text-[0.78rem] text-[#175f57]">
              <i className="mr-2 inline-block size-1.5 rounded-full bg-[#175f57]" />
              {safeSummary}
            </p>
            <div className="mt-10 grid grid-cols-1 gap-4 border-t pt-5 min-[521px]:grid-cols-3">
              <div className="flex justify-between min-[521px]:block">
                <span className="block text-[0.62rem] text-muted-foreground">
                  Current cash
                </span>
                <strong className="block font-mono text-[0.78rem] tabular-nums min-[521px]:mt-1.5">
                  {overview
                    ? money(overview.currentCashMinor, currency)
                    : "Not confirmed"}
                </strong>
              </div>
              <div className="flex justify-between min-[521px]:block">
                <span className="block text-[0.62rem] text-muted-foreground">
                  Tax reserved
                </span>
                <strong className="block font-mono text-[0.78rem] tabular-nums min-[521px]:mt-1.5">
                  {overview ? money(overview.taxReserveMinor, currency) : "—"}
                </strong>
              </div>
              <div className="flex justify-between min-[521px]:block">
                <span className="block text-[0.62rem] text-muted-foreground">
                  Minimum buffer
                </span>
                <strong className="block font-mono text-[0.78rem] tabular-nums min-[521px]:mt-1.5">
                  {overview
                    ? money(overview.minimumBufferMinor, currency)
                    : "—"}
                </strong>
              </div>
            </div>
            <form
              className="mt-6 grid grid-cols-1 items-end gap-2.5 border-t pt-5 min-[521px]:grid-cols-[1fr_1fr_auto]"
              id="balance-form"
              onSubmit={confirmBalance}
            >
              <Label className="grid gap-2">
                <span className="text-[0.7rem] leading-[1.35]">
                  Confirm current cash
                </span>
                <Input
                  inputMode="decimal"
                  required
                  placeholder="0.00"
                  value={balance.amount}
                  onChange={(event) =>
                    setBalance({ ...balance, amount: event.target.value })
                  }
                  disabled={preview || busy}
                  className="rounded-[2px] text-[0.82rem]"
                />
              </Label>
              <Label className="grid gap-2">
                <span className="text-[0.7rem] leading-[1.35]">As of</span>
                <Input
                  type="date"
                  required
                  value={balance.date}
                  onChange={(event) =>
                    setBalance({ ...balance, date: event.target.value })
                  }
                  disabled={preview || busy}
                  className="rounded-[2px] text-[0.82rem]"
                />
              </Label>
              <Button
                className="min-h-[46px] px-4"
                variant="secondary"
                type="submit"
                disabled={preview || busy}
              >
                Confirm balance
              </Button>
              <p
                className="col-span-full m-0 min-h-[1em] text-[0.72rem] text-muted-foreground"
                role="status"
                aria-live="polite"
              >
                {message}
              </p>
            </form>
          </Card>
          <Card
            className="flex min-h-[300px] flex-col bg-foreground p-[clamp(1.5rem,3vw,2.5rem)] text-white min-[981px]:min-h-[360px] max-[520px]:shadow-[3px_3px_0_rgba(23,24,21,0.12)]"
            role="article"
          >
            <div className="flex items-center justify-between font-mono text-[0.7rem] leading-[1.35] tracking-[0.08em] text-[#c8d4cf] uppercase">
              <span>Recommended action</span>
              <small className="text-[0.7rem]">Today</small>
            </div>
            <p className="mt-auto mb-2 font-mono text-[0.62rem] text-accent uppercase">
              {overview?.recommendation.type || "First step"}
            </p>
            <h2 className="m-0 mb-5 text-[clamp(1.7rem,3vw,2.5rem)] tracking-[-0.055em]">
              {overview?.recommendation.title ||
                "Confirm the cash currently available to your business."}
            </h2>
            <div className="flex justify-between border-y border-white/20 py-4 font-mono text-[0.67rem] tabular-nums">
              <span>
                {overview?.recommendation.detail || "Required for forecast"}
              </span>
              <strong>
                {overview?.recommendation.amountMinor == null
                  ? ""
                  : money(overview.recommendation.amountMinor, currency)}
              </strong>
            </div>
            <Button
              nativeButton={false}
              render={
                <a
                  href={
                    overview?.recommendation.type === "Invoice follow-up"
                      ? "/app/reviews"
                      : overview
                        ? "/app/cash-plan"
                        : "#balance-form"
                  }
                />
              }
              variant="link"
              className="mt-5 self-start text-xs font-bold text-white"
            >
              Review next step <span aria-hidden="true">→</span>
            </Button>
          </Card>
        </section>
        <section
          className="mt-5 border border-foreground bg-card p-[clamp(1.4rem,3vw,2.5rem)] shadow-[5px_5px_0_rgba(23,24,21,0.12)] max-[520px]:shadow-[3px_3px_0_rgba(23,24,21,0.12)]"
          aria-labelledby="category-activity-title"
        >
          <div className="flex flex-col items-start justify-between gap-3 min-[761px]:flex-row min-[761px]:items-center">
            <div>
              <p className="mb-2 font-mono text-[0.7rem] leading-[1.35] tracking-[0.08em] text-[#3f665e] uppercase">
                Activity mix
              </p>
              <h2
                className="m-0 text-[1.4rem] tracking-[-0.045em]"
                id="category-activity-title"
              >
                Activity by category
              </h2>
            </div>
            <p className="m-0 max-w-xl text-sm text-muted-foreground">
              Recorded and planned entries currently in your workspace, grouped
              by category.
            </p>
          </div>
          <div className="mt-6 grid grid-cols-1 gap-5 min-[761px]:grid-cols-2">
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
        <section className="mt-5">
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
    <Card className="min-w-0 border-border bg-white p-5 shadow-none" role="article">
      <div className="flex items-baseline justify-between gap-4">
        <div>
          <span className="font-mono text-[0.65rem] tracking-[0.06em] uppercase">
            {title}
          </span>
          <strong className="mt-1 block text-[clamp(1.35rem,2vw,2rem)] tabular-nums">
            {money(total, currency)}
          </strong>
        </div>
        <small className="font-mono text-[0.65rem] tracking-[0.06em] uppercase">
          {activity.reduce((sum, item) => sum + item.count, 0)} entries
        </small>
      </div>
      {activity.length === 0 ? (
        <p className="m-0 border-t py-6 text-[0.72rem]">
          No {direction === "inflow" ? "income" : "expense"} activity has been
          categorized yet.
        </p>
      ) : (
        <div
          className="mt-6 grid gap-4"
          role="img"
          aria-label={`${title} by category. ${activity.map((item) => `${item.label}: ${money(item.amountMinor, currency)}`).join("; ")}`}
        >
          {activity.slice(0, 6).map((item) => (
            <div className="grid gap-1.5" key={item.category}>
              <div className="flex items-baseline justify-between gap-4">
                <span className="text-[0.78rem] font-semibold break-words">
                  {item.label}
                </span>
                <strong className="font-mono text-[0.7rem] tabular-nums">
                  {money(item.amountMinor, currency)}
                </strong>
              </div>
              <div
                className="h-3 border border-foreground bg-background"
                aria-hidden="true"
              >
                <span
                  className={`block h-full ${direction === "inflow" ? "bg-secondary" : "bg-accent"}`}
                  style={{
                    width: `${Math.max(4, (item.amountMinor / maximum) * 100)}%`,
                  }}
                />
              </div>
              <small className="font-mono text-[0.65rem] tracking-[0.06em] text-[#66706b] uppercase">
                {item.count} {item.count === 1 ? "entry" : "entries"}
              </small>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
