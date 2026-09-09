import { FormEvent, useEffect, useRef, useState } from "react";

import { api } from "../api";
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
} from "../components/ui/alert-dialog";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
} from "../components/ui/pagination";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { Textarea } from "../components/ui/textarea";
import { addDays, amountMinor, money, todayIso } from "../utils";

type Filter = "all" | "draft" | "sent" | "overdue" | "paid";
type InvoiceSort =
  | "created-desc"
  | "due-asc"
  | "due-desc"
  | "amount-desc"
  | "amount-asc"
  | "customer-asc"
  | "status-asc";
type InvoiceSummary = {
  id: string;
  invoiceNumber: string;
  issueDate: string;
  dueDate: string;
  status: string;
  totalMinor: number;
  customerName: string;
};
type InvoiceItem = {
  id?: string;
  description: string;
  quantityMilli: number;
  unitPriceMinor: number;
  amountMinor: number;
};
type Invoice = InvoiceSummary & {
  customerId: string;
  taxRateBasisPoints: number;
  notes: string | null;
  paidDate: string | null;
  items: InvoiceItem[];
};
type Party = { id: string; name: string; role: string };
type ItemForm = {
  key: string;
  description: string;
  quantity: string;
  unitPrice: string;
};
type InvoiceForm = {
  customerId: string;
  invoiceNumber: string;
  issueDate: string;
  dueDate: string;
  taxRate: string;
  notes: string;
  items: ItemForm[];
};
type InvoiceDialog = { type: "paid" | "delete"; invoiceId: string } | null;

const FILTERS: Filter[] = ["all", "draft", "sent", "overdue", "paid"];
const SORTS: InvoiceSort[] = [
  "created-desc",
  "due-asc",
  "due-desc",
  "amount-desc",
  "amount-asc",
  "customer-asc",
  "status-asc",
];
const SORT_LABELS: Record<InvoiceSort, string> = {
  "created-desc": "Newest issued",
  "due-asc": "Due soonest",
  "due-desc": "Due latest",
  "amount-desc": "Highest amount",
  "amount-asc": "Lowest amount",
  "customer-asc": "Customer A-Z",
  "status-asc": "Status",
};
const PAGE_SIZE = 10;
let itemSequence = 0;

function newItem(item?: InvoiceItem): ItemForm {
  itemSequence += 1;
  return {
    key: `invoice-item-${itemSequence}`,
    description: item?.description || "",
    quantity: item ? String(item.quantityMilli / 1000) : "1",
    unitPrice: item ? (item.unitPriceMinor / 100).toFixed(2) : "0.00",
  };
}

function emptyForm(): InvoiceForm {
  const today = todayIso();
  return {
    customerId: "",
    invoiceNumber: "",
    issueDate: today,
    dueDate: addDays(today, 14),
    taxRate: "0",
    notes: "",
    items: [newItem()],
  };
}

function initialQuery() {
  const params = new URLSearchParams(window.location.search);
  const value = params.get("filter");
  const sort = params.get("sort");
  return {
    filter: FILTERS.includes(value as Filter)
      ? (value as Filter)
      : ("all" as Filter),
    invoiceId: params.get("invoice"),
    search: params.get("q") ?? "",
    sort: SORTS.includes(sort as InvoiceSort)
      ? (sort as InvoiceSort)
      : ("created-desc" as InvoiceSort),
    page: Math.max(1, Number.parseInt(params.get("page") || "1", 10) || 1),
  };
}

