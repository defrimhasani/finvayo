import React, { useEffect, useState } from "react";

import { api } from "../api";
import type { FinvayoBootstrap } from "../types";

type Direction = "inflow" | "outflow";
type Timing = "recorded" | "planned";
type PartyRole = "customer" | "supplier" | "both";

type CashEntry = {
  id: string;
  direction: Direction;
  name: string;
  amountMinor: number;
  actualAmountMinor?: number | null;
  actualDate?: string | null;
  scheduledDate: string;
  status: string;
  storedStatus?: string;
  included?: boolean;
  partyId?: string | null;
  partyName?: string | null;
  clientName?: string | null;
  invoiceReference?: string | null;
  category?: string | null;
  recurrence?: string | null;
};

type Party = {
  id: string;
  name: string;
  role: PartyRole;
  email?: string | null;
  phone?: string | null;
  notes?: string | null;
};

type ForecastPoint = { date: string; balanceMinor: number; protectedMinor: number };
type ForecastEvent = { date: string; name: string; direction: Direction; amountMinor: number };
type Overview = {
  safeToSpendMinor: number;
  currentCashMinor: number;
  taxReserveMinor: number;
  minimumBufferMinor: number;
  protectedMinor: number;
  risk: "normal" | "caution" | "at_risk";
  provisional?: boolean;
  horizonStart: string;
  horizonEnd: string;
  firstBreachDate?: string | null;
  firstNegativeDate?: string | null;
  lowestBalanceMinor: number;
  lowestHeadroomMinor: number;
  limitingDate: string;
  points: ForecastPoint[];
  events: ForecastEvent[];
  recommendation: { type: string; title: string; detail: string; amountMinor: number | null };
};

type Workflows = { lastReview?: { completedAt: number; summary: string } | null };
const categories: Record<Direction, [string, string][]> = {
  inflow: [
    ["service_income", "Service income"], ["product_sales", "Product sales"], ["retainer_income", "Retainer income"],
    ["commission_income", "Commission income"], ["interest_income", "Interest income"], ["refund_received", "Refund received"],
    ["grant_income", "Grant income"], ["loan_proceeds", "Loan proceeds"], ["owner_contribution", "Owner contribution"],
    ["asset_sale", "Asset sale"], ["transfer_in", "Transfer in"], ["other_income", "Other income"],
  ],
  outflow: [
    ["contractors", "Contractors"], ["payroll_owner_pay", "Payroll / owner pay"], ["inventory", "Inventory / materials"],
    ["software", "Software"], ["subscriptions", "Subscriptions"], ["rent", "Rent"], ["utilities", "Utilities"],
    ["insurance", "Insurance"], ["professional_services", "Professional services"], ["marketing", "Marketing"],
    ["advertising", "Advertising"], ["travel", "Travel"], ["meals", "Meals"], ["office_supplies", "Office supplies"],
    ["equipment", "Equipment"], ["repairs_maintenance", "Repairs & maintenance"], ["shipping", "Shipping / postage"],
    ["vehicle", "Vehicle"], ["training", "Training / education"], ["licenses_permits", "Licenses / permits"],
    ["bank_fees", "Bank fees"], ["payment_processing_fees", "Payment processing fees"], ["tax", "Tax"],
    ["debt", "Debt interest"], ["loan_repayment", "Loan repayment"], ["owner_draw", "Owner draw"],
    ["refunds", "Customer refunds"], ["charitable_giving", "Charitable giving"], ["transfer_out", "Transfer out"], ["other", "Other"],
  ],
};

const today = () => new Date().toISOString().slice(0, 10);
const money = (amountMinor: number, currency: string) =>
  new Intl.NumberFormat(undefined, { style: "currency", currency }).format(amountMinor / 100);
const shortMoney = (amountMinor: number, currency: string) =>
  new Intl.NumberFormat(undefined, { style: "currency", currency, notation: "compact", maximumFractionDigits: 1 }).format(amountMinor / 100);
const daysBetween = (date: string, start: string) =>
  Math.round((new Date(`${date}T00:00:00Z`).getTime() - new Date(`${start}T00:00:00Z`).getTime()) / 86_400_000);
const validPositiveAmount = (value: string) => /^\d+(?:\.\d{1,2})?$/.test(value) && Number(value) > 0;

const previewOverview: Overview = {
  safeToSpendMinor: 428000,
  currentCashMinor: 1142000,
  taxReserveMinor: 210000,
  minimumBufferMinor: 200000,
  protectedMinor: 410000,
  risk: "normal",
  horizonStart: today(),
  horizonEnd: "90 days from today",
  lowestBalanceMinor: 594000,
  lowestHeadroomMinor: 184000,
  limitingDate: "in 40 days",
  points: [
    { date: today(), balanceMinor: 1142000, protectedMinor: 410000 },
    { date: new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10), balanceMinor: 930000, protectedMinor: 410000 },
    { date: new Date(Date.now() + 60 * 86_400_000).toISOString().slice(0, 10), balanceMinor: 594000, protectedMinor: 410000 },
    { date: new Date(Date.now() + 90 * 86_400_000).toISOString().slice(0, 10), balanceMinor: 780000, protectedMinor: 410000 },
  ],
  events: [
    { date: new Date(Date.now() + 4 * 86_400_000).toISOString().slice(0, 10), name: "Northstar retainer", direction: "inflow", amountMinor: 320000 },
    { date: new Date(Date.now() + 9 * 86_400_000).toISOString().slice(0, 10), name: "Contractor payment", direction: "outflow", amountMinor: 145000 },
  ],
  recommendation: { type: "Invoice follow-up", title: "Acme Studio is 8 days overdue.", detail: "INV-024", amountMinor: 240000 },
};

