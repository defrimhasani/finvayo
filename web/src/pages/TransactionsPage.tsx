import { FormEvent, useEffect, useState } from "react";

import { api } from "../api";
import {
  categories,
  type CashEntry,
  type Direction,
  emptyTransaction,
  fail,
  type Financials,
  type Party,
  PageHeader,
  type Timing,
  transactionLabel,
  validIsoDate,
  validPositiveAmount,
} from "../appData";
import { AppShell } from "../components/AppShell";
import { money } from "../utils";

type SortOrder = "date-desc" | "date-asc" | "amount-desc" | "amount-asc" | "name-asc";

function initialTransaction() {
  const value = emptyTransaction();
  const params = new URLSearchParams(window.location.search);
  const amount = params.get("amount");
  const date = params.get("date");
  const name = params.get("name");
  const category = params.get("category");
  if (amount && date && validPositiveAmount(amount) && validIsoDate(date)) {
    value.direction = "outflow";
    value.timing = "planned";
    value.amount = amount;
    value.date = date;
    value.status = "planned";
    if (name && name.length <= 120) value.name = name;
    value.category = category && categories.outflow.some(([key]) => key === category) ? category : "equipment";
  }
  return value;
}

function effectiveAmount(entry: CashEntry) {
  return entry.status === "paid" && entry.actualAmountMinor != null ? entry.actualAmountMinor : entry.amountMinor;
}

function categoryName(entry: CashEntry) {
  return categories[entry.direction].find(([value]) => value === entry.category)?.[1] || entry.category?.replaceAll("_", " ") || "Uncategorized";
}

