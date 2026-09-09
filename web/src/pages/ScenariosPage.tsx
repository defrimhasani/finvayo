import { FormEvent, useEffect, useState } from "react";
import { api } from "../api";
import {
  fail,
  type Financials,
  PageHeader,
  today,
  validPositiveAmount,
} from "../appData";
import { AppShell } from "../components/AppShell";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
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
      <main className="app-main" id="app-main">
        <PageHeader kicker="Decision support" title="Scenarios" />
        <Card className="scenario-card scenario-page-card">
          <p className="app-kicker">Before you commit</p>
          <h2>Check a purchase.</h2>
          <p>
            See how a new expense changes your protected cash before adding it
            to the plan.
          </p>
          <form onSubmit={submit}>
            <div className="scenario-fields">
              <Label className="transaction-field">
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
              <Label className="transaction-field">
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
            <Button className="button button-primary" type="submit">
              Run scenario
            </Button>
            {result && (
              <Button
                className="button button-secondary"
                variant="secondary"
                type="button"
                onClick={addToPlan}
              >
                Add to plan
              </Button>
            )}
            <small>{message}</small>
          </form>
        </Card>
      </main>
    </AppShell>
  );
}