const previewEntries: CashEntry[] = [
  { id: "preview-income", direction: "inflow", name: "Acme Studio project", amountMinor: 240000, scheduledDate: today(), status: "overdue", included: true, partyName: "Acme Studio", invoiceReference: "INV-024", category: "service_income" },
  { id: "preview-expense", direction: "outflow", name: "Design software", amountMinor: 4900, actualAmountMinor: 4900, scheduledDate: today(), status: "paid", partyName: "Creative Cloud", category: "software" },
];

const previewParties: Party[] = [
  { id: "preview-customer", name: "Acme Studio", role: "customer", email: "accounts@acme.example" },
  { id: "preview-supplier", name: "Creative Cloud", role: "supplier", email: "billing@example.com" },
];

function chartPaths(overview: Overview) {
  const values = [...overview.points.map((point) => point.balanceMinor), overview.protectedMinor, 0];
  const minimum = Math.min(...values);
  const maximum = Math.max(...values);
  const padding = Math.max((maximum - minimum) * 0.12, 100);
  const chartMin = minimum - padding;
  const chartMax = maximum + padding;
  const range = chartMax - chartMin || 1;
  const x = (date: string) => (daysBetween(date, overview.horizonStart) / 90) * 900;
  const y = (value: number) => 250 - ((value - chartMin) / range) * 250;
  let line = `M0 ${y(overview.currentCashMinor).toFixed(1)}`;
  for (const point of overview.points.slice(1)) line += ` H${x(point.date).toFixed(1)} V${y(point.balanceMinor).toFixed(1)}`;
  line += " H900";
  let reserve = `M0 ${y(overview.points[0]?.protectedMinor ?? overview.protectedMinor).toFixed(1)}`;
  for (const point of overview.points.slice(1)) reserve += ` H${x(point.date).toFixed(1)} V${y(point.protectedMinor).toFixed(1)}`;
  const ticks = [chartMax, chartMax - range / 3, chartMax - (2 * range) / 3, chartMin];
  return { line, area: `${line} V250 H0 Z`, reserve: `${reserve} H900`, ticks };
}

const emptyTransaction = () => ({ direction: "inflow" as Direction, timing: "recorded" as Timing, name: "", amount: "", date: today(), partyId: "", invoiceReference: "", category: "service_income", status: "expected", recurring: false });
const emptyParty = () => ({ name: "", role: "customer" as PartyRole, email: "", phone: "", notes: "" });