function setQueryState(
  key: string,
  value: string | null,
  defaultValue?: string,
) {
  const url = new URL(window.location.href);
  if (!value || value === defaultValue) url.searchParams.delete(key);
  else url.searchParams.set(key, value);
  window.history.replaceState({}, "", url);
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export function InvoicesPage() {
  const query = useRef(initialQuery());
  const [invoices, setInvoices] = useState<InvoiceSummary[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [currency, setCurrency] = useState("USD");
  const [filter, setFilter] = useState<Filter>(query.current.filter);
  const [search, setSearch] = useState(query.current.search);
  const [sort, setSort] = useState<InvoiceSort>(query.current.sort);
  const [page, setPage] = useState(query.current.page);
  const [selectedId, setSelectedId] = useState<string | null>(
    query.current.invoiceId,
  );
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [form, setForm] = useState<InvoiceForm>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [messageError, setMessageError] = useState(false);
  const [detailMessage, setDetailMessage] = useState("");
  const [detailError, setDetailError] = useState(false);
  const [action, setAction] = useState<string | null>(null);
  const [dialog, setDialog] = useState<InvoiceDialog>(null);
  const [paidDate, setPaidDate] = useState(todayIso());

  async function refresh() {
    const [invoiceData, partyData, financialData] = await Promise.all([
      api<{ invoices: InvoiceSummary[] }>("/api/invoices"),
      api<{ parties: Party[] }>("/api/parties"),
      api<{ currency?: string }>("/api/financials"),
    ]);
    setInvoices(invoiceData.invoices);
    setParties(
      partyData.parties.filter(
        (party) => party.role === "customer" || party.role === "both",
      ),
    );
    setCurrency(financialData.currency || "USD");
  }

  useEffect(() => {
    let active = true;
    Promise.all([
      api<{ invoices: InvoiceSummary[] }>("/api/invoices"),
      api<{ parties: Party[] }>("/api/parties"),
      api<{ currency?: string }>("/api/financials"),
    ])
      .then(([invoiceData, partyData, financialData]) => {
        if (!active) return;
        setInvoices(invoiceData.invoices);
        setParties(
          partyData.parties.filter(
            (party) => party.role === "customer" || party.role === "both",
          ),
        );
        setCurrency(financialData.currency || "USD");
      })
      .catch((error) => {
        if (!active) return;
        setMessageError(true);
        setMessage(errorMessage(error, "Unable to load invoices."));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setSelectedInvoice(null);
      return;
    }
    let active = true;
    setLoadingDetail(true);
    setDetailMessage("");
    setDetailError(false);
    api<{ invoice: Invoice }>(`/api/invoices/${selectedId}`)
      .then((result) => {
        if (active) setSelectedInvoice(result.invoice);
      })
      .catch((error) => {
        if (!active) return;
        setSelectedInvoice(null);
        setDetailError(true);
        setDetailMessage(errorMessage(error, "Unable to load this invoice."));
      })
      .finally(() => {
        if (active) setLoadingDetail(false);
      });
    return () => {
      active = false;
    };
  }, [selectedId]);

  function selectInvoice(id: string | null) {
    setSelectedId(id);
    setQueryState("invoice", id);
  }

  function selectFilter(value: Filter) {
    setFilter(value);
    setQueryState("filter", value, "all");
    changePage(1);
  }

  function updateSearch(value: string) {
    setSearch(value);
    setQueryState("q", value.trim() || null);
    changePage(1);
  }

  function updateSort(value: InvoiceSort) {
    setSort(value);
    setQueryState("sort", value, "created-desc");
    changePage(1);
  }

  function changePage(value: number) {
    setPage(value);
    setQueryState("page", String(value), "1");
  }

  function clearInvoiceFilters() {
    selectFilter("all");
    updateSearch("");
    updateSort("created-desc");
  }

  function resetForm() {
    setEditingId(null);
    setForm(emptyForm());
    setMessage("");
    setMessageError(false);
  }

  function closeEditor() {
    setEditorOpen(false);
    resetForm();
  }

  function newInvoice() {
    resetForm();
    setEditorOpen(true);
  }

  function updateItem(
    key: string,
    field: "description" | "quantity" | "unitPrice",
    value: string,
  ) {
    setForm((current) => ({
      ...current,
      items: current.items.map((item) =>
        item.key === key ? { ...item, [field]: value } : item,
      ),
    }));
  }

  function itemTotal(item: ItemForm) {
    const quantity = Math.round((Number(item.quantity) || 0) * 1000) / 1000;
    return Math.round(quantity * (amountMinor(item.unitPrice) || 0));
  }

  const subtotal = form.items.reduce((sum, item) => sum + itemTotal(item), 0);
  const total =
    subtotal + Math.round((subtotal * (Number(form.taxRate) || 0)) / 100);

  async function saveInvoice(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    setMessageError(false);
    const tax = form.taxRate.trim();
    const payload = {
      customerId: form.customerId,
      issueDate: form.issueDate,
      dueDate: form.dueDate,
      taxRateBasisPoints: /^\d+(?:\.\d{1,2})?$/.test(tax)
        ? Math.round(Number(tax) * 100)
        : null,
      notes: form.notes,
      items: form.items.map((item) => ({
        description: item.description,
        quantity: Number(item.quantity),
        unitPriceMinor: amountMinor(item.unitPrice),
      })),
    };
    try {
      const result = await api<{ id: string }>(
        editingId ? `/api/invoices/${editingId}` : "/api/invoices",
        {
          method: editingId ? "PATCH" : "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      await refresh();
      closeEditor();
      selectInvoice(result.id);
      const detail = await api<{ invoice: Invoice }>(
        `/api/invoices/${result.id}`,
      );
      setSelectedInvoice(detail.invoice);
    } catch (error) {
      setMessageError(true);
      setMessage(errorMessage(error, "Unable to save invoice."));
    } finally {
      setSaving(false);
    }
  }

  function editInvoice(invoice: Invoice) {
    setEditingId(invoice.id);
    setForm({
      customerId: invoice.customerId,
      invoiceNumber: invoice.invoiceNumber,
      issueDate: invoice.issueDate,
      dueDate: invoice.dueDate,
      taxRate: String(invoice.taxRateBasisPoints / 100),
      notes: invoice.notes || "",
      items: invoice.items.map(newItem),
    });
    setMessage("");
    setMessageError(false);
    setEditorOpen(true);
  }

  async function runDetailAction(kind: "send" | "paid" | "delete", id: string) {
    setAction(kind);
    setDetailMessage("");
    setDetailError(false);
    try {
      if (kind === "send") {
        await api(`/api/invoices/${id}/send`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: "{}",
        });
        setDetailMessage("Invoice emailed to the customer.");
      } else if (kind === "paid") {
        await api(`/api/invoices/${id}/paid`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ paidDate }),
        });
        setDialog(null);
      } else {
        await api(`/api/invoices/${id}`, { method: "DELETE" });
        setDialog(null);
        selectInvoice(null);
      }
      await refresh();
      if (kind !== "delete") {
        const result = await api<{ invoice: Invoice }>(`/api/invoices/${id}`);
        setSelectedInvoice(result.invoice);
      }
    } catch (error) {
      setDetailError(true);
      setDetailMessage(errorMessage(error, `Unable to ${kind} invoice.`));
    } finally {
      setAction(null);
    }
  }

  const normalizedSearch = search.trim().toLocaleLowerCase();
  const visibleInvoices = invoices
    .filter((invoice) => {
      const matchesStatus = filter === "all" || invoice.status === filter;
      const matchesSearch =
        !normalizedSearch ||
        `${invoice.invoiceNumber} ${invoice.customerName}`
          .toLocaleLowerCase()
          .includes(normalizedSearch);
      return matchesStatus && matchesSearch;
    })
    .sort((first, second) => {
      if (sort === "due-asc")
        return first.dueDate.localeCompare(second.dueDate);
      if (sort === "due-desc")
        return second.dueDate.localeCompare(first.dueDate);
      if (sort === "amount-desc") return second.totalMinor - first.totalMinor;
      if (sort === "amount-asc") return first.totalMinor - second.totalMinor;
      if (sort === "customer-asc")
        return first.customerName.localeCompare(
          second.customerName,
          undefined,
          { sensitivity: "base" },
        );
      if (sort === "status-asc")
        return (
          first.status.localeCompare(second.status) ||
          first.dueDate.localeCompare(second.dueDate)
        );
      return (
        second.issueDate.localeCompare(first.issueDate) ||
        second.invoiceNumber.localeCompare(first.invoiceNumber)
      );
    });
  const invoiceFiltersActive =
    filter !== "all" || search !== "" || sort !== "created-desc";
  const pageCount = Math.max(1, Math.ceil(visibleInvoices.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const paginatedInvoices = visibleInvoices.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );

  return (
    <AppShell activePage="invoices">
      <main
        className="min-h-screen w-full px-4 pb-24 pt-6 min-[761px]:px-6 min-[761px]:pb-20 min-[1200px]:px-8"
        id="app-main"
      >
        <header className="flex min-h-[150px] items-center justify-between gap-6 border-b border-border max-[520px]:min-h-[180px] max-[520px]:flex-col max-[520px]:items-start max-[520px]:justify-center">
          <div>
            <p className="mb-2 font-mono text-[0.7rem] uppercase leading-[1.35] tracking-[0.08em] text-[#3f665e]">Get paid</p>
            <h1 className="text-[clamp(2.5rem,4.2vw,4.5rem)] font-semibold tracking-[-0.06em]">Invoices</h1>
          </div>
          <Button
            type="button"
            onClick={newInvoice}
          >
            New invoice
          </Button>
        </header>
        <section className="grid items-start gap-4 pt-5" aria-busy={loading}>
          <div className="grid min-w-0 content-start gap-4">
            <Card className="grid gap-4 p-[clamp(1.5rem,3vw,2.5rem)]">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="mb-2 font-mono text-[0.7rem] uppercase leading-[1.35] tracking-[0.08em] text-[#3f665e]">Documents</p>
                  <h2 className="text-[1.4rem] font-semibold tracking-[-0.045em]">All Invoices</h2>
                </div>
                <span className="font-mono text-[0.65rem] uppercase text-muted-foreground">
                  {visibleInvoices.length} of {invoices.length}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2" aria-label="Filter invoices">
                {FILTERS.map((value) => (
                  <Button
                    key={value}
                    variant="filter"
                    size="sm"
                    type="button"
                    data-state={filter === value ? "on" : "off"}
                    aria-pressed={filter === value}
                    onClick={() => selectFilter(value)}
                  >
                    {value[0].toUpperCase() + value.slice(1)}
                  </Button>
                ))}
              </div>
              <div
                className="grid gap-3 border border-border bg-white/55 p-4 sm:grid-cols-[minmax(0,1fr)_minmax(10rem,0.65fr)_auto] sm:items-end"
                aria-label="Search and sort invoices"
              >
                <Label className="block">
                  <span className="mb-[0.45rem] block">Search</span>
                  <Input
                    type="search"
                    value={search}
                    onChange={(event) => updateSearch(event.target.value)}
                    placeholder="Invoice or customer…"
                  />
                </Label>
                <div>
                  <Label className="mb-[0.45rem] block" htmlFor="invoice-sort">Sort by</Label>
                  <Select
                    value={sort}
                    onValueChange={(value) => updateSort((value ?? "created-desc") as InvoiceSort)}
                    >
                      <SelectTrigger id="invoice-sort">
                       <SelectValue>{() => SORT_LABELS[sort]}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                       {SORTS.map((value) => (
                         <SelectItem key={value} value={value}>
                           {SORT_LABELS[value]}
                         </SelectItem>
                       ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  variant="secondary"
                  type="button"
                  disabled={!invoiceFiltersActive}
                  onClick={clearInvoiceFilters}
                >
                  Clear filters
                </Button>
              </div>
              <div aria-live="polite">
                {paginatedInvoices.length ? (
                  paginatedInvoices.map((invoice) => (
                    <button
                      key={invoice.id}
                      className="grid min-h-[78px] w-full min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 border-0 border-t border-border bg-transparent py-4 text-left transition-[background-color,padding] hover:bg-accent/10 hover:px-3 aria-[current=true]:bg-accent/10 aria-[current=true]:px-3 sm:grid-cols-[minmax(0,1fr)_auto_auto]"
                      type="button"
                      aria-current={selectedId === invoice.id}
                      onClick={() => selectInvoice(invoice.id)}
                    >
                      <span className="min-w-0">
                        <strong className="block [overflow-wrap:anywhere]">{invoice.invoiceNumber}</strong>
                        <small className="mt-1 block [overflow-wrap:anywhere] text-xs text-muted-foreground">
                          {invoice.customerName} · Due {invoice.dueDate}
                        </small>
                      </span>
                      <Badge
                        variant={
                          invoice.status === "paid"
                            ? "success"
                            : invoice.status === "overdue"
                              ? "destructive"
                              : "outline"
                        }
                      >
                        {invoice.status}
                      </Badge>
                      <b className="col-start-2 row-start-2 whitespace-nowrap text-right font-mono text-xs tabular-nums sm:col-start-3 sm:row-start-1">
                        {money(invoice.totalMinor, currency)}
                      </b>
                    </button>
                  ))
                ) : (
                  <p className="border-t border-border py-8 text-center text-sm text-muted-foreground">
                    {invoices.length
                      ? "No invoices match these filters."
                      : "No invoices yet."}
                  </p>
                )}
              </div>
              {visibleInvoices.length > PAGE_SIZE ? (
                <Pagination
                  className="border-t border-border pt-4"
                  aria-label="Invoice pages"
                >
                  <PaginationContent className="grid w-full grid-cols-2 gap-3 sm:grid-cols-[auto_1fr_auto] sm:items-center">
                    <PaginationItem>
                      <Button
                          variant="secondary"
                          size="sm"
                        type="button"
                        disabled={currentPage === 1}
                        onClick={() => changePage(currentPage - 1)}
                      >
                        Previous
                      </Button>
                    </PaginationItem>
                    <PaginationItem>
                      <span className="col-span-2 block text-center font-mono text-xs uppercase text-muted-foreground sm:col-span-1">
                        Page {currentPage} of {pageCount}
                      </span>
                    </PaginationItem>
                    <PaginationItem>
                      <Button
                          variant="secondary"
                          size="sm"
                        type="button"
                        disabled={currentPage === pageCount}
                        onClick={() => changePage(currentPage + 1)}
                      >
                        Next
                      </Button>
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              ) : null}
            </Card>

            {selectedId ? (
              <Card
                className="p-[clamp(1.5rem,3vw,2.5rem)]"
                aria-busy={loadingDetail}
              >
                {selectedInvoice ? (
                  <>
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <Badge
                          variant={
                            selectedInvoice.status === "paid"
                              ? "success"
                              : selectedInvoice.status === "overdue"
                                ? "destructive"
                                : "outline"
                          }
                        >
                          {selectedInvoice.status}
                        </Badge>
                        <h2 className="mt-2 text-[1.4rem] font-semibold tracking-[-0.045em]">Invoice {selectedInvoice.invoiceNumber}</h2>
                      </div>
                      <strong className="whitespace-nowrap font-mono tabular-nums">
                        {money(selectedInvoice.totalMinor, currency)}
                      </strong>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-muted-foreground">
                      {selectedInvoice.customerName} · Issued{" "}
                      {selectedInvoice.issueDate} · Due{" "}
                      {selectedInvoice.dueDate}
                    </p>
                    <div className="mt-6">
                      {selectedInvoice.items.map((item, index) => (
                        <div
                          className="flex justify-between gap-4 border-t border-border py-4 text-sm last:border-b"
                          key={item.id || `${item.description}-${index}`}
                        >
                          <span>
                            {item.description} · {item.quantityMilli / 1000} ×{" "}
                            {money(item.unitPriceMinor, currency)}
                          </span>
                          <strong className="whitespace-nowrap text-right font-mono tabular-nums">{money(item.amountMinor, currency)}</strong>
                        </div>
                      ))}
                    </div>
                    <div className="flex justify-between border-t-2 border-foreground py-4 font-mono tabular-nums">
                      <span>Total</span>
                      <strong>
                        {money(selectedInvoice.totalMinor, currency)}
                      </strong>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 max-[520px]:grid max-[520px]:grid-cols-1 [&>*]:flex-1">
                      {selectedInvoice.status === "draft" ? (
                        <>
                          <Button
                            variant="secondary"
                            type="button"
                            disabled={action !== null}
                            onClick={() => editInvoice(selectedInvoice)}
                          >
                            Edit draft
                          </Button>
                          <Button
                            type="button"
                            disabled={action !== null}
                            onClick={() =>
                              runDetailAction("send", selectedInvoice.id)
                            }
                          >
                            {action === "send" ? "Sending..." : "Send invoice"}
                          </Button>
                          <Button
                            variant="secondary"
                            type="button"
                            disabled={action !== null}
                            onClick={() =>
                              setDialog({
                                type: "delete",
                                invoiceId: selectedInvoice.id,
                              })
                            }
                          >
                            Delete
                          </Button>
                        </>
                      ) : selectedInvoice.status !== "paid" &&
                        selectedInvoice.status !== "void" ? (
                        <>
                          <Button
                            variant="secondary"
                            type="button"
                            disabled={action !== null}
                            onClick={() =>
                              runDetailAction("send", selectedInvoice.id)
                            }
                          >
                            {action === "send" ? "Sending..." : "Send again"}
                          </Button>
                          <Button
                            type="button"
                            disabled={action !== null}
                            onClick={() => {
                              setPaidDate(todayIso());
                              setDialog({
                                type: "paid",
                                invoiceId: selectedInvoice.id,
                              });
                            }}
                          >
                            Mark paid
                          </Button>
                        </>
                      ) : selectedInvoice.status === "paid" ? (
                        <Badge variant="success">
                          Paid {selectedInvoice.paidDate || ""}
                        </Badge>
                      ) : null}
                    </div>
                  </>
                ) : loadingDetail ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">Loading invoice...</p>
                ) : null}
                <p
                  className={`min-h-5 text-xs ${detailError ? "text-destructive" : "text-[#225c50]"}`}
                  role="status"
                  aria-live="polite"
                >
                  {detailMessage}
                </p>
              </Card>
            ) : null}
          </div>

        </section>

        <Dialog
          open={editorOpen}
          onOpenChange={(open) => {
            if (!open && !saving) closeEditor();
          }}
        >
          <DialogContent
            className="flex max-h-[calc(100dvh-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-5xl"
          >
            <form
              className="flex min-h-0 flex-1 flex-col text-popover-foreground"
              onSubmit={saveInvoice}
            >
              <DialogHeader className="shrink-0 border-b border-border px-5 py-4 pr-12 sm:px-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="mb-2 font-mono text-[0.7rem] uppercase leading-[1.35] tracking-[0.08em] text-[#3f665e]">Invoice editor</p>
                    <DialogTitle className="text-[1.4rem] font-semibold tracking-[-0.045em]">
                      {editingId ? `Edit ${form.invoiceNumber}` : "New invoice"}
                    </DialogTitle>
                  </div>
                  <Badge variant="outline">Draft</Badge>
                </div>
                <DialogDescription>
                  {editingId
                    ? "Update this draft invoice and its line items."
                    : "Create a draft invoice. An invoice number is assigned when you save."}
                </DialogDescription>
              </DialogHeader>
              <div className="grid min-h-0 flex-1 content-start gap-4 overflow-y-auto px-5 py-5 sm:px-6">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label className="mb-[0.45rem] block" htmlFor="invoice-customer">Customer</Label>
                <Select
                  value={form.customerId}
                  onValueChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      customerId: value ?? "",
                    }))
                  }
                  required
                  disabled={saving}
                >
                  <SelectTrigger id="invoice-customer">
                    <SelectValue
                      placeholder={
                        parties.length
                          ? "Choose a customer"
                          : "Register a customer first"
                      }
                     >
                       {(value) =>
                         value
                           ? parties.find((party) => party.id === value)?.name
                           : parties.length
                             ? "Choose a customer"
                             : "Register a customer first"
                       }
                     </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {parties.map((party) => (
                      <SelectItem key={party.id} value={party.id}>
                        {party.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Label className="block">
                <span className="mb-[0.45rem] block">Invoice number</span>
                <Input
                  value={form.invoiceNumber}
                  readOnly
                  spellCheck={false}
                  placeholder="Assigned automatically..."
                />
                <small className="mt-1.5 block min-h-4 normal-case leading-5 tracking-normal text-muted-foreground">Assigned when the draft is first saved.</small>
              </Label>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Label className="block">
                <span className="mb-[0.45rem] block">Issue date</span>
                <Input
                  value={form.issueDate}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      issueDate: event.target.value,
                    }))
                  }
                  type="date"
                  required
                  disabled={saving}
                />
              </Label>
              <Label className="block">
                <span className="mb-[0.45rem] block">Due date</span>
                <Input
                  value={form.dueDate}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      dueDate: event.target.value,
                    }))
                  }
                  type="date"
                  required
                  disabled={saving}
                />
              </Label>
            </div>
            <div className="flex items-center justify-between gap-2 font-mono text-xs uppercase">
              <span>Line items</span>
              <Button
                variant="link"
                type="button"
                disabled={saving || form.items.length >= 100}
                onClick={() =>
                  setForm((current) => ({
                    ...current,
                    items: [...current.items, newItem()],
                  }))
                }
              >
                + Add item
              </Button>
            </div>
            <div>
              {form.items.map((item) => (
                <div className="grid grid-cols-1 items-end gap-2 border-t border-border py-3 sm:grid-cols-[minmax(0,1fr)_5rem_7.5rem_auto_2.5rem]" key={item.key}>
                  <Label className="block">
                    <span className="mb-[0.45rem] block">Description</span>
                    <Input
                      value={item.description}
                      onChange={(event) =>
                        updateItem(item.key, "description", event.target.value)
                      }
                      maxLength={200}
                      required
                      disabled={saving}
                    />
                  </Label>
                  <Label className="block">
                    <span className="mb-[0.45rem] block">Quantity</span>
                    <Input
                      value={item.quantity}
                      onChange={(event) =>
                        updateItem(item.key, "quantity", event.target.value)
                      }
                      inputMode="decimal"
                      required
                      disabled={saving}
                    />
                  </Label>
                  <Label className="block">
                    <span className="mb-[0.45rem] block">Unit price</span>
                    <Input
                      value={item.unitPrice}
                      onChange={(event) =>
                        updateItem(item.key, "unitPrice", event.target.value)
                      }
                      inputMode="decimal"
                      required
                      disabled={saving}
                    />
                  </Label>
                  <strong className="pb-4 font-mono text-xs tabular-nums">
                    {money(itemTotal(item), currency)}
                  </strong>
                  <Button
                    variant="ghost"
                    size="icon"
                    type="button"
                    aria-label="Remove line item"
                    disabled={saving || form.items.length === 1}
                    onClick={() =>
                      setForm((current) => ({
                        ...current,
                        items: current.items.filter(
                          (candidate) => candidate.key !== item.key,
                        ),
                      }))
                    }
                  >
                    ×
                  </Button>
                </div>
              ))}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Label className="block">
                <span className="mb-[0.45rem] block">Tax rate (%)</span>
                <Input
                  value={form.taxRate}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      taxRate: event.target.value,
                    }))
                  }
                  inputMode="decimal"
                  required
                  disabled={saving}
                />
              </Label>
              <Label className="block">
                <span className="mb-[0.45rem] block">Notes</span>
                <Textarea
                  value={form.notes}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      notes: event.target.value,
                    }))
                  }
                  maxLength={1000}
                  rows={3}
                  autoComplete="off"
                  placeholder="Payment details or a thank-you note..."
                  disabled={saving}
                />
              </Label>
            </div>
            <div className="flex justify-between border-t-2 border-foreground py-4 font-mono tabular-nums">
              <span>Total</span>
              <strong>{money(total, currency)}</strong>
            </div>
              </div>
              <DialogFooter className="shrink-0 border-t border-border px-5 py-4 sm:px-6">
                <p
                  className={`min-h-5 flex-1 text-xs ${messageError ? "text-destructive" : "text-[#225c50]"}`}
                  role="status"
                  aria-live="polite"
                >
                  {message}
                </p>
                <div className="flex items-center gap-2 max-[520px]:grid max-[520px]:w-full max-[520px]:grid-cols-1 [&>*]:flex-1">
                  <Button type="submit" disabled={saving || loading}>
                    {saving
                      ? "Saving..."
                      : editingId
                        ? "Save changes"
                        : "Save draft"}
                  </Button>
                  <Button
                    variant="secondary"
                    type="button"
                    disabled={saving}
                    onClick={closeEditor}
                  >
                    {editingId ? "Cancel" : "Clear"}
                  </Button>
                </div>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog
          open={dialog?.type === "paid"}
          onOpenChange={(open) => {
            if (!open && action === null) setDialog(null);
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Record payment</DialogTitle>
              <DialogDescription>
                Choose the date the payment was received. This will mark the
                invoice as paid.
              </DialogDescription>
            </DialogHeader>
            <Label className="block" htmlFor="invoice-paid-date">
              <span className="mb-[0.45rem] block">Payment date</span>
              <Input
                id="invoice-paid-date"
                type="date"
                value={paidDate}
                onChange={(event) => setPaidDate(event.target.value)}
                required
              />
            </Label>
            <DialogFooter className="gap-2">
              <DialogClose
                render={<Button
                  variant="secondary"
                  type="button"
                  disabled={action !== null}
                />}
              >
                  Cancel
              </DialogClose>
              <Button
                type="button"
                disabled={action !== null || !paidDate}
                onClick={() => {
                  if (dialog?.type === "paid")
                    void runDetailAction("paid", dialog.invoiceId);
                }}
              >
                {action === "paid" ? "Working..." : "Mark paid"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <AlertDialog
          open={dialog?.type === "delete"}
          onOpenChange={(open) => {
            if (!open && action === null) setDialog(null);
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete draft invoice?</AlertDialogTitle>
              <AlertDialogDescription>
                This draft will be permanently deleted. This action cannot be
                undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="gap-2">
              <AlertDialogCancel
                id="invoice-delete-cancel"
                variant="secondary"
                type="button"
                disabled={action !== null}
              >
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                type="button"
                disabled={action !== null}
                onClick={(event) => {
                  event.preventDefault();
                  if (dialog?.type === "delete")
                    void runDetailAction("delete", dialog.invoiceId);
                }}
              >
                {action === "delete" ? "Working..." : "Delete invoice"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </main>
    </AppShell>
  );
}

export default InvoicesPage;
