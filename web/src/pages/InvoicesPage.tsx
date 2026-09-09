import { FormEvent, useEffect, useRef, useState } from "react";

import { api } from "../api";
import { AppShell } from "../components/AppShell";
import { addDays, amountMinor, money, todayIso } from "../utils";

type Filter = "all" | "draft" | "sent" | "overdue" | "paid";
type InvoiceSummary = { id: string; invoiceNumber: string; issueDate: string; dueDate: string; status: string; totalMinor: number; customerName: string };
type InvoiceItem = { id?: string; description: string; quantityMilli: number; unitPriceMinor: number; amountMinor: number };
type Invoice = InvoiceSummary & { customerId: string; taxRateBasisPoints: number; notes: string | null; paidDate: string | null; items: InvoiceItem[] };
type Party = { id: string; name: string; role: string };
type ItemForm = { key: string; description: string; quantity: string; unitPrice: string };
type InvoiceForm = { customerId: string; invoiceNumber: string; issueDate: string; dueDate: string; taxRate: string; notes: string; items: ItemForm[] };
type Dialog = { type: "paid" | "delete"; invoiceId: string } | null;

const FILTERS: Filter[] = ["all", "draft", "sent", "overdue", "paid"];
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
  return { customerId: "", invoiceNumber: "", issueDate: today, dueDate: addDays(today, 14), taxRate: "0", notes: "", items: [newItem()] };
}

function initialQuery() {
  const params = new URLSearchParams(window.location.search);
  const value = params.get("filter");
  return {
    filter: FILTERS.includes(value as Filter) ? value as Filter : "all" as Filter,
    invoiceId: params.get("invoice"),
  };
}