export default function AppPage() {
  const bootstrap: FinvayoBootstrap = typeof window === "undefined" ? {} : window.__FINVAYO__ ?? {};
  const preview = Boolean(bootstrap.preview);
  const [currency, setCurrency] = useState("USD");
  const [entries, setEntries] = useState<CashEntry[]>(preview ? previewEntries : []);
  const [parties, setParties] = useState<Party[]>(preview ? previewParties : []);
  const [overview, setOverview] = useState<Overview | null>(preview ? previewOverview : null);
  const [workflows, setWorkflows] = useState<Workflows>({});
  const [transaction, setTransaction] = useState(emptyTransaction);
  const [party, setParty] = useState(emptyParty);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingPartyId, setEditingPartyId] = useState<string | null>(null);
  const [transactionMessage, setTransactionMessage] = useState(preview ? "Create a workspace to record transactions." : "");
  const [partyMessage, setPartyMessage] = useState(preview ? "Create a workspace to register parties." : "");
  const [balance, setBalance] = useState({ amount: "", date: today() });
  const [balanceMessage, setBalanceMessage] = useState("");
  const [scenario, setScenario] = useState({ amount: "", date: today() });
  const [scenarioResult, setScenarioResult] = useState<{ amountMinor: number; date: string } | null>(null);
  const [scenarioMessage, setScenarioMessage] = useState("Uses your current 90-day outlook and does not save anything.");
  const [reviewSteps, setReviewSteps] = useState<string[]>([]);
  const [reviewMessage, setReviewMessage] = useState("");
  const [followUp, setFollowUp] = useState({ entryId: previewEntries[0].id, tone: "friendly", message: "" });
  const [followUpStatus, setFollowUpStatus] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    const [financials, directory, loadedWorkflows] = await Promise.all([
      api<{ entries: CashEntry[]; overview: Overview | null; currency?: string }>("/api/financials"),
      api<{ parties: Party[] }>("/api/parties"),
      api<Workflows>("/api/workflows"),
    ]);
    setEntries(financials.entries);
    setOverview(financials.overview);
    setParties(directory.parties);
    setWorkflows(loadedWorkflows);
    setCurrency(financials.currency || "USD");
  }

  useEffect(() => {
    if (!preview) load().catch((error: unknown) => setTransactionMessage(error instanceof Error ? error.message : "Unable to load workspace data."));
  }, [preview]);

  const fail = (error: unknown, fallback: string) => error instanceof Error ? error.message : fallback;
  const resetTransaction = () => { setEditingId(null); setTransaction(emptyTransaction()); };
  const resetParty = () => { setEditingPartyId(null); setParty(emptyParty()); };
  const refresh = async () => { await load(); };
  const allowedParties = parties.filter((item) => item.role === (transaction.direction === "inflow" ? "customer" : "supplier") || item.role === "both");
  const overdue = entries.filter((entry) => entry.direction === "inflow" && entry.status === "overdue");
  const sortedEntries = [...entries].sort((a, b) => b.scheduledDate.localeCompare(a.scheduledDate));
  const chart = overview ? chartPaths(overview) : null;
  const upcoming = overview?.events.filter((entry) => daysBetween(entry.date, overview.horizonStart) <= 14).slice(0, 5) ?? [];
  const riskLabel = !overview ? "Setup needed" : overview.risk === "normal" ? "On track" : overview.risk === "caution" ? "Caution" : "At risk";
  const riskDetail = !overview ? "Confirm current cash" : overview.provisional ? "Balance confirmation needed" : `Based on data through ${overview.horizonEnd}`;
  const safeSummary = !overview ? "Confirm your current cash to calculate a real 90-day outlook." : overview.provisional
    ? "Your outlook is provisional because transactions were recorded after the last balance confirmation."
    : overview.risk === "normal" ? "Your protected cash stays intact for the next 90 days."
    : overview.risk === "caution" ? `Projected cash crosses your protected level on ${overview.firstBreachDate}.`
    : `Projected cash falls below zero by ${overview.firstNegativeDate}.`;

  async function submitTransaction(event: React.FormEvent) {
    event.preventDefault();
    if (!validPositiveAmount(transaction.amount)) return setTransactionMessage("Enter a valid positive amount with up to two decimal places.");
    const existing = entries.find((entry) => entry.id === editingId);
    const recorded = transaction.timing === "recorded";
    const amountMinor = Math.round(Number(transaction.amount) * 100);
    const payload = {
      direction: transaction.direction,
      name: transaction.name,
      amountMinor: existing?.status === "paid" ? existing.amountMinor : amountMinor,
      actualAmountMinor: recorded ? amountMinor : undefined,
      actualDate: recorded ? transaction.date : undefined,
      scheduledDate: existing?.status === "paid" ? existing.scheduledDate : transaction.date,
      status: recorded ? "paid" : transaction.status,
      partyId: transaction.partyId || (editingId ? null : undefined),
      invoiceReference: transaction.direction === "inflow" ? transaction.invoiceReference : undefined,
      category: transaction.category,
      recurrence: !recorded && transaction.recurring ? "monthly" : editingId ? null : undefined,
    };
    setBusy(true);
    try {
      await api(editingId ? `/api/cash-entries/${editingId}` : "/api/cash-entries", { method: editingId ? "PATCH" : "POST", body: JSON.stringify(payload) });
      const wasEditing = Boolean(editingId);
      resetTransaction();
      await refresh();
      setTransactionMessage(wasEditing ? "Transaction updated." : recorded ? transaction.direction === "inflow" ? "Payment recorded." : "Expense recorded." : transaction.direction === "inflow" ? "Expected income added to the forecast." : "Planned expense added to the forecast.");
    } catch (error) { setTransactionMessage(fail(error, "Unable to record transaction.")); } finally { setBusy(false); }
  }

  function editTransaction(entry: CashEntry) {
    setEditingId(entry.id);
    setTransaction({
      direction: entry.direction,
      timing: entry.status === "paid" ? "recorded" : "planned",
      name: entry.name,
      amount: (entry.amountMinor / 100).toFixed(2),
      date: entry.scheduledDate,
      partyId: entry.partyId || "",
      invoiceReference: entry.invoiceReference || "",
      category: entry.category || (entry.direction === "inflow" ? "service_income" : "other"),
      status: entry.status === "paid" ? "expected" : entry.storedStatus || entry.status,
      recurring: entry.recurrence === "monthly",
    });
    document.querySelector("#transaction-form")?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  async function patchEntry(id: string, payload: object, success = "") {
    try {
      await api(`/api/cash-entries/${id}`, { method: "PATCH", body: JSON.stringify(payload) });
      await refresh();
      if (success) setTransactionMessage(success);
    } catch (error) { setTransactionMessage(fail(error, "Unable to update transaction.")); }
  }

  async function markPaid(entry: CashEntry) {
    const amount = window.prompt("Actual amount", ((entry.actualAmountMinor || entry.amountMinor) / 100).toFixed(2));
    const actualDate = window.prompt("Actual date (YYYY-MM-DD)", today());
    if (amount === null || actualDate === null || !validPositiveAmount(amount)) return;
    await patchEntry(entry.id, { status: "paid", actualAmountMinor: Math.round(Number(amount) * 100), actualDate }, "Transaction marked paid.");
  }

  async function deleteEntry(entry: CashEntry) {
    if (!window.confirm("Delete this transaction?")) return;
    try { await api(`/api/cash-entries/${entry.id}`, { method: "DELETE" }); await refresh(); setTransactionMessage("Transaction deleted."); }
    catch (error) { setTransactionMessage(fail(error, "Unable to delete transaction.")); }
  }

  async function submitParty(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const result = await api<{ id: string }>(editingPartyId ? `/api/parties/${editingPartyId}` : "/api/parties", { method: editingPartyId ? "PATCH" : "POST", body: JSON.stringify(party) });
      const wasEditing = Boolean(editingPartyId);
      resetParty();
      await refresh();
      if (!wasEditing) setTransaction((current) => ({ ...current, partyId: result.id }));
      setPartyMessage(wasEditing ? "Party updated." : "Party registered and selected for the next transaction.");
    } catch (error) { setPartyMessage(fail(error, "Unable to register party.")); } finally { setBusy(false); }
  }

  async function deleteParty(item: Party) {
    if (!window.confirm("Delete this party? Existing transactions will keep its name.")) return;
    try { await api(`/api/parties/${item.id}`, { method: "DELETE" }); await refresh(); setPartyMessage("Party deleted. Historical transactions were preserved."); }
    catch (error) { setPartyMessage(fail(error, "Unable to delete party.")); }
  }

  return (
    <div className="app-page" data-preview={String(preview)}>
      <a className="skip-link" href="#app-main">Skip to overview</a>
      <aside className="app-sidebar">
        <a className="wordmark app-wordmark" href="/" aria-label="Finvayo home"><BrandMark /> Finvayo</a>
        <nav className="app-nav" aria-label="Application navigation">
          <a className="active" href="/app" aria-current="page"><span aria-hidden="true">⌂</span> Overview</a>
          <a href="#parties"><span aria-hidden="true">◎</span> Parties</a>
          <a href="/app/invoices"><span aria-hidden="true">▤</span> Invoices</a>
          <a href="#cash-plan"><span aria-hidden="true">↗</span> Cash plan</a>
          <a href="#scenario"><span aria-hidden="true">◇</span> Scenarios</a>
        </nav>
        <div className="sidebar-bottom">
          <a href="/app/settings"><span aria-hidden="true">⚙</span> Settings</a>
          {preview ? <a href="/login"><span aria-hidden="true">↪</span> Leave preview</a> : <form className="logout-form" action="/auth/logout" method="post"><button type="submit"><span aria-hidden="true">↪</span> Sign out</button></form>}
          <div className="user-chip"><span>FV</span><div><strong>{bootstrap.user?.workspaceName || "Demo workspace"}</strong><small>{bootstrap.user?.email || "Sample data"}</small></div></div>
        </div>
      </aside>
      <header className="mobile-app-header"><a className="wordmark" href="/"><BrandMark />Finvayo</a><a href="/login">Account</a></header>

      <main className="app-main" id="app-main">
        {preview ? <div className="preview-banner"><span>Product preview</span><p>This workspace uses sample data. Create your own workspace in a few seconds.</p><a href="/signup">Start free</a></div>
          : <div className="preview-banner account-banner"><span>{bootstrap.user?.trialDays ?? 0} days left in trial</span><p>Your workspace is ready. Add real cash data to replace this guided example.</p><a href="#balance-form">Start setup</a></div>}
        <header className="workspace-header"><div><p className="app-kicker">Your cash outlook</p><h1>Good to see you, {bootstrap.user?.displayName || "there"}.</h1></div><div className="review-state" data-risk={overview?.risk}><i /><span>{riskLabel}</span><strong>{riskDetail}</strong></div></header>

        <section className="decision-grid" aria-label="Current cash position">
          <article className="safe-card">
            <div className="card-heading"><h2>Safe to spend now</h2><button type="button" aria-label="About safe to spend" title="Your current cash minus reserves, buffer, and planned outgoings.">?</button></div>
            <p className="safe-amount">{overview ? money(overview.safeToSpendMinor, currency) : "—"}</p>
            <p className="safe-summary"><i />{safeSummary}</p>
            <div className="safe-breakdown"><div><span>Current cash</span><strong>{overview ? money(overview.currentCashMinor, currency) : "Not confirmed"}</strong></div><div><span>Tax reserved</span><strong>{overview ? money(overview.taxReserveMinor, currency) : "—"}</strong></div><div><span>Minimum buffer</span><strong>{overview ? money(overview.minimumBufferMinor, currency) : "—"}</strong></div></div>
            <form className="balance-form" id="balance-form" onSubmit={async (event) => {
              event.preventDefault();
              if (!/^-?\d+(?:\.\d{1,2})?$/.test(balance.amount)) return setBalanceMessage("Enter a valid balance with up to two decimal places.");
              setBusy(true);
              try { await api("/api/cash-snapshots", { method: "POST", body: JSON.stringify({ balanceMinor: Math.round(Number(balance.amount) * 100), effectiveDate: balance.date }) }); await refresh(); setBalanceMessage("Current cash confirmed and forecast updated."); }
              catch (error) { setBalanceMessage(fail(error, "Unable to confirm balance.")); } finally { setBusy(false); }
            }}>
              <label className="transaction-field"><span>Confirm current cash</span><input inputMode="decimal" required placeholder="0.00" value={balance.amount} onChange={(event) => setBalance({ ...balance, amount: event.target.value })} disabled={preview || busy} /></label>
              <label className="transaction-field"><span>As of</span><input type="date" required value={balance.date} onChange={(event) => setBalance({ ...balance, date: event.target.value })} disabled={preview || busy} /></label>
              <button className="button button-secondary" type="submit" disabled={preview || busy}>Confirm balance</button>
              <p className="transaction-message" role="status" aria-live="polite">{balanceMessage}</p>
            </form>
          </article>
          <article className="action-card"><div className="card-heading"><span>Recommended action</span><small>Today</small></div><p className="action-type">{overview?.recommendation.type || "First step"}</p><h2>{overview?.recommendation.title || "Confirm the cash currently available to your business."}</h2><div className="action-meta"><span>{overview?.recommendation.detail || "Required for forecast"}</span><strong>{overview?.recommendation.amountMinor == null ? "" : money(overview.recommendation.amountMinor, currency)}</strong></div><a href={overview?.recommendation.type === "Invoice follow-up" ? "#transactions" : overview ? "#cash-plan" : "#balance-form"}>Review transactions <span aria-hidden="true">→</span></a></article>
        </section>

        <section className="transactions-card" id="transactions">
          <div className="transactions-heading"><div><p className="app-kicker">Money movement</p><h2>Record a transaction</h2></div><p>Log money that has already entered or left the business. Your confirmed cash balance stays unchanged.</p></div>
          <div className="transactions-layout">
            <form className="transaction-form" id="transaction-form" onSubmit={submitTransaction}>
              <fieldset className="transaction-kind" disabled={preview || busy}><legend>Transaction type</legend>{(["inflow", "outflow"] as Direction[]).map((value) => <label key={value}><input type="radio" checked={transaction.direction === value} onChange={() => setTransaction({ ...transaction, direction: value, category: categories[value][0][0], partyId: "", status: value === "inflow" ? "expected" : "planned" })} /><span>{value === "inflow" ? "Payment received" : "Expense paid"}</span></label>)}</fieldset>
              <fieldset className="transaction-kind transaction-timing" disabled={preview || busy}><legend>Timing</legend>{(["recorded", "planned"] as Timing[]).map((value) => <label key={value}><input type="radio" checked={transaction.timing === value} onChange={() => setTransaction({ ...transaction, timing: value })} /><span>{value === "recorded" ? "Already happened" : "Expected / planned"}</span></label>)}</fieldset>
              <label className="transaction-field"><span>Description</span><input maxLength={120} autoComplete="off" required placeholder="September retainer…" value={transaction.name} onChange={(event) => setTransaction({ ...transaction, name: event.target.value })} disabled={preview || busy} /></label>
              <div className="transaction-fields"><label className="transaction-field"><span>Amount</span><input inputMode="decimal" required placeholder="0.00" value={transaction.amount} onChange={(event) => setTransaction({ ...transaction, amount: event.target.value })} disabled={preview || busy} /></label><label className="transaction-field"><span>Date</span><input type="date" required value={transaction.date} onChange={(event) => setTransaction({ ...transaction, date: event.target.value })} disabled={preview || busy} /></label></div>
              <label className="transaction-field"><span>{transaction.direction === "inflow" ? "Customer" : "Supplier"}</span><select value={transaction.partyId} onChange={(event) => setTransaction({ ...transaction, partyId: event.target.value })} disabled={preview || busy}><option value="">No registered {transaction.direction === "inflow" ? "customer" : "supplier"}</option>{allowedParties.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
              {transaction.direction === "inflow" && <label className="transaction-field"><span>Invoice reference</span><input maxLength={80} autoComplete="off" spellCheck={false} placeholder="INV-001…" value={transaction.invoiceReference} onChange={(event) => setTransaction({ ...transaction, invoiceReference: event.target.value })} disabled={preview || busy} /></label>}
              <label className="transaction-field"><span>Category</span><select required value={transaction.category} onChange={(event) => setTransaction({ ...transaction, category: event.target.value })} disabled={preview || busy}>{categories[transaction.direction].map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
              {transaction.timing === "planned" && <><label className="transaction-field"><span>Status</span><select value={transaction.status} onChange={(event) => setTransaction({ ...transaction, status: event.target.value })} disabled={preview || busy}>{(transaction.direction === "inflow" ? [["expected", "Expected"], ["invoiced", "Invoiced"], ["unlikely", "Unlikely"]] : [["planned", "Planned"]]).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className="terms-check"><input type="checkbox" checked={transaction.recurring} onChange={(event) => setTransaction({ ...transaction, recurring: event.target.checked })} disabled={preview || busy} /><span>Repeat monthly in the 90-day outlook</span></label></>}
              <button className="button button-primary" type="submit" disabled={preview || busy}>{editingId ? "Save transaction" : transaction.timing === "recorded" ? transaction.direction === "inflow" ? "Record payment" : "Record expense" : transaction.direction === "inflow" ? "Add expected income" : "Add planned expense"}</button>
              {editingId && <button className="button button-secondary" type="button" onClick={resetTransaction}>Cancel edit</button>}
              <p className="transaction-message" role="status" aria-live="polite">{transactionMessage}</p>
            </form>
            <div className="transaction-history"><div className="section-row"><div><p className="app-kicker">Cash entries</p><h2>Payments &amp; expenses</h2></div><span>{entries.length} {entries.length === 1 ? "entry" : "entries"}</span></div>
              <div>{sortedEntries.length === 0 ? <p className="transaction-empty">No payments or expenses added yet.</p> : sortedEntries.map((entry) => <div className={`transaction-row ${entry.direction}`} key={entry.id}><div><strong>{entry.name}</strong><small>{entry.scheduledDate} · {entry.status} · {transactionLabel(entry)}</small></div><b>{entry.direction === "inflow" ? "+" : "−"}{money(entry.actualAmountMinor || entry.amountMinor, currency)}</b><div className="transaction-actions">{entry.status !== "paid" && <><button type="button" disabled={preview} onClick={() => markPaid(entry)}>Mark paid</button><button type="button" disabled={preview} onClick={() => patchEntry(entry.id, { included: !entry.included })}>{entry.included ? "Exclude" : "Include"}</button></>}<button type="button" disabled={preview} onClick={() => editTransaction(entry)}>Edit</button><button className="transaction-delete" type="button" disabled={preview} aria-label={`Delete ${entry.name}`} onClick={() => deleteEntry(entry)}>×</button></div></div>)}</div>
            </div>
          </div>
        </section>

        <section className="parties-card" id="parties"><div className="transactions-heading"><div><p className="app-kicker">Directory</p><h2>Customers &amp; suppliers</h2></div><p>Register the people and businesses you transact with once, then attach them to payments and expenses.</p></div><div className="parties-layout">
          <form className="party-form" onSubmit={submitParty}><div className="transaction-fields"><label className="transaction-field"><span>Name</span><input maxLength={120} autoComplete="organization" required placeholder="Acme Studio…" value={party.name} onChange={(event) => setParty({ ...party, name: event.target.value })} disabled={preview || busy} /></label><label className="transaction-field"><span>Role</span><select value={party.role} onChange={(event) => setParty({ ...party, role: event.target.value as PartyRole })} disabled={preview || busy}><option value="customer">Customer</option><option value="supplier">Supplier</option><option value="both">Customer &amp; supplier</option></select></label></div>
            <div className="transaction-fields"><label className="transaction-field"><span>Email (optional)</span><input type="email" maxLength={254} autoComplete="email" spellCheck={false} placeholder="accounts@example.com…" value={party.email} onChange={(event) => setParty({ ...party, email: event.target.value })} disabled={preview || busy} /></label><label className="transaction-field"><span>Phone (optional)</span><input type="tel" maxLength={40} autoComplete="tel" placeholder="+1 555 0100…" value={party.phone} onChange={(event) => setParty({ ...party, phone: event.target.value })} disabled={preview || busy} /></label></div>
            <label className="transaction-field"><span>Notes (optional)</span><textarea maxLength={500} rows={3} autoComplete="off" placeholder="Payment terms or useful context…" value={party.notes} onChange={(event) => setParty({ ...party, notes: event.target.value })} disabled={preview || busy} /></label><button className="button button-primary" type="submit" disabled={preview || busy}>{editingPartyId ? "Save party" : "Register party"}</button>{editingPartyId && <button className="button button-secondary" type="button" onClick={resetParty}>Cancel edit</button>}<p className="transaction-message" role="status" aria-live="polite">{partyMessage}</p>
          </form>
          <div className="party-directory"><div className="section-row"><div><p className="app-kicker">Registered</p><h2>Party directory</h2></div><span>{parties.length} {parties.length === 1 ? "party" : "parties"}</span></div><div>{parties.length === 0 ? <p className="transaction-empty">No customers or suppliers registered yet.</p> : parties.map((item) => <div className="party-row" key={item.id}><div><strong>{item.name}</strong><small>{[item.email, item.phone].filter(Boolean).join(" · ") || "No contact details"}</small></div><span className="party-role">{item.role === "both" ? "Customer & supplier" : item.role[0].toUpperCase() + item.role.slice(1)}</span><div className="transaction-actions"><button type="button" disabled={preview} onClick={() => { setEditingPartyId(item.id); setParty({ name: item.name, role: item.role, email: item.email || "", phone: item.phone || "", notes: item.notes || "" }); }}>Edit</button><button className="transaction-delete" type="button" disabled={preview} aria-label={`Delete ${item.name}`} onClick={() => deleteParty(item)}>×</button></div></div>)}</div></div>
        </div></section>

        <section className="outlook-card" id="cash-plan"><div className="outlook-heading"><div><p className="app-kicker">Cash outlook</p><h2>The next 90 days</h2></div><div className="legend"><span><i className="solid" />Projected cash</span><span><i className="dashed" />Protected level</span></div></div>
          {overview && chart ? <><div className="app-chart" role="img" aria-label={`Projected cash reaches a low of ${money(overview.lowestBalanceMinor, currency)} by ${overview.limitingDate}.`}><div className="axis">{chart.ticks.map((tick, index) => <span key={index}>{shortMoney(tick, currency)}</span>)}</div><div className="plot"><svg viewBox="0 0 900 250" preserveAspectRatio="none" aria-hidden="true"><path className="app-area" d={chart.area} /><path className="app-line" d={chart.line} /><path className="reserve-line" d={chart.reserve} /></svg><div className="plot-dates"><span>Today</span><span>30 days</span><span>60 days</span><span>90 days</span></div></div></div><p className="chart-summary"><span>01</span>Your lowest projected balance is <strong>{money(overview.lowestBalanceMinor, currency)} {overview.limitingDate.startsWith("in ") ? overview.limitingDate : `on ${overview.limitingDate}`}</strong>, {money(Math.abs(overview.lowestHeadroomMinor), currency)} {overview.lowestHeadroomMinor >= 0 ? "above" : "below"} your protected level.</p></> : <p className="chart-summary"><span>01</span>Add a confirmed balance to start your 90-day projection.</p>}
        </section>

        <section className="lower-grid"><article className="ledger-card"><div className="section-row"><div><p className="app-kicker">Coming up</p><h2>Next 14 days</h2></div><a href="#transactions">Manage entries</a></div><div>{!overview ? <p className="transaction-empty">No forecast is available until current cash is confirmed.</p> : upcoming.length === 0 ? <p className="transaction-empty">No projected payments or expenses in the next 14 days.</p> : upcoming.map((entry, index) => { const days = daysBetween(entry.date, overview.horizonStart); return <div className="ledger-row" key={`${entry.date}-${index}`}><time dateTime={entry.date}><strong>{days === 0 ? "Now" : `+${days}`}</strong><span>{days === 0 ? "" : "days"}</span></time><div><strong>{entry.name}</strong><span>{entry.direction === "inflow" ? "Projected income" : "Planned expense"}</span></div><b className={entry.direction === "inflow" ? "money-in" : ""}>{entry.direction === "inflow" ? "+" : "−"}{money(entry.amountMinor, currency)}</b></div>; })}</div></article>
          <article className="scenario-card" id="scenario"><p className="app-kicker">Before you commit</p><h2>Check a purchase.</h2><p>See how a new expense changes your protected cash before adding it to the plan.</p><form onSubmit={async (event) => { event.preventDefault(); const amountMinor = validPositiveAmount(scenario.amount) ? Math.round(Number(scenario.amount) * 100) : 0; try { const result = await api<{ amountMinor: number; date: string; risk: string; lowestBalanceMinor: number; safeToSpendChangeMinor: number }>("/api/scenarios", { method: "POST", body: JSON.stringify({ amountMinor, date: scenario.date }) }); setScenarioResult(result); const state = result.risk === "at_risk" ? "at risk" : result.risk === "caution" ? "caution" : "within your protected plan"; setScenarioMessage(`Lowest projected cash: ${money(result.lowestBalanceMinor, currency)}. Safe-to-spend changes by ${money(result.safeToSpendChangeMinor, currency)}: ${state}.`); } catch (error) { setScenarioResult(null); setScenarioMessage(fail(error, "Unable to run scenario.")); } }}><div className="scenario-fields"><label className="transaction-field"><span>Amount</span><input inputMode="decimal" required placeholder="0.00" value={scenario.amount} onChange={(event) => setScenario({ ...scenario, amount: event.target.value })} disabled={preview} /></label><label className="transaction-field"><span>Payment date</span><input type="date" required value={scenario.date} onChange={(event) => setScenario({ ...scenario, date: event.target.value })} disabled={preview} /></label></div><button className="button button-primary" type="submit" disabled={preview}>Run scenario</button>{scenarioResult && <button className="button button-secondary" type="button" onClick={() => { setEditingId(null); setTransaction({ ...emptyTransaction(), direction: "outflow", timing: "planned", name: "Scenario purchase", amount: (scenarioResult.amountMinor / 100).toFixed(2), date: scenarioResult.date, category: "equipment", status: "planned" }); setTransactionMessage("Scenario copied into the transaction form. Review and add it to your plan."); document.querySelector("#transaction-form")?.scrollIntoView({ behavior: "smooth", block: "center" }); }}>Add to plan</button>}</form><small role="status" aria-live="polite">{scenarioMessage}</small></article>
        </section>

        <section className="workflow-grid" id="weekly-review"><form className="settings-card review-form" onSubmit={async (event) => { event.preventDefault(); try { await api("/api/weekly-reviews", { method: "POST", body: JSON.stringify({ completed: reviewSteps }) }); setReviewSteps([]); await refresh(); setReviewMessage("Weekly review completed."); } catch (error) { setReviewMessage(fail(error, "Unable to complete weekly review.")); } }}><p className="app-kicker">Five-minute routine</p><h2>Weekly review</h2><p className="settings-note">{workflows.lastReview ? `Last completed ${new Date(workflows.lastReview.completedAt * 1000).toLocaleDateString(undefined, { dateStyle: "medium" })}. ${workflows.lastReview.summary}` : "No review completed yet."}</p>{[["cash", "Confirm current cash balance"], ["income", "Mark received payments"], ["expenses", "Mark paid obligations"], ["overdue", "Review overdue income"], ["outlook", "Review the next 30 days"]].map(([value, label]) => <label className="terms-check" key={value}><input type="checkbox" checked={reviewSteps.includes(value)} onChange={(event) => setReviewSteps(event.target.checked ? [...reviewSteps, value] : reviewSteps.filter((step) => step !== value))} disabled={preview} /><span>{label}</span></label>)}<button className="button button-primary" type="submit" disabled={preview}>Complete weekly review</button><p className="transaction-message" role="status" aria-live="polite">{reviewMessage}</p></form>
          <section className="settings-card follow-up-card" id="follow-up"><p className="app-kicker">Get paid sooner</p><h2>Invoice follow-up</h2><label className="transaction-field"><span>Overdue payment</span><select value={followUp.entryId} onChange={(event) => setFollowUp({ ...followUp, entryId: event.target.value })} disabled={preview}><option value="">{overdue.length ? "Choose an overdue payment" : "No overdue payments"}</option>{overdue.map((entry) => <option key={entry.id} value={entry.id}>{entry.partyName || entry.clientName || entry.name} · {money(entry.amountMinor, currency)}</option>)}</select></label><label className="transaction-field"><span>Tone</span><select value={followUp.tone} onChange={(event) => setFollowUp({ ...followUp, tone: event.target.value })} disabled={preview}><option value="friendly">Friendly reminder</option><option value="direct">Direct follow-up</option><option value="final">Final notice</option></select></label><button className="button button-secondary" type="button" disabled={preview || !followUp.entryId} onClick={async () => { try { const result = await api<{ message: string }>("/api/follow-ups/preview", { method: "POST", body: JSON.stringify({ entryId: followUp.entryId, tone: followUp.tone }) }); setFollowUp({ ...followUp, message: result.message }); setFollowUpStatus("Message ready to review and edit."); } catch (error) { setFollowUpStatus(fail(error, "Unable to generate message.")); } }}>Generate message</button><label className="transaction-field"><span>Message</span><textarea maxLength={2000} rows={6} value={followUp.message} onChange={(event) => setFollowUp({ ...followUp, message: event.target.value })} disabled={preview} /></label><div className="billing-actions"><button className="button button-secondary" type="button" disabled={preview || !followUp.message} onClick={async () => { await navigator.clipboard.writeText(followUp.message); setFollowUpStatus("Message copied."); }}>Copy message</button><button className="button button-primary" type="button" disabled={preview || !followUp.entryId || !followUp.message} onClick={async () => { try { await api("/api/follow-ups", { method: "POST", body: JSON.stringify({ entryId: followUp.entryId, tone: followUp.tone, message: followUp.message }) }); setFollowUpStatus("Follow-up marked as sent."); } catch (error) { setFollowUpStatus(fail(error, "Unable to mark follow-up as sent.")); } }}>Mark sent</button></div><p className="transaction-message" role="status" aria-live="polite">{followUpStatus}</p></section>
        </section>
      </main>
      <nav className="mobile-bottom-nav" aria-label="Mobile application navigation"><a className="active" href="/app" aria-current="page"><span aria-hidden="true">⌂</span>Overview</a><a href="#parties"><span aria-hidden="true">◎</span>Parties</a><a href="/app/invoices"><span aria-hidden="true">▤</span>Invoices</a><a href="#cash-plan"><span aria-hidden="true">↗</span>Cash plan</a><a href="#scenario"><span aria-hidden="true">◇</span>Scenarios</a></nav>
    </div>
  );
}

function BrandMark() {
  return <svg aria-hidden="true" viewBox="0 0 32 32"><path d="M5 24V8h22M8 20l5-5 4 3 8-9" /></svg>;
}

function transactionLabel(entry: CashEntry) {
  const category = categories[entry.direction].find(([value]) => value === entry.category)?.[1] || entry.category?.replaceAll("_", " ");
  return [entry.partyName || entry.clientName, category, entry.invoiceReference].filter(Boolean).join(" · ") || (entry.direction === "inflow" ? "Payment received" : "Expense paid");
}