export default function TransactionsPage() {
  const [entries, setEntries] = useState<CashEntry[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [currency, setCurrency] = useState("USD");
  const [transaction, setTransaction] = useState(initialTransaction);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [filters, setFilters] = useState({ search: "", direction: "all", status: "all", category: "all" });
  const [sortOrder, setSortOrder] = useState<SortOrder>("date-desc");

  async function load() {
    const [financials, directory] = await Promise.all([
      api<Financials>("/api/financials"),
      api<{ parties: Party[] }>("/api/parties"),
    ]);
    setEntries(financials.entries);
    setCurrency(financials.currency || "USD");
    setParties(directory.parties);
  }

  useEffect(() => {
    load().catch((error) => setMessage(fail(error, "Unable to load transactions.")));
  }, []);

  function reset() {
    setEditingId(null);
    setTransaction(emptyTransaction());
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!validPositiveAmount(transaction.amount)) {
      setMessage("Enter a valid positive amount with up to two decimal places.");
      return;
    }
    const existing = entries.find((entry) => entry.id === editingId);
    const recorded = transaction.timing === "recorded";
    const amountMinor = Math.round(Number(transaction.amount) * 100);
    setBusy(true);
    try {
      await api(editingId ? `/api/cash-entries/${editingId}` : "/api/cash-entries", {
        method: editingId ? "PATCH" : "POST",
        body: JSON.stringify({
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
        }),
      });
      const editing = Boolean(editingId);
      reset();
      await load();
      setMessage(editing ? "Transaction updated." : "Transaction added.");
    } catch (error) {
      setMessage(fail(error, "Unable to record transaction."));
    } finally {
      setBusy(false);
    }
  }

  function edit(entry: CashEntry) {
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
      await load();
      if (success) setMessage(success);
    } catch (error) {
      setMessage(fail(error, "Unable to update transaction."));
    }
  }

  async function markPaid(entry: CashEntry) {
    const amount = window.prompt("Actual amount", (effectiveAmount(entry) / 100).toFixed(2));
    const actualDate = window.prompt("Actual date (YYYY-MM-DD)", new Date().toISOString().slice(0, 10));
    if (amount === null || actualDate === null || !validPositiveAmount(amount) || !validIsoDate(actualDate)) return;
    await patchEntry(entry.id, { status: "paid", actualAmountMinor: Math.round(Number(amount) * 100), actualDate }, "Transaction marked paid.");
  }

  async function remove(entry: CashEntry) {
    if (!window.confirm("Delete this transaction?")) return;
    try {
      await api(`/api/cash-entries/${entry.id}`, { method: "DELETE" });
      await load();
      setMessage("Transaction deleted.");
    } catch (error) {
      setMessage(fail(error, "Unable to delete transaction."));
    }
  }

  const allowedParties = parties.filter((item) => item.role === (transaction.direction === "inflow" ? "customer" : "supplier") || item.role === "both");
  const availableCategories = [...new Map(entries.map((entry) => [entry.category || "uncategorized", categoryName(entry)])).entries()].sort((first, second) => first[1].localeCompare(second[1]));
  const availableStatuses = [...new Set(entries.map((entry) => entry.status))].sort();
  const query = filters.search.trim().toLocaleLowerCase();
  const visibleEntries = entries.filter((entry) => {
    const searchable = [entry.name, entry.partyName, entry.clientName, entry.invoiceReference, categoryName(entry), entry.status].filter(Boolean).join(" ").toLocaleLowerCase();
    return (!query || searchable.includes(query))
      && (filters.direction === "all" || entry.direction === filters.direction)
      && (filters.status === "all" || entry.status === filters.status)
      && (filters.category === "all" || (entry.category || "uncategorized") === filters.category);
  }).sort((first, second) => {
    if (sortOrder === "date-asc") return first.scheduledDate.localeCompare(second.scheduledDate);
    if (sortOrder === "amount-desc") return effectiveAmount(second) - effectiveAmount(first);
    if (sortOrder === "amount-asc") return effectiveAmount(first) - effectiveAmount(second);
    if (sortOrder === "name-asc") return first.name.localeCompare(second.name, undefined, { sensitivity: "base" });
    return second.scheduledDate.localeCompare(first.scheduledDate);
  });
  const filtersActive = filters.search !== "" || filters.direction !== "all" || filters.status !== "all" || filters.category !== "all";

  return <AppShell activePage="transactions"><main className="app-main" id="app-main">
    <PageHeader kicker="Money movement" title="Transactions" />
    <section className="transactions-card dedicated-card">
      <div className="transactions-heading"><div><p className="app-kicker">Cash entries</p><h2>Record a transaction</h2></div><p>Log completed payments and expenses, or add expected movements to your cash plan.</p></div>
      <div className="transactions-layout">
        <form className="transaction-form" id="transaction-form" onSubmit={submit}>
          <fieldset className="transaction-kind" disabled={busy}><legend>Transaction type</legend>{(["inflow", "outflow"] as Direction[]).map((value) => <label key={value}><input type="radio" checked={transaction.direction === value} onChange={() => setTransaction({ ...transaction, direction: value, category: categories[value][0][0], partyId: "", status: value === "inflow" ? "expected" : "planned" })} /><span>{value === "inflow" ? "Payment received" : "Expense paid"}</span></label>)}</fieldset>
          <fieldset className="transaction-kind" disabled={busy}><legend>Timing</legend>{(["recorded", "planned"] as Timing[]).map((value) => <label key={value}><input type="radio" checked={transaction.timing === value} onChange={() => setTransaction({ ...transaction, timing: value })} /><span>{value === "recorded" ? "Already happened" : "Expected / planned"}</span></label>)}</fieldset>
          <label className="transaction-field"><span>Description</span><input maxLength={120} required value={transaction.name} onChange={(event) => setTransaction({ ...transaction, name: event.target.value })} disabled={busy} /></label>
          <div className="transaction-fields"><label className="transaction-field"><span>Amount</span><input inputMode="decimal" required value={transaction.amount} onChange={(event) => setTransaction({ ...transaction, amount: event.target.value })} disabled={busy} /></label><label className="transaction-field"><span>Date</span><input type="date" required value={transaction.date} onChange={(event) => setTransaction({ ...transaction, date: event.target.value })} disabled={busy} /></label></div>
          <label className="transaction-field"><span>{transaction.direction === "inflow" ? "Customer" : "Supplier"}</span><select value={transaction.partyId} onChange={(event) => setTransaction({ ...transaction, partyId: event.target.value })} disabled={busy}><option value="">No registered {transaction.direction === "inflow" ? "customer" : "supplier"}</option>{allowedParties.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          {transaction.direction === "inflow" && <label className="transaction-field"><span>Invoice reference</span><input maxLength={80} value={transaction.invoiceReference} onChange={(event) => setTransaction({ ...transaction, invoiceReference: event.target.value })} disabled={busy} /></label>}
          <label className="transaction-field"><span>Category</span><select value={transaction.category} onChange={(event) => setTransaction({ ...transaction, category: event.target.value })} disabled={busy}>{categories[transaction.direction].map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          {transaction.timing === "planned" && <><label className="transaction-field"><span>Status</span><select value={transaction.status} onChange={(event) => setTransaction({ ...transaction, status: event.target.value })} disabled={busy}>{(transaction.direction === "inflow" ? [["expected", "Expected"], ["invoiced", "Invoiced"], ["unlikely", "Unlikely"]] : [["planned", "Planned"]]).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className="terms-check"><input type="checkbox" checked={transaction.recurring} onChange={(event) => setTransaction({ ...transaction, recurring: event.target.checked })} disabled={busy} /><span>Repeat monthly</span></label></>}
          <button className="button button-primary" type="submit" disabled={busy}>{editingId ? "Save transaction" : "Add transaction"}</button>
          {editingId && <button className="button button-secondary" type="button" onClick={reset}>Cancel edit</button>}
          <p className="transaction-message" role="status" aria-live="polite">{message}</p>
        </form>

        <div className="transaction-history">
          <div className="section-row"><div><p className="app-kicker">Activity</p><h2>Payments &amp; expenses</h2></div><span>{visibleEntries.length} of {entries.length} entries</span></div>
          <div className="transaction-controls" aria-label="Filter and sort transactions">
            <label className="transaction-field transaction-search"><span>Search</span><input type="search" value={filters.search} onChange={(event) => setFilters({ ...filters, search: event.target.value })} placeholder="Name, party, invoice…" /></label>
            <label className="transaction-field"><span>Direction</span><select value={filters.direction} onChange={(event) => setFilters({ ...filters, direction: event.target.value })}><option value="all">All directions</option><option value="inflow">Money in</option><option value="outflow">Money out</option></select></label>
            <label className="transaction-field"><span>Status</span><select value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })}><option value="all">All statuses</option>{availableStatuses.map((status) => <option key={status} value={status}>{status.replaceAll("_", " ")}</option>)}</select></label>
            <label className="transaction-field"><span>Category</span><select value={filters.category} onChange={(event) => setFilters({ ...filters, category: event.target.value })}><option value="all">All categories</option>{availableCategories.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label className="transaction-field"><span>Sort by</span><select value={sortOrder} onChange={(event) => setSortOrder(event.target.value as SortOrder)}><option value="date-desc">Newest date</option><option value="date-asc">Oldest date</option><option value="amount-desc">Highest amount</option><option value="amount-asc">Lowest amount</option><option value="name-asc">Name A-Z</option></select></label>
            <button className="button button-secondary transaction-clear" type="button" disabled={!filtersActive} onClick={() => setFilters({ search: "", direction: "all", status: "all", category: "all" })}>Clear filters</button>
          </div>
          <div aria-live="polite">{visibleEntries.length === 0 ? <p className="transaction-empty">{entries.length ? "No transactions match these filters." : "No transactions yet."}</p> : visibleEntries.map((entry) => <div className={`transaction-row ${entry.direction}`} key={entry.id}><div><strong>{entry.name}</strong><small>{entry.scheduledDate} · {entry.status} · {transactionLabel(entry)}</small></div><b>{entry.direction === "inflow" ? "+" : "−"}{money(effectiveAmount(entry), currency)}</b><div className="transaction-actions">{entry.status !== "paid" && <><button type="button" onClick={() => markPaid(entry)}>Mark paid</button><button type="button" onClick={() => patchEntry(entry.id, { included: !entry.included })}>{entry.included ? "Exclude" : "Include"}</button></>}<button type="button" onClick={() => edit(entry)}>Edit</button><button className="transaction-delete" type="button" aria-label={`Delete ${entry.name}`} onClick={() => remove(entry)}>×</button></div></div>)}</div>
        </div>
      </div>
    </section>
  </main></AppShell>;
}
