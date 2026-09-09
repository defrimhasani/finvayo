import { FormEvent, useEffect, useState } from "react";
import { api } from "../api";
import {
  type CashEntry,
  fail,
  type Financials,
  type Workflows,
} from "../appData";
import { AppShell } from "../components/AppShell";
import { Button } from "../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "../components/ui/card";
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
      <main
        className="min-h-screen w-full px-4 pb-28 pt-6 min-[761px]:px-6 min-[761px]:pb-20 min-[761px]:pt-8 min-[1200px]:px-8"
        id="app-main"
      >
        <header className="flex min-h-28 items-center border-b border-border min-[761px]:min-h-[150px]">
          <div>
            <p className="mb-2 font-mono text-[0.7rem] uppercase leading-[1.35] tracking-[0.08em] text-[#3f665e]">
              Weekly rhythm
            </p>
            <h1 className="text-[clamp(2.5rem,4.2vw,4.5rem)] font-semibold leading-none tracking-[-0.06em]">
              Reviews
            </h1>
          </div>
        </header>
        <section className="mt-5 grid items-start gap-5 lg:grid-cols-[minmax(300px,380px)_minmax(0,1fr)]">
          <Card>
            <form onSubmit={completeReview}>
              <CardHeader>
                <p className="font-mono text-[0.7rem] uppercase leading-[1.35] tracking-[0.08em] text-[#3f665e]">
                  Five-minute routine
                </p>
                <h2 className="text-xl font-semibold tracking-[-0.04em]">
                  Weekly review
                </h2>
                <CardDescription>
                  {workflows.lastReview
                    ? `Last completed ${new Date(workflows.lastReview.completedAt * 1000).toLocaleDateString(undefined, { dateStyle: "medium" })}. ${workflows.lastReview.summary}`
                    : "No review completed yet."}
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3">
                {[
                  ["cash", "Confirm current cash balance"],
                  ["income", "Mark received payments"],
                  ["expenses", "Mark paid obligations"],
                  ["overdue", "Review overdue income"],
                  ["outlook", "Review the next 30 days"],
                ].map(([value, label]) => (
                  <Label
                    className="flex cursor-pointer items-start gap-3 py-1 font-sans text-sm normal-case tracking-normal text-foreground"
                    key={value}
                  >
                    <Checkbox
                      className="mt-0.5 size-4 min-h-4 shrink-0"
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
                <Button className="mt-2 w-full" type="submit">
                  Complete weekly review
                </Button>
                <p
                  className="min-h-5 text-xs leading-5 text-muted-foreground"
                  role="status"
                  aria-live="polite"
                >
                  {reviewMessage}
                </p>
              </CardContent>
            </form>
          </Card>
          <Card>
            <CardHeader>
              <p className="font-mono text-[0.7rem] uppercase leading-[1.35] tracking-[0.08em] text-[#3f665e]">
                Get paid sooner
              </p>
              <h2 className="text-xl font-semibold tracking-[-0.04em]">
                Invoice follow-up
              </h2>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="review-overdue-payment">Overdue payment</Label>
                <Select
                  value={followUp.entryId}
                  onValueChange={(value) =>
                    setFollowUp({ ...followUp, entryId: value ?? "" })
                  }
                >
                  <SelectTrigger id="review-overdue-payment">
                    <SelectValue
                      placeholder={overdue.length
                        ? "Choose an overdue payment"
                        : "No overdue payments"}
                     >
                       {(value) => {
                         const entry = overdue.find((item) => item.id === value);
                         return entry
                           ? `${entry.partyName || entry.clientName || entry.name} · ${money(entry.amountMinor, currency)}`
                           : overdue.length
                             ? "Choose an overdue payment"
                             : "No overdue payments";
                       }}
                     </SelectValue>
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
              <div className="grid gap-2">
                <Label htmlFor="review-follow-up-tone">Tone</Label>
                <Select
                  value={followUp.tone}
                  onValueChange={(value) =>
                    setFollowUp({ ...followUp, tone: value ?? "friendly" })
                  }
                  >
                    <SelectTrigger id="review-follow-up-tone">
                     <SelectValue>
                       {() =>
                         followUp.tone === "direct"
                           ? "Direct follow-up"
                           : followUp.tone === "final"
                             ? "Final notice"
                             : "Friendly reminder"
                       }
                     </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="friendly">Friendly reminder</SelectItem>
                    <SelectItem value="direct">Direct follow-up</SelectItem>
                    <SelectItem value="final">Final notice</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button
                variant="secondary"
                type="button"
                disabled={!followUp.entryId}
                onClick={generate}
              >
                Generate message
              </Button>
              <Label className="grid gap-2">
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
              <div className="grid gap-3 sm:grid-cols-2">
                <Button
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
                  type="button"
                  disabled={!followUp.entryId || !followUp.message}
                  onClick={record}
                >
                  Record follow-up
                </Button>
              </div>
              <p
                className="min-h-5 text-xs leading-5 text-muted-foreground"
                role="status"
                aria-live="polite"
              >
                {followUpStatus}
              </p>
            </CardContent>
          </Card>
        </section>
      </main>
    </AppShell>
  );
}
