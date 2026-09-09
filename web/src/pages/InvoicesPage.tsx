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
  const formRef = useRef<HTMLFormElement>(null);
  const customerRef = useRef<HTMLButtonElement>(null);
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

  function scrollToForm() {
    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    formRef.current?.scrollIntoView({
      behavior: reducedMotion ? "auto" : "smooth",
      block: "center",
    });
    window.setTimeout(
      () => customerRef.current?.focus(),
      reducedMotion ? 0 : 300,
    );
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
      setMessage("Invoice draft saved.");
      setEditingId(null);
      setForm(emptyForm());
      await refresh();
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
    scrollToForm();
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
      <main className="app-main settings-main" id="app-main">
        <header className="workspace-header">
          <div>
            <p className="app-kicker">Get paid</p>
            <h1>Invoices</h1>
          </div>
          <Button
            className="button button-primary"
            type="button"
            onClick={() => {
              resetForm();
              scrollToForm();
            }}
          >
            New invoice
          </Button>
        </header>
        <section className="invoice-workspace" aria-busy={loading}>
          <div className="invoice-primary">
            <Card className="settings-card invoice-list-card">
              <div className="section-row">
                <div>
                  <p className="app-kicker">Documents</p>
                  <h2>All Invoices</h2>
                </div>
                <span>
                  {visibleInvoices.length} of {invoices.length}
                </span>
              </div>
              <div className="invoice-filters" aria-label="Filter invoices">
                {FILTERS.map((value) => (
                  <Button
                    key={value}
                    className={filter === value ? "active" : ""}
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
                className="invoice-list-controls"
                aria-label="Search and sort invoices"
              >
                <Label className="transaction-field">
                  <span>Search</span>
                  <Input
                    type="search"
                    value={search}
                    onChange={(event) => updateSearch(event.target.value)}
                    placeholder="Invoice or customer…"
                  />
                </Label>
                <div className="transaction-field">
                  <Label className="mb-[0.45rem] block text-[0.58rem]" htmlFor="invoice-sort">Sort by</Label>
                  <Select
                    value={sort}
                    onValueChange={(value) => updateSort(value as InvoiceSort)}
                  >
                    <SelectTrigger id="invoice-sort">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="created-desc">Newest issued</SelectItem>
                      <SelectItem value="due-asc">Due soonest</SelectItem>
                      <SelectItem value="due-desc">Due latest</SelectItem>
                      <SelectItem value="amount-desc">Highest amount</SelectItem>
                      <SelectItem value="amount-asc">Lowest amount</SelectItem>
                      <SelectItem value="customer-asc">Customer A-Z</SelectItem>
                      <SelectItem value="status-asc">Status</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  className="button button-secondary"
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
                      className="invoice-list-row"
                      type="button"
                      aria-current={selectedId === invoice.id}
                      onClick={() => selectInvoice(invoice.id)}
                    >
                      <span>
                        <strong>{invoice.invoiceNumber}</strong>
                        <small>
                          {invoice.customerName} · Due {invoice.dueDate}
                        </small>
                      </span>
                      <Badge
                        className={`invoice-status ${invoice.status}`}
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
                      <b>{money(invoice.totalMinor, currency)}</b>
                    </button>
                  ))
                ) : (
                  <p className="transaction-empty">
                    {invoices.length
                      ? "No invoices match these filters."
                      : "No invoices yet."}
                  </p>
                )}
              </div>
              {visibleInvoices.length > PAGE_SIZE ? (
                <Pagination
                  className="invoice-pagination"
                  aria-label="Invoice pages"
                >
                  <PaginationContent>
                    <PaginationItem>
                      <Button
                        className="button button-secondary"
                        variant="secondary"
                        type="button"
                        disabled={currentPage === 1}
                        onClick={() => changePage(currentPage - 1)}
                      >
                        Previous
                      </Button>
                    </PaginationItem>
                    <PaginationItem>
                      <span>
                        Page {currentPage} of {pageCount}
                      </span>
                    </PaginationItem>
                    <PaginationItem>
                      <Button
                        className="button button-secondary"
                        variant="secondary"
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
                className="settings-card invoice-detail"
                aria-busy={loadingDetail}
              >
                {selectedInvoice ? (
                  <>
                    <div className="section-row">
                      <div>
                        <Badge
                          className={`app-kicker invoice-status ${selectedInvoice.status}`}
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
                        <h2>Invoice {selectedInvoice.invoiceNumber}</h2>
                      </div>
                      <strong>
                        {money(selectedInvoice.totalMinor, currency)}
                      </strong>
                    </div>
                    <p className="settings-note">
                      {selectedInvoice.customerName} · Issued{" "}
                      {selectedInvoice.issueDate} · Due{" "}
                      {selectedInvoice.dueDate}
                    </p>
                    <div className="invoice-detail-items">
                      {selectedInvoice.items.map((item, index) => (
                        <div
                          className="settings-fact"
                          key={item.id || `${item.description}-${index}`}
                        >
                          <span>
                            {item.description} · {item.quantityMilli / 1000} ×{" "}
                            {money(item.unitPriceMinor, currency)}
                          </span>
                          <strong>{money(item.amountMinor, currency)}</strong>
                        </div>
                      ))}
                    </div>
                    <div className="invoice-editor-total">
                      <span>Total</span>
                      <strong>
                        {money(selectedInvoice.totalMinor, currency)}
                      </strong>
                    </div>
                    <div className="invoice-form-actions">
                      {selectedInvoice.status === "draft" ? (
                        <>
                          <Button
                            className="button button-secondary"
                            variant="secondary"
                            type="button"
                            disabled={action !== null}
                            onClick={() => editInvoice(selectedInvoice)}
                          >
                            Edit draft
                          </Button>
                          <Button
                            className="button button-primary"
                            type="button"
                            disabled={action !== null}
                            onClick={() =>
                              runDetailAction("send", selectedInvoice.id)
                            }
                          >
                            {action === "send" ? "Sending..." : "Send invoice"}
                          </Button>
                          <Button
                            className="button button-secondary"
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
                            className="button button-secondary"
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
                            className="button button-primary"
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
                        <Badge className="invoice-paid-note" variant="success">
                          Paid {selectedInvoice.paidDate || ""}
                        </Badge>
                      ) : null}
                    </div>
                  </>
                ) : loadingDetail ? (
                  <p className="transaction-empty">Loading invoice...</p>
                ) : null}
                <p
                  className={`transaction-message${detailError ? " error" : ""}`}
                  role="status"
                  aria-live="polite"
                >
                  {detailMessage}
                </p>
              </Card>
            ) : null}
          </div>

          <form
            className="settings-card invoice-form invoice-editor-compact"
            ref={formRef}
            onSubmit={saveInvoice}
          >
            <div className="section-row">
              <div>
                <p className="app-kicker">Invoice editor</p>
                <h2>
                  {editingId ? `Edit ${form.invoiceNumber}` : "New invoice"}
                </h2>
              </div>
              <Badge variant="outline">Draft</Badge>
            </div>
            <div className="transaction-fields">
              <div className="transaction-field">
                <Label className="mb-[0.45rem] block text-[0.58rem]" htmlFor="invoice-customer">Customer</Label>
                <Select
                  value={form.customerId}
                  onValueChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      customerId: value,
                    }))
                  }
                  required
                  disabled={saving}
                >
                  <SelectTrigger id="invoice-customer" ref={customerRef}>
                    <SelectValue
                      placeholder={
                        parties.length
                          ? "Choose a customer"
                          : "Register a customer first"
                      }
                    />
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
              <Label className="transaction-field">
                <span>Invoice number</span>
                <Input
                  value={form.invoiceNumber}
                  readOnly
                  spellCheck={false}
                  placeholder="Assigned automatically..."
                />
                <small>Assigned when the draft is first saved.</small>
              </Label>
            </div>
            <div className="transaction-fields">
              <Label className="transaction-field">
                <span>Issue date</span>
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
              <Label className="transaction-field">
                <span>Due date</span>
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
            <div className="invoice-items-heading">
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
                <div className="invoice-item-row" key={item.key}>
                  <Label className="transaction-field">
                    <span>Description</span>
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
                  <Label className="transaction-field">
                    <span>Quantity</span>
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
                  <Label className="transaction-field">
                    <span>Unit price</span>
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
                  <strong className="invoice-item-total">
                    {money(itemTotal(item), currency)}
                  </strong>
                  <Button
                    className="transaction-delete"
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
            <div className="transaction-fields">
              <Label className="transaction-field">
                <span>Tax rate (%)</span>
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
              <Label className="transaction-field">
                <span>Notes</span>
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
            <div className="invoice-editor-total">
              <span>Total</span>
              <strong>{money(total, currency)}</strong>
            </div>
            <div className="invoice-form-actions">
              <Button
                className="button button-primary"
                type="submit"
                disabled={saving || loading}
              >
                {saving
                  ? "Saving..."
                  : editingId
                    ? "Save changes"
                    : "Save draft"}
              </Button>
              <Button
                className="button button-secondary"
                variant="secondary"
                type="button"
                disabled={saving}
                onClick={resetForm}
              >
                {editingId ? "Cancel" : "Clear"}
              </Button>
            </div>
            <p
              className={`transaction-message${messageError ? " error" : ""}`}
              role="status"
              aria-live="polite"
            >
              {message}
            </p>
          </form>
        </section>

        <Dialog
          open={dialog?.type === "paid"}
          onOpenChange={(open) => {
            if (!open && action === null) setDialog(null);
          }}
        >
          <DialogContent
            onOpenAutoFocus={(event) => {
              event.preventDefault();
              document.getElementById("invoice-paid-date")?.focus();
            }}
          >
            <DialogHeader>
              <DialogTitle>Record payment</DialogTitle>
              <DialogDescription>
                Choose the date the payment was received. This will mark the
                invoice as paid.
              </DialogDescription>
            </DialogHeader>
            <Label className="transaction-field" htmlFor="invoice-paid-date">
              <span>Payment date</span>
              <Input
                id="invoice-paid-date"
                type="date"
                value={paidDate}
                onChange={(event) => setPaidDate(event.target.value)}
                required
              />
            </Label>
            <DialogFooter className="invoice-form-actions">
              <DialogClose asChild>
                <Button
                  className="button button-secondary"
                  variant="secondary"
                  type="button"
                  disabled={action !== null}
                >
                  Cancel
                </Button>
              </DialogClose>
              <Button
                className="button button-primary"
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
          <AlertDialogContent
            onOpenAutoFocus={(event) => {
              event.preventDefault();
              document.getElementById("invoice-delete-cancel")?.focus();
            }}
          >
            <AlertDialogHeader>
              <AlertDialogTitle>Delete draft invoice?</AlertDialogTitle>
              <AlertDialogDescription>
                This draft will be permanently deleted. This action cannot be
                undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="invoice-form-actions">
              <AlertDialogCancel asChild>
                <Button
                  id="invoice-delete-cancel"
                  className="button button-secondary"
                  variant="secondary"
                  type="button"
                  disabled={action !== null}
                >
                  Cancel
                </Button>
              </AlertDialogCancel>
              <AlertDialogAction asChild>
                <Button
                  className="button danger-button"
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
                </Button>
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </main>
    </AppShell>
  );
}

export default InvoicesPage;
