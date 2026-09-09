import { FormEvent, useEffect, useState } from "react";
import { api } from "../api";
import {
  type CashEntry,
  fail,
  type Financials,
  PageHeader,
  type Workflows,
} from "../appData";
import { AppShell } from "../components/AppShell";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Checkbox } from "../components/ui/checkbox";
import { Label } from "../components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { Textarea } from "../components/ui/textarea";
import { money } from "../utils";

export default function ReviewsPage() {
  const [entries, setEntries] = useState<CashEntry[]>([]);
  const [currency, setCurrency] = useState("USD");
  const [workflows, setWorkflows] = useState<Workflows>({});
  const [steps, setSteps] = useState<string[]>([]);
  const [reviewMessage, setReviewMessage] = useState("");
  const [followUp, setFollowUp] = useState({
    entryId: "",
    tone: "friendly",
    message: "",
  });
  const [followUpStatus, setFollowUpStatus] = useState("");
  async function load() {
    const [financials, flows] = await Promise.all([
      api<Financials>("/api/financials"),
      api<Workflows>("/api/workflows"),
    ]);
    setEntries(financials.entries);
    setCurrency(financials.currency || "USD");
    setWorkflows(flows);
    const overdue = financials.entries.filter(
      (e) => e.direction === "inflow" && e.status === "overdue",
    );
    setFollowUp((current) => ({
      ...current,
      entryId: overdue.some((e) => e.id === current.entryId)
        ? current.entryId
        : overdue[0]?.id || "",
    }));
  }
  useEffect(() => {
    load().catch((e) =>
      setReviewMessage(fail(e, "Unable to load review data.")),
    );
  }, []);
  const overdue = entries.filter(
    (entry) => entry.direction === "inflow" && entry.status === "overdue",
  );
  async function completeReview(event: FormEvent) {
    event.preventDefault();
    try {
      await api("/api/weekly-reviews", {
        method: "POST",
        body: JSON.stringify({ completed: steps }),
      });
      setSteps([]);
      await load();
      setReviewMessage("Weekly review completed.");
    } catch (e) {
      setReviewMessage(fail(e, "Unable to complete weekly review."));
    }
  }
  async function generate() {
    try {
      const result = await api<{ message: string }>("/api/follow-ups/preview", {
        method: "POST",
        body: JSON.stringify({
          entryId: followUp.entryId,
          tone: followUp.tone,
        }),
      });
      setFollowUp({ ...followUp, message: result.message });
      setFollowUpStatus("Message ready to review and edit.");
    } catch (e) {
      setFollowUpStatus(fail(e, "Unable to generate message."));
    }
  }
  async function record() {
    try {
      await api("/api/follow-ups", {
        method: "POST",
        body: JSON.stringify(followUp),
      });
      setFollowUpStatus("Follow-up recorded.");
      await load();
    } catch (e) {
      setFollowUpStatus(fail(e, "Unable to record follow-up."));
    }
  }
  return (
    <AppShell activePage="reviews">
      <main className="app-main" id="app-main">
        <PageHeader kicker="Weekly rhythm" title="Reviews" />
        <section className="workflow-grid">
          <form className="settings-card review-form" onSubmit={completeReview}>
            <p className="app-kicker">Five-minute routine</p>
            <h2>Weekly review</h2>
            <p className="settings-note">
              {workflows.lastReview
                ? `Last completed ${new Date(workflows.lastReview.completedAt * 1000).toLocaleDateString(undefined, { dateStyle: "medium" })}. ${workflows.lastReview.summary}`
                : "No review completed yet."}
            </p>
            {[
              ["cash", "Confirm current cash balance"],
              ["income", "Mark received payments"],
              ["expenses", "Mark paid obligations"],
              ["overdue", "Review overdue income"],
              ["outlook", "Review the next 30 days"],
            ].map(([value, label]) => (
              <Label className="terms-check" key={value}>
                <Checkbox
                  className="mt-[0.1rem] size-4 min-h-4"
                  checked={steps.includes(value)}
                  onCheckedChange={(checked) =>
                    setSteps(
                      checked === true
                        ? [...steps, value]
                        : steps.filter((s) => s !== value),
                    )
                  }
                />
                <span>{label}</span>
              </Label>
            ))}
            <Button className="button button-primary" type="submit">
              Complete weekly review
            </Button>
            <p className="transaction-message" role="status">
              {reviewMessage}
            </p>
          </form>
          <Card className="settings-card follow-up-card">
            <p className="app-kicker">Get paid sooner</p>
            <h2>Invoice follow-up</h2>
            <div className="transaction-field">
              <Label className="mb-[0.45rem] block text-[0.58rem]" htmlFor="review-overdue-payment">Overdue payment</Label>
              <Select
                value={followUp.entryId}
                onValueChange={(value) =>
                  setFollowUp({ ...followUp, entryId: value })
                }
              >
                <SelectTrigger id="review-overdue-payment">
                  <SelectValue
                    placeholder={overdue.length
                      ? "Choose an overdue payment"
                      : "No overdue payments"}
                  />
                </SelectTrigger>
                <SelectContent>
                  {overdue.map((entry) => (
                    <SelectItem key={entry.id} value={entry.id}>
                      {entry.partyName || entry.clientName || entry.name} ·{" "}
                      {money(entry.amountMinor, currency)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="transaction-field">
              <Label className="mb-[0.45rem] block text-[0.58rem]" htmlFor="review-follow-up-tone">Tone</Label>
              <Select
                value={followUp.tone}
                onValueChange={(value) =>
                  setFollowUp({ ...followUp, tone: value })
                }
              >
                <SelectTrigger id="review-follow-up-tone"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="friendly">Friendly reminder</SelectItem>
                  <SelectItem value="direct">Direct follow-up</SelectItem>
                  <SelectItem value="final">Final notice</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              className="button button-secondary"
              variant="secondary"
              type="button"
              disabled={!followUp.entryId}
              onClick={generate}
            >
              Generate message
            </Button>
            <Label className="transaction-field">
              <span>Message</span>
              <Textarea
                maxLength={2000}
                rows={6}
                value={followUp.message}
                onChange={(e) =>
                  setFollowUp({ ...followUp, message: e.target.value })
                }
              />
            </Label>
            <div className="billing-actions">
              <Button
                className="button button-secondary"
                variant="secondary"
                type="button"
                disabled={!followUp.message}
                onClick={async () => {
                  await navigator.clipboard.writeText(followUp.message);
                  setFollowUpStatus("Message copied.");
                }}
              >
                Copy message
              </Button>
              <Button
                className="button button-primary"
                type="button"
                disabled={!followUp.entryId || !followUp.message}
                onClick={record}
              >
                Record follow-up
              </Button>
            </div>
            <p className="transaction-message" role="status">
              {followUpStatus}
            </p>
          </Card>
        </section>
      </main>
    </AppShell>
  );
}
