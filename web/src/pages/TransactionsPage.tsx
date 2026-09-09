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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "../components/ui/alert-dialog";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Checkbox } from "../components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { RadioGroup, RadioGroupItem } from "../components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { money } from "../utils";

type SortOrder =
  "date-desc" | "date-asc" | "amount-desc" | "amount-asc" | "name-asc";

const SORT_LABELS: Record<SortOrder, string> = {
  "date-desc": "Newest date",
  "date-asc": "Oldest date",
  "amount-desc": "Highest amount",
  "amount-asc": "Lowest amount",
  "name-asc": "Name A-Z",
};

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
    value.category =
      category && categories.outflow.some(([key]) => key === category)
        ? category
        : "equipment";
  }
  return value;
}

function hasScenarioPrefill() {
  const params = new URLSearchParams(window.location.search);
  const amount = params.get("amount");
  const date = params.get("date");
  return Boolean(
    amount && date && validPositiveAmount(amount) && validIsoDate(date),
  );
}

function effectiveAmount(entry: CashEntry) {
  return entry.status === "paid" && entry.actualAmountMinor != null
    ? entry.actualAmountMinor
    : entry.amountMinor;
}

function categoryName(entry: CashEntry) {
  return (
    categories[entry.direction].find(
      ([value]) => value === entry.category,
    )?.[1] ||
    entry.category?.replaceAll("_", " ") ||
    "Uncategorized"
  );
}