function setQueryState(key: string, value: string | null, defaultValue?: string) {
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
  const customerRef = useRef<HTMLSelectElement>(null);
  const [invoices, setInvoices] = useState<InvoiceSummary[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [currency, setCurrency] = useState("USD");
  const [filter, setFilter] = useState<Filter>(query.current.filter);
  const [selectedId, setSelectedId] = useState<string | null>(query.current.invoiceId);
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
  const [dialog, setDialog] = useState<Dialog>(null);
  const [paidDate, setPaidDate] = useState(todayIso());

  async function refresh() {
    const [invoiceData, partyData, financialData] = await Promise.all([
      api<{ invoices: InvoiceSummary[] }>("/api/invoices"),
      api<{ parties: Party[] }>("/api/parties"),
      api<{ currency?: string }>("/api/financials"),
    ]);
    setInvoices(invoiceData.invoices);
    setParties(partyData.parties.filter((party) => party.role === "customer" || party.role === "both"));
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
        setParties(partyData.parties.filter((party) => party.role === "customer" || party.role === "both"));
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
  }

  function resetForm() {
    setEditingId(null);
    setForm(emptyForm());
    setMessage("");
    setMessageError(false);
  }

  function scrollToForm() {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    formRef.current?.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "center" });
    window.setTimeout(() => customerRef.current?.focus(), reducedMotion ? 0 : 300);
  }

  function updateItem(key: string, field: "description" | "quantity" | "unitPrice", value: string) {
    setForm((current) => ({ ...current, items: current.items.map((item) => item.key === key ? { ...item, [field]: value } : item) }));
  }

  function itemTotal(item: ItemForm) {
    const quantity = Math.round((Number(item.quantity) || 0) * 1000) / 1000;
    return Math.round(quantity * (amountMinor(item.unitPrice) || 0));
  }

  const subtotal = form.items.reduce((sum, item) => sum + itemTotal(item), 0);
  const total = subtotal + Math.round(subtotal * (Number(form.taxRate) || 0) / 100);

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
      taxRateBasisPoints: /^\d+(?:\.\d{1,2})?$/.test(tax) ? Math.round(Number(tax) * 100) : null,
      notes: form.notes,
      items: form.items.map((item) => ({ description: item.description, quantity: Number(item.quantity), unitPriceMinor: amountMinor(item.unitPrice) })),
    };
    try {
      const result = await api<{ id: string }>(editingId ? `/api/invoices/${editingId}` : "/api/invoices", {
        method: editingId ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      setMessage("Invoice draft saved.");
      setEditingId(null);
      setForm(emptyForm());
      await refresh();
      selectInvoice(result.id);
      const detail = await api<{ invoice: Invoice }>(`/api/invoices/${result.id}`);
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
        await api(`/api/invoices/${id}/send`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
        setDetailMessage("Invoice emailed to the customer.");
      } else if (kind === "paid") {
        await api(`/api/invoices/${id}/paid`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ paidDate }) });
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

  const visibleInvoices = invoices.filter((invoice) => filter === "all" || invoice.status === filter);

  return (
    <AppShell activePage="invoices">
      <main className="app-main settings-main" id="invoice-main">
        <header className="workspace-header"><div><p className="app-kicker">Get paid</p><h1>Invoices</h1></div><button className="button button-primary" type="button" onClick={() => { resetForm(); scrollToForm(); }}>New invoice</button></header>
        <section className="invoice-workspace" aria-busy={loading}>
          <aside className="settings-card invoice-list-card">
            <div className="section-row"><div><p className="app-kicker">Documents</p><h2>All Invoices</h2></div><span>{invoices.length} {invoices.length === 1 ? "invoice" : "invoices"}</span></div>
            <div className="invoice-filters" aria-label="Filter invoices">{FILTERS.map((value) => <button key={value} className={filter === value ? "active" : ""} type="button" aria-pressed={filter === value} onClick={() => selectFilter(value)}>{value[0].toUpperCase() + value.slice(1)}</button>)}</div>
            <div>{visibleInvoices.length ? visibleInvoices.map((invoice) => <button key={invoice.id} className="invoice-list-row" type="button" aria-current={selectedId === invoice.id} onClick={() => selectInvoice(invoice.id)}><span><strong>{invoice.invoiceNumber}</strong><small>{invoice.customerName} · Due {invoice.dueDate}</small></span><span className={`invoice-status ${invoice.status}`}>{invoice.status}</span><b>{money(invoice.totalMinor, currency)}</b></button>) : <p className="transaction-empty">No invoices in this view.</p>}</div>
          </aside>

          <form className="settings-card invoice-form" ref={formRef} onSubmit={saveInvoice}>
            <div className="section-row"><div><p className="app-kicker">Invoice editor</p><h2>{editingId ? `Edit ${form.invoiceNumber}` : "New invoice"}</h2></div><span>Draft</span></div>
            <div className="transaction-fields">
              <label className="transaction-field"><span>Customer</span><select ref={customerRef} value={form.customerId} onChange={(event) => setForm((current) => ({ ...current, customerId: event.target.value }))} required disabled={saving}><option value="">{parties.length ? "Choose a customer" : "Register a customer first"}</option>{parties.map((party) => <option key={party.id} value={party.id}>{party.name}</option>)}</select></label>
              <label className="transaction-field"><span>Invoice number</span><input value={form.invoiceNumber} readOnly spellCheck={false} placeholder="Assigned automatically..." /><small>Assigned when the draft is first saved.</small></label>
            </div>
            <div className="transaction-fields"><label className="transaction-field"><span>Issue date</span><input value={form.issueDate} onChange={(event) => setForm((current) => ({ ...current, issueDate: event.target.value }))} type="date" required disabled={saving} /></label><label className="transaction-field"><span>Due date</span><input value={form.dueDate} onChange={(event) => setForm((current) => ({ ...current, dueDate: event.target.value }))} type="date" required disabled={saving} /></label></div>
            <div className="invoice-items-heading"><span>Line items</span><button type="button" disabled={saving || form.items.length >= 100} onClick={() => setForm((current) => ({ ...current, items: [...current.items, newItem()] }))}>+ Add item</button></div>
            <div>{form.items.map((item) => <div className="invoice-item-row" key={item.key}><label className="transaction-field"><span>Description</span><input value={item.description} onChange={(event) => updateItem(item.key, "description", event.target.value)} maxLength={200} required disabled={saving} /></label><label className="transaction-field"><span>Quantity</span><input value={item.quantity} onChange={(event) => updateItem(item.key, "quantity", event.target.value)} inputMode="decimal" required disabled={saving} /></label><label className="transaction-field"><span>Unit price</span><input value={item.unitPrice} onChange={(event) => updateItem(item.key, "unitPrice", event.target.value)} inputMode="decimal" required disabled={saving} /></label><strong className="invoice-item-total">{money(itemTotal(item), currency)}</strong><button className="transaction-delete" type="button" aria-label="Remove line item" disabled={saving || form.items.length === 1} onClick={() => setForm((current) => ({ ...current, items: current.items.filter((candidate) => candidate.key !== item.key) }))}>×</button></div>)}</div>
            <div className="transaction-fields"><label className="transaction-field"><span>Tax rate (%)</span><input value={form.taxRate} onChange={(event) => setForm((current) => ({ ...current, taxRate: event.target.value }))} inputMode="decimal" required disabled={saving} /></label><label className="transaction-field"><span>Notes</span><textarea value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} maxLength={1000} rows={3} autoComplete="off" placeholder="Payment details or a thank-you note..." disabled={saving} /></label></div>
            <div className="invoice-editor-total"><span>Total</span><strong>{money(total, currency)}</strong></div>
            <div className="invoice-form-actions"><button className="button button-primary" type="submit" disabled={saving || loading}>{saving ? "Saving..." : editingId ? "Save changes" : "Save draft"}</button><button className="button button-secondary" type="button" disabled={saving} onClick={resetForm}>{editingId ? "Cancel" : "Clear"}</button></div>
            <p className={`transaction-message${messageError ? " error" : ""}`} role="status" aria-live="polite">{message}</p>
          </form>

          {selectedId ? <section className="settings-card invoice-detail" aria-busy={loadingDetail}>
            {selectedInvoice ? <><div className="section-row"><div><p className="app-kicker">{selectedInvoice.status}</p><h2>Invoice {selectedInvoice.invoiceNumber}</h2></div><strong>{money(selectedInvoice.totalMinor, currency)}</strong></div><p className="settings-note">{selectedInvoice.customerName} · Issued {selectedInvoice.issueDate} · Due {selectedInvoice.dueDate}</p><div className="invoice-detail-items">{selectedInvoice.items.map((item, index) => <div className="settings-fact" key={item.id || `${item.description}-${index}`}><span>{item.description} · {item.quantityMilli / 1000} × {money(item.unitPriceMinor, currency)}</span><strong>{money(item.amountMinor, currency)}</strong></div>)}</div><div className="invoice-editor-total"><span>Total</span><strong>{money(selectedInvoice.totalMinor, currency)}</strong></div><div className="invoice-form-actions">{selectedInvoice.status === "draft" ? <><button className="button button-secondary" type="button" disabled={action !== null} onClick={() => editInvoice(selectedInvoice)}>Edit draft</button><button className="button button-primary" type="button" disabled={action !== null} onClick={() => runDetailAction("send", selectedInvoice.id)}>{action === "send" ? "Sending..." : "Send invoice"}</button><button className="button button-secondary" type="button" disabled={action !== null} onClick={() => setDialog({ type: "delete", invoiceId: selectedInvoice.id })}>Delete</button></> : selectedInvoice.status !== "paid" && selectedInvoice.status !== "void" ? <><button className="button button-secondary" type="button" disabled={action !== null} onClick={() => runDetailAction("send", selectedInvoice.id)}>{action === "send" ? "Sending..." : "Send again"}</button><button className="button button-primary" type="button" disabled={action !== null} onClick={() => { setPaidDate(todayIso()); setDialog({ type: "paid", invoiceId: selectedInvoice.id }); }}>Mark paid</button></> : selectedInvoice.status === "paid" ? <span className="invoice-paid-note">Paid {selectedInvoice.paidDate || ""}</span> : null}</div></> : loadingDetail ? <p className="transaction-empty">Loading invoice...</p> : null}
            {dialog ? <div className="settings-card" role="dialog" aria-modal="true" aria-labelledby="invoice-dialog-title"><h3 id="invoice-dialog-title">{dialog.type === "paid" ? "Record payment" : "Delete draft invoice?"}</h3>{dialog.type === "paid" ? <label className="transaction-field"><span>Payment date</span><input type="date" value={paidDate} onChange={(event) => setPaidDate(event.target.value)} required /></label> : <p>This draft will be permanently deleted.</p>}<div className="invoice-form-actions"><button className={dialog.type === "delete" ? "button danger-button" : "button button-primary"} type="button" disabled={action !== null || (dialog.type === "paid" && !paidDate)} onClick={() => runDetailAction(dialog.type, dialog.invoiceId)}>{action ? "Working..." : dialog.type === "paid" ? "Mark paid" : "Delete invoice"}</button><button className="button button-secondary" type="button" disabled={action !== null} onClick={() => setDialog(null)}>Cancel</button></div></div> : null}
            <p className={`transaction-message${detailError ? " error" : ""}`} role="status" aria-live="polite">{detailMessage}</p>
          </section> : null}
        </section>
      </main>
    </AppShell>
  );
}

export default InvoicesPage;
