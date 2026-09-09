import { FormEvent, useEffect, useState } from "react";
import { api } from "../api";
import {
  fail,
  type Financials,
  today,
  validPositiveAmount,
} from "../appData";
import { AppShell } from "../components/AppShell";
import { Button } from "../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { money } from "../utils";

type Result = {
  amountMinor: number;
  date: string;
  risk: string;
  lowestBalanceMinor: number;
  safeToSpendChangeMinor: number;
};
export default function ScenariosPage() {
  const [currency, setCurrency] = useState("USD");
  const [scenario, setScenario] = useState({ amount: "", date: today() });
  const [result, setResult] = useState<Result | null>(null);
  const [message, setMessage] = useState(
    "Uses your current 90-day outlook and does not save anything.",
  );
  useEffect(() => {
    api<Financials>("/api/financials")
      .then((r) => setCurrency(r.currency || "USD"))
      .catch((e) => setMessage(fail(e, "Unable to load workspace data.")));
  }, []);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!validPositiveAmount(scenario.amount))
      return setMessage(
        "Enter a valid positive amount with up to two decimal places.",
      );
    try {
      const next = await api<Result>("/api/scenarios", {
        method: "POST",
        body: JSON.stringify({
          amountMinor: Math.round(Number(scenario.amount) * 100),
          date: scenario.date,
        }),
      });
      setResult(next);
      const state =
        next.risk === "at_risk"
          ? "at risk"
          : next.risk === "caution"
            ? "caution"
            : "within your protected plan";
      setMessage(
        `Lowest projected cash: ${money(next.lowestBalanceMinor, currency)}. Safe-to-spend changes by ${money(next.safeToSpendChangeMinor, currency)}: ${state}.`,
      );
    } catch (e) {
      setResult(null);
      setMessage(fail(e, "Unable to run scenario."));
    }
  }
  function addToPlan() {
    if (
      !result ||
      result.amountMinor <= 0 ||
      !/^\d{4}-\d{2}-\d{2}$/.test(result.date)
    )
      return;
    const query = new URLSearchParams({
      amount: (result.amountMinor / 100).toFixed(2),
      date: result.date,
      name: "Scenario purchase",
      category: "equipment",
    });
    window.location.assign(`/app/transactions?${query.toString()}`);
  }
  return (
    <AppShell activePage="scenarios">
      <main
        className="min-h-screen w-full px-4 pb-28 pt-6 min-[761px]:px-6 min-[761px]:pb-20 min-[761px]:pt-8 min-[1200px]:px-8"
        id="app-main"
      >
        <header className="flex min-h-28 items-center border-b border-border min-[761px]:min-h-[150px]">
          <div>
            <p className="mb-2 font-mono text-[0.7rem] uppercase leading-[1.35] tracking-[0.08em] text-[#3f665e]">
              Decision support
            </p>
            <h1 className="text-[clamp(2.5rem,4.2vw,4.5rem)] font-semibold leading-none tracking-[-0.06em]">
              Scenarios
            </h1>
          </div>
        </header>
        <Card className="mt-5 w-full max-w-[760px] bg-muted">
          <CardHeader>
            <p className="font-mono text-[0.7rem] uppercase leading-[1.35] tracking-[0.08em] text-[#3f665e]">
              Before you commit
            </p>
            <h2 className="text-xl font-semibold tracking-[-0.04em]">
              Check a purchase.
            </h2>
            <CardDescription>
              See how a new expense changes your protected cash before adding
              it to the plan.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="grid gap-4" onSubmit={submit}>
              <div className="grid gap-4 sm:grid-cols-2">
                <Label className="grid gap-2">
                  <span>Amount</span>
                  <Input
                    inputMode="decimal"
                    required
                    value={scenario.amount}
                    onChange={(e) =>
                      setScenario({ ...scenario, amount: e.target.value })
                    }
                  />
                </Label>
                <Label className="grid gap-2">
                  <span>Payment date</span>
                  <Input
                    type="date"
                    required
                    value={scenario.date}
                    onChange={(e) =>
                      setScenario({ ...scenario, date: e.target.value })
                    }
                  />
                </Label>
              </div>
              <Button className="w-full" type="submit">
                Run scenario
              </Button>
              {result && (
                <Button
                  className="w-full"
                  variant="secondary"
                  type="button"
                  onClick={addToPlan}
                >
                  Add to plan
                </Button>
              )}
              <p
                className="text-center text-xs leading-5 text-muted-foreground"
                role="status"
                aria-live="polite"
              >
                {message}
              </p>
            </form>
          </CardContent>
        </Card>
      </main>
    </AppShell>
  );
}