export default function TransactionsPage() {
  const [entries, setEntries] = useState<CashEntry[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [currency, setCurrency] = useState("USD");
  const [transaction, setTransaction] = useState(initialTransaction);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [transactionDialogOpen, setTransactionDialogOpen] =
    useState(hasScenarioPrefill);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [filters, setFilters] = useState({
    search: "",
    direction: "all",
    status: "all",
    category: "all",
  });
  const [sortOrder, setSortOrder] = useState<SortOrder>("date-desc");
  const [markPaidEntry, setMarkPaidEntry] = useState<CashEntry | null>(null);
  const [markPaidAmount, setMarkPaidAmount] = useState("");
  const [markPaidDate, setMarkPaidDate] = useState("");
  const [markPaidError, setMarkPaidError] = useState("");
  const [markPaidBusy, setMarkPaidBusy] = useState(false);

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
    load().catch((error) =>
      setMessage(fail(error, "Unable to load transactions.")),
    );
  }, []);

  function reset() {
    setEditingId(null);
    setTransaction(emptyTransaction());
  }

  function openCreate() {
    reset();
    setMessage("");
    setTransactionDialogOpen(true);
  }

  function closeTransactionDialog() {
    if (busy) return;
    setTransactionDialogOpen(false);
    reset();
    setMessage("");
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!validPositiveAmount(transaction.amount)) {
      setMessage(
        "Enter a valid positive amount with up to two decimal places.",
      );
      return;
    }
    const existing = entries.find((entry) => entry.id === editingId);
    const recorded = transaction.timing === "recorded";
    const amountMinor = Math.round(Number(transaction.amount) * 100);
    setBusy(true);
    try {
      await api(
        editingId ? `/api/cash-entries/${editingId}` : "/api/cash-entries",
        {
          method: editingId ? "PATCH" : "POST",
          body: JSON.stringify({
            direction: transaction.direction,
            name: transaction.name,
            amountMinor:
              existing?.status === "paid" ? existing.amountMinor : amountMinor,
            actualAmountMinor: recorded ? amountMinor : undefined,
            actualDate: recorded ? transaction.date : undefined,
            scheduledDate:
              existing?.status === "paid"
                ? existing.scheduledDate
                : transaction.date,
            status: recorded ? "paid" : transaction.status,
            partyId: transaction.partyId || (editingId ? null : undefined),
            invoiceReference:
              transaction.direction === "inflow"
                ? transaction.invoiceReference
                : undefined,
            category: transaction.category,
            recurrence:
              !recorded && transaction.recurring
                ? "monthly"
                : editingId
                  ? null
                  : undefined,
          }),
        },
      );
      const editing = Boolean(editingId);
      reset();
      setTransactionDialogOpen(false);
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
      category:
        entry.category ||
        (entry.direction === "inflow" ? "service_income" : "other"),
      status:
        entry.status === "paid"
          ? "expected"
          : entry.storedStatus || entry.status,
      recurring: entry.recurrence === "monthly",
    });
    setMessage("");
    setTransactionDialogOpen(true);
  }

  async function patchEntry(id: string, payload: object, success = "") {
    try {
      await api(`/api/cash-entries/${id}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      await load();
      if (success) setMessage(success);
      return true;
    } catch (error) {
      setMessage(fail(error, "Unable to update transaction."));
      return false;
    }
  }

  function openMarkPaid(entry: CashEntry) {
    setMarkPaidEntry(entry);
    setMarkPaidAmount((effectiveAmount(entry) / 100).toFixed(2));
    setMarkPaidDate(new Date().toISOString().slice(0, 10));
    setMarkPaidError("");
  }

  async function markPaid(event: FormEvent) {
    event.preventDefault();
    if (!markPaidEntry) return;
    if (!validPositiveAmount(markPaidAmount)) {
      setMarkPaidError(
        "Enter a valid positive amount with up to two decimal places.",
      );
      return;
    }
    if (!validIsoDate(markPaidDate)) {
      setMarkPaidError("Enter a valid date.");
      return;
    }
    setMarkPaidBusy(true);
    const updated = await patchEntry(
      markPaidEntry.id,
      {
        status: "paid",
        actualAmountMinor: Math.round(Number(markPaidAmount) * 100),
        actualDate: markPaidDate,
      },
      "Transaction marked paid.",
    );
    setMarkPaidBusy(false);
    if (updated) setMarkPaidEntry(null);
  }

  async function remove(entry: CashEntry) {
    try {
      await api(`/api/cash-entries/${entry.id}`, { method: "DELETE" });
      await load();
      setMessage("Transaction deleted.");
    } catch (error) {
      setMessage(fail(error, "Unable to delete transaction."));
    }
  }

  const allowedParties = parties.filter(
    (item) =>
      item.role ===
        (transaction.direction === "inflow" ? "customer" : "supplier") ||
      item.role === "both",
  );
  const availableCategories = [
    ...new Map(
      entries.map((entry) => [
        entry.category || "uncategorized",
        categoryName(entry),
      ]),
    ).entries(),
  ].sort((first, second) => first[1].localeCompare(second[1]));
  const availableStatuses = [
    ...new Set(entries.map((entry) => entry.status)),
  ].sort();
  const query = filters.search.trim().toLocaleLowerCase();
  const visibleEntries = entries
    .filter((entry) => {
      const searchable = [
        entry.name,
        entry.partyName,
        entry.clientName,
        entry.invoiceReference,
        categoryName(entry),
        entry.status,
      ]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase();
      return (
        (!query || searchable.includes(query)) &&
        (filters.direction === "all" ||
          entry.direction === filters.direction) &&
        (filters.status === "all" || entry.status === filters.status) &&
        (filters.category === "all" ||
          (entry.category || "uncategorized") === filters.category)
      );
    })
    .sort((first, second) => {
      if (sortOrder === "date-asc")
        return first.scheduledDate.localeCompare(second.scheduledDate);
      if (sortOrder === "amount-desc")
        return effectiveAmount(second) - effectiveAmount(first);
      if (sortOrder === "amount-asc")
        return effectiveAmount(first) - effectiveAmount(second);
      if (sortOrder === "name-asc")
        return first.name.localeCompare(second.name, undefined, {
          sensitivity: "base",
        });
      return second.scheduledDate.localeCompare(first.scheduledDate);
    });
  const filtersActive =
    filters.search !== "" ||
    filters.direction !== "all" ||
    filters.status !== "all" ||
    filters.category !== "all";

  const fieldClass =
    "grid min-w-0 gap-2 [&>label]:font-mono [&>label]:text-[0.7rem] [&>label]:uppercase [&>label]:tracking-[0.06em] [&>label]:text-muted-foreground [&>span]:font-mono [&>span]:text-[0.7rem] [&>span]:uppercase [&>span]:tracking-[0.06em] [&>span]:text-muted-foreground";
  const kickerClass =
    "mb-2 font-mono text-[0.7rem] uppercase tracking-[0.08em] text-[#3f665e]";

  return (
    <AppShell activePage="transactions">
      <main
        className="min-h-screen w-full px-4 pb-28 pt-6 min-[761px]:px-6 min-[761px]:pb-20 min-[761px]:pt-8 min-[1200px]:px-8"
        id="app-main"
      >
        <PageHeader kicker="Money movement" title="Transactions">
          <Button type="button" onClick={openCreate}>
            New transaction
          </Button>
        </PageHeader>
        <Card className="mt-5 p-[clamp(1.5rem,3vw,2.5rem)]">
          <div className="min-w-0">
              <div className="flex items-end justify-between gap-4 border-b border-border pb-4 max-[520px]:items-start max-[520px]:flex-col">
                <div>
                  <p className={kickerClass}>Activity</p>
                  <h2 className="text-[1.4rem] font-semibold tracking-[-0.045em]">
                    Payments &amp; expenses
                  </h2>
                </div>
                <span className="shrink-0 font-mono text-xs uppercase text-muted-foreground">
                  {visibleEntries.length} of {entries.length} entries
                </span>
              </div>
              <div
                className="my-5 grid grid-cols-2 gap-3 border border-border bg-white/55 p-4 max-[520px]:grid-cols-1"
                aria-label="Filter and sort transactions"
              >
                <Label
                  className={`${fieldClass} col-span-full max-[520px]:col-span-1`}
                >
                  <span>Search</span>
                  <Input
                    type="search"
                    value={filters.search}
                    onChange={(event) =>
                      setFilters({ ...filters, search: event.target.value })
                    }
                    placeholder="Name, party, invoice…"
                  />
                </Label>
                <div className={fieldClass}>
                  <Label htmlFor="transaction-filter-direction">
                    Direction
                  </Label>
                  <Select
                    value={filters.direction}
                    onValueChange={(value) =>
                      setFilters({ ...filters, direction: value ?? "all" })
                    }
                    >
                      <SelectTrigger id="transaction-filter-direction">
                       <SelectValue>
                         {() =>
                           filters.direction === "inflow"
                             ? "Money in"
                             : filters.direction === "outflow"
                               ? "Money out"
                               : "All directions"
                         }
                       </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All directions</SelectItem>
                      <SelectItem value="inflow">Money in</SelectItem>
                      <SelectItem value="outflow">Money out</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className={fieldClass}>
                  <Label htmlFor="transaction-filter-status">Status</Label>
                  <Select
                    value={filters.status}
                    onValueChange={(value) =>
                      setFilters({ ...filters, status: value ?? "all" })
                    }
                    >
                      <SelectTrigger id="transaction-filter-status">
                       <SelectValue>
                         {() =>
                           filters.status === "all"
                             ? "All statuses"
                             : filters.status.replaceAll("_", " ")
                         }
                       </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All statuses</SelectItem>
                      {availableStatuses.map((status) => (
                        <SelectItem key={status} value={status}>
                          {status.replaceAll("_", " ")}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className={fieldClass}>
                  <Label htmlFor="transaction-filter-category">Category</Label>
                  <Select
                    value={filters.category}
                    onValueChange={(value) =>
                      setFilters({ ...filters, category: value ?? "all" })
                    }
                    >
                      <SelectTrigger id="transaction-filter-category">
                       <SelectValue>
                         {() =>
                           filters.category === "all"
                             ? "All categories"
                             : availableCategories.find(
                                 ([value]) => value === filters.category,
                               )?.[1]
                         }
                       </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All categories</SelectItem>
                      {availableCategories.map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className={fieldClass}>
                  <Label htmlFor="transaction-sort-order">Sort by</Label>
                  <Select
                    value={sortOrder}
                    onValueChange={(value) => setSortOrder((value ?? "date-desc") as SortOrder)}
                    >
                      <SelectTrigger id="transaction-sort-order">
                       <SelectValue>{() => SORT_LABELS[sortOrder]}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="date-desc">Newest date</SelectItem>
                      <SelectItem value="date-asc">Oldest date</SelectItem>
                      <SelectItem value="amount-desc">
                        Highest amount
                      </SelectItem>
                      <SelectItem value="amount-asc">Lowest amount</SelectItem>
                      <SelectItem value="name-asc">Name A-Z</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  className="self-end max-[520px]:w-full"
                  variant="secondary"
                  type="button"
                  disabled={!filtersActive}
                  onClick={() =>
                    setFilters({
                      search: "",
                      direction: "all",
                      status: "all",
                      category: "all",
                    })
                  }
                >
                  Clear filters
                </Button>
              </div>
              <div aria-live="polite">
                {visibleEntries.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    {entries.length
                      ? "No transactions match these filters."
                      : "No transactions yet."}
                  </p>
                ) : (
                  visibleEntries.map((entry) => (
                    <div
                      className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-4 border-t border-border py-4 max-[620px]:grid-cols-[minmax(0,1fr)_auto]"
                      key={entry.id}
                    >
                      <div className="min-w-0 [overflow-wrap:anywhere]">
                        <strong className="mb-1 block text-sm">
                          {entry.name}
                        </strong>
                        <small className="block text-xs leading-5 text-muted-foreground">
                          {entry.scheduledDate} ·{" "}
                          <Badge
                            variant={
                              entry.status === "paid" ? "success" : "outline"
                            }
                          >
                            {entry.status}
                          </Badge>{" "}
                          · {transactionLabel(entry)}
                        </small>
                      </div>
                      <b
                        className={`whitespace-nowrap font-mono text-sm tabular-nums ${entry.direction === "inflow" ? "text-[#3f665e]" : "text-foreground"}`}
                      >
                        {entry.direction === "inflow" ? "+" : "−"}
                        {money(effectiveAmount(entry), currency)}
                      </b>
                      <div className="flex min-w-0 flex-wrap items-center justify-end gap-1 max-[620px]:col-span-full max-[620px]:justify-start">
                        {entry.status !== "paid" && (
                          <>
                            <Button
                              className="min-h-0"
                              variant="ghost"
                              size="sm"
                              type="button"
                              onClick={() => openMarkPaid(entry)}
                            >
                              Mark paid
                            </Button>
                            <Button
                              className="min-h-0"
                              variant="ghost"
                              size="sm"
                              type="button"
                              onClick={() =>
                                patchEntry(entry.id, {
                                  included: !entry.included,
                                })
                              }
                            >
                              {entry.included ? "Exclude" : "Include"}
                            </Button>
                          </>
                        )}
                        <Button
                          className="min-h-0"
                          variant="ghost"
                          size="sm"
                          type="button"
                          onClick={() => edit(entry)}
                        >
                          Edit
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger
                            render={<Button
                              className="min-h-0 text-destructive hover:bg-destructive/10"
                              variant="ghost"
                              size="icon"
                              type="button"
                              aria-label={`Delete ${entry.name}`}
                            />}
                          >
                            ×
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>
                                Delete transaction?
                              </AlertDialogTitle>
                              <AlertDialogDescription>
                                This permanently removes {entry.name} from your
                                transaction history.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel
                                variant="secondary"
                                type="button"
                              >
                                Cancel
                              </AlertDialogCancel>
                              <AlertDialogAction
                                variant="destructive"
                                type="button"
                                onClick={() => remove(entry)}
                              >
                                Delete transaction
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  ))
                )}
              </div>
          </div>
        </Card>
        <Dialog
          open={transactionDialogOpen}
          onOpenChange={(open) => {
            if (!open) closeTransactionDialog();
          }}
        >
          <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-xl">
            <form className="grid min-w-0 gap-4" onSubmit={submit}>
              <DialogHeader className="pr-8">
                <DialogTitle>
                  {editingId ? "Edit transaction" : "New transaction"}
                </DialogTitle>
                <DialogDescription>
                  {editingId
                    ? "Update this payment or expense."
                    : "Record a completed payment or expense, or add an expected movement to your cash plan."}
                </DialogDescription>
              </DialogHeader>
              <RadioGroup
                className="grid grid-cols-2 gap-2"
                value={transaction.direction}
                onValueChange={(value: Direction) =>
                  setTransaction({
                    ...transaction,
                    direction: value,
                    category: categories[value][0][0],
                    partyId: "",
                    status: value === "inflow" ? "expected" : "planned",
                  })
                }
                disabled={busy}
                aria-label="Transaction type"
              >
                <Label className="col-span-full font-mono text-[0.7rem] uppercase tracking-[0.06em] text-muted-foreground">
                  Transaction type
                </Label>
                {(["inflow", "outflow"] as Direction[]).map((value) => (
                  <Label className="relative" key={value}>
                    <RadioGroupItem
                      className="peer absolute opacity-0"
                      value={value}
                    />
                    <span className="grid min-h-11 cursor-pointer place-items-center border border-border p-2 text-center text-xs peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-secondary peer-data-[state=checked]:font-bold peer-data-[state=checked]:text-foreground peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2">
                      {value === "inflow" ? "Payment received" : "Expense paid"}
                    </span>
                  </Label>
                ))}
              </RadioGroup>
              <RadioGroup
                className="grid grid-cols-2 gap-2"
                value={transaction.timing}
                onValueChange={(value: Timing) =>
                  setTransaction({ ...transaction, timing: value })
                }
                disabled={busy}
                aria-label="Timing"
              >
                <Label className="col-span-full font-mono text-[0.7rem] uppercase tracking-[0.06em] text-muted-foreground">
                  Timing
                </Label>
                {(["recorded", "planned"] as Timing[]).map((value) => (
                  <Label className="relative" key={value}>
                    <RadioGroupItem
                      className="peer absolute opacity-0"
                      value={value}
                    />
                    <span className="grid min-h-11 cursor-pointer place-items-center border border-border p-2 text-center text-xs peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-secondary peer-data-[state=checked]:font-bold peer-data-[state=checked]:text-foreground peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2">
                      {value === "recorded"
                        ? "Already happened"
                        : "Expected / planned"}
                    </span>
                  </Label>
                ))}
              </RadioGroup>
              <Label className={fieldClass}>
                <span>Description</span>
                <Input
                  maxLength={120}
                  required
                  value={transaction.name}
                  onChange={(event) =>
                    setTransaction({ ...transaction, name: event.target.value })
                  }
                  disabled={busy}
                />
              </Label>
              <div className="grid grid-cols-2 gap-3 max-[420px]:grid-cols-1">
                <Label className={fieldClass}>
                  <span>Amount</span>
                  <Input
                    inputMode="decimal"
                    required
                    value={transaction.amount}
                    onChange={(event) =>
                      setTransaction({
                        ...transaction,
                        amount: event.target.value,
                      })
                    }
                    disabled={busy}
                  />
                </Label>
                <Label className={fieldClass}>
                  <span>Date</span>
                  <Input
                    type="date"
                    required
                    value={transaction.date}
                    onChange={(event) =>
                      setTransaction({
                        ...transaction,
                        date: event.target.value,
                      })
                    }
                    disabled={busy}
                  />
                </Label>
              </div>
              <div className={fieldClass}>
                <Label htmlFor="transaction-party">
                  {transaction.direction === "inflow" ? "Customer" : "Supplier"}
                </Label>
                <Select
                  value={transaction.partyId || "__none__"}
                  onValueChange={(value) =>
                    setTransaction({
                      ...transaction,
                      partyId: value === "__none__" || value === null ? "" : value,
                    })
                  }
                  disabled={busy}
                  >
                  <SelectTrigger id="transaction-party">
                     <SelectValue>
                       {(value) =>
                         value === "__none__"
                           ? `No registered ${transaction.direction === "inflow" ? "customer" : "supplier"}`
                           : allowedParties.find((item) => item.id === value)?.name
                       }
                     </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">
                      No registered{" "}
                      {transaction.direction === "inflow"
                        ? "customer"
                        : "supplier"}
                    </SelectItem>
                    {allowedParties.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {transaction.direction === "inflow" && (
                <Label className={fieldClass}>
                  <span>Invoice reference</span>
                  <Input
                    maxLength={80}
                    value={transaction.invoiceReference}
                    onChange={(event) =>
                      setTransaction({
                        ...transaction,
                        invoiceReference: event.target.value,
                      })
                    }
                    disabled={busy}
                  />
                </Label>
              )}
              <div className={fieldClass}>
                <Label htmlFor="transaction-category">Category</Label>
                <Select
                  value={transaction.category}
                  onValueChange={(value) =>
                    setTransaction({ ...transaction, category: value ?? categories[transaction.direction][0][0] })
                  }
                  disabled={busy}
                  >
                  <SelectTrigger id="transaction-category">
                     <SelectValue>
                       {() =>
                         categories[transaction.direction].find(
                           ([value]) => value === transaction.category,
                         )?.[1]
                       }
                     </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {categories[transaction.direction].map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {transaction.timing === "planned" && (
                <>
                  <div className={fieldClass}>
                    <Label htmlFor="transaction-status">Status</Label>
                    <Select
                      value={transaction.status}
                      onValueChange={(value) =>
                        setTransaction({ ...transaction, status: value ?? (transaction.direction === "inflow" ? "expected" : "planned") })
                      }
                      disabled={busy}
                    >
                      <SelectTrigger id="transaction-status">
                       <SelectValue>
                         {() =>
                           transaction.status[0].toUpperCase() +
                           transaction.status.slice(1).replaceAll("_", " ")
                         }
                       </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {(transaction.direction === "inflow"
                          ? [
                              ["expected", "Expected"],
                              ["invoiced", "Invoiced"],
                              ["unlikely", "Unlikely"],
                            ]
                          : [["planned", "Planned"]]
                        ).map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Label className="flex min-h-11 items-center gap-3 text-sm">
                    <Checkbox
                      checked={transaction.recurring}
                      onCheckedChange={(checked) =>
                        setTransaction({
                          ...transaction,
                          recurring: checked === true,
                        })
                      }
                      disabled={busy}
                    />
                    <span>Repeat monthly</span>
                  </Label>
                </>
              )}
              <p
                className="min-h-5 text-sm text-[#3f665e]"
                role="status"
                aria-live="polite"
              >
                {message}
              </p>
              <DialogFooter>
                <Button
                  variant="secondary"
                  type="button"
                  onClick={closeTransactionDialog}
                  disabled={busy}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={busy}>
                  {editingId ? "Save transaction" : "Add transaction"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
        {!transactionDialogOpen && message && (
          <p
            className="mt-4 text-sm text-[#3f665e]"
            role="status"
            aria-live="polite"
          >
            {message}
          </p>
        )}
        <Dialog
          open={Boolean(markPaidEntry)}
          onOpenChange={(open) => {
            if (!open && !markPaidBusy) setMarkPaidEntry(null);
          }}
        >
          <DialogContent>
            <form onSubmit={markPaid} className="grid gap-4">
              <DialogHeader>
                <DialogTitle>Mark transaction paid</DialogTitle>
                <DialogDescription>
                  Record the actual amount and payment date for{" "}
                  {markPaidEntry?.name}.
                </DialogDescription>
              </DialogHeader>
              <Label htmlFor="mark-paid-amount">Actual amount</Label>
              <Input
                id="mark-paid-amount"
                inputMode="decimal"
                required
                value={markPaidAmount}
                onChange={(event) => {
                  setMarkPaidAmount(event.target.value);
                  setMarkPaidError("");
                }}
                disabled={markPaidBusy}
              />
              <Label htmlFor="mark-paid-date">Actual date</Label>
              <Input
                id="mark-paid-date"
                type="date"
                required
                value={markPaidDate}
                onChange={(event) => {
                  setMarkPaidDate(event.target.value);
                  setMarkPaidError("");
                }}
                disabled={markPaidBusy}
              />
              {markPaidError && (
                <p className="text-sm text-destructive" role="alert">
                  {markPaidError}
                </p>
              )}
              <DialogFooter>
                <Button
                  variant="secondary"
                  type="button"
                  onClick={() => setMarkPaidEntry(null)}
                  disabled={markPaidBusy}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={markPaidBusy}>
                  Mark paid
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </main>
    </AppShell>
  );
}
