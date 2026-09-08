const form = document.querySelector("#invoice-form");
const list = document.querySelector("#invoice-list");
const detail = document.querySelector("#invoice-detail");
const message = document.querySelector("#invoice-message");
const items = document.querySelector("#invoice-items");
let invoices = [];
let parties = [];
let currency = "USD";
let editingId = null;
let filter = "all";

function money(amountMinor) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(amountMinor / 100);
}

function amountMinor(value) {
  return /^\d+(?:\.\d{1,2})?$/.test(value.trim()) ? Math.round(Number(value) * 100) : null;
}

function addDays(date, days) {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function addItem(item = {}) {
  const row = document.createElement("div");
  row.className = "invoice-item-row";
  row.innerHTML = `<label class="transaction-field"><span>Description</span><input name="description" maxlength="200" required></label><label class="transaction-field"><span>Quantity</span><input name="quantity" inputmode="decimal" value="1" required></label><label class="transaction-field"><span>Unit price</span><input name="unitPrice" inputmode="decimal" value="0.00" required></label><strong class="invoice-item-total">${money(0)}</strong><button class="transaction-delete" type="button" aria-label="Remove line item">×</button>`;
  row.querySelector('[name="description"]').value = item.description || "";
  row.querySelector('[name="quantity"]').value = item.quantityMilli ? String(item.quantityMilli / 1000) : "1";
  row.querySelector('[name="unitPrice"]').value = item.unitPriceMinor !== undefined ? (item.unitPriceMinor / 100).toFixed(2) : "0.00";
  row.querySelector("button").addEventListener("click", () => { if (items.children.length > 1) { row.remove(); calculateTotal(); } });
  row.addEventListener("input", calculateTotal);
  items.append(row);
  calculateTotal();
}

function calculateTotal() {
  let subtotal = 0;
  for (const row of items.children) {
    const quantity = Math.round((Number(row.querySelector('[name="quantity"]').value) || 0) * 1000) / 1000;
    const price = amountMinor(row.querySelector('[name="unitPrice"]').value) || 0;
    const total = Math.round(quantity * price);
    subtotal += total;
    row.querySelector(".invoice-item-total").textContent = money(total);
  }
  const taxRate = Number(form.elements.taxRate.value) || 0;
  document.querySelector("#invoice-total").textContent = money(subtotal + Math.round(subtotal * taxRate / 100));
}

function resetForm() {
  editingId = null;
  form.reset();
  const today = new Date().toISOString().slice(0, 10);
  form.elements.issueDate.value = today;
  form.elements.dueDate.value = addDays(today, 14);
  form.elements.taxRate.value = "0";
  items.replaceChildren();
  addItem();
  document.querySelector("#invoice-form-title").textContent = "New invoice";
  document.querySelector("#invoice-form-status").textContent = "Draft";
  form.querySelector('button[type="submit"]').textContent = "Save draft";
}

function renderList() {
  const visible = invoices.filter((invoice) => filter === "all" || invoice.status === filter);
  document.querySelector("#invoice-count").textContent = `${invoices.length} ${invoices.length === 1 ? "invoice" : "invoices"}`;
  list.replaceChildren();
  if (!visible.length) {
    const empty = document.createElement("p");
    empty.className = "transaction-empty";
    empty.textContent = "No invoices in this view.";
    list.append(empty);
    return;
  }
  for (const invoice of visible) {
    const button = document.createElement("button");
    button.className = "invoice-list-row";
    button.type = "button";
    button.dataset.invoiceId = invoice.id;
    button.innerHTML = `<span><strong></strong><small></small></span><span class="invoice-status ${invoice.status}"></span><b></b>`;
    button.querySelector("strong").textContent = invoice.invoiceNumber;
    button.querySelector("small").textContent = `${invoice.customerName} · Due ${invoice.dueDate}`;
    button.querySelector(".invoice-status").textContent = invoice.status;
    button.querySelector("b").textContent = money(invoice.totalMinor);
    list.append(button);
  }
}

async function load() {
  const [invoiceResponse, partyResponse, financialResponse] = await Promise.all([fetch("/api/invoices"), fetch("/api/parties"), fetch("/api/financials")]);
  if (!invoiceResponse.ok || !partyResponse.ok || !financialResponse.ok) throw new Error("Unable to load invoices.");
  const [invoiceData, partyData, financialData] = await Promise.all([invoiceResponse.json(), partyResponse.json(), financialResponse.json()]);
  invoices = invoiceData.invoices;
  parties = partyData.parties.filter((party) => party.role === "customer" || party.role === "both");
  currency = financialData.currency || "USD";
  form.elements.customerId.replaceChildren(new Option(parties.length ? "Choose a customer" : "Register a customer first", ""), ...parties.map((party) => new Option(party.name, party.id)));
  renderList();
  calculateTotal();
}

function invoicePayload() {
  const invoiceItems = [...items.children].map((row) => ({
    description: row.querySelector('[name="description"]').value,
    quantity: Number(row.querySelector('[name="quantity"]').value),
    unitPriceMinor: amountMinor(row.querySelector('[name="unitPrice"]').value),
  }));
  const tax = form.elements.taxRate.value.trim();
  return { customerId: form.elements.customerId.value, invoiceNumber: form.elements.invoiceNumber.value, issueDate: form.elements.issueDate.value, dueDate: form.elements.dueDate.value, taxRateBasisPoints: /^\d+(?:\.\d{1,2})?$/.test(tax) ? Math.round(Number(tax) * 100) : null, notes: form.elements.notes.value, items: invoiceItems };
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  message.className = "transaction-message";
  const response = await fetch(editingId ? `/api/invoices/${editingId}` : "/api/invoices", { method: editingId ? "PATCH" : "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(invoicePayload()) });
  const result = await response.json();
  message.className = `transaction-message${response.ok ? "" : " error"}`;
  message.textContent = response.ok ? "Invoice draft saved." : result.error;
  if (response.ok) { resetForm(); await load(); await showInvoice(result.id); }
});

async function showInvoice(id) {
  const response = await fetch(`/api/invoices/${id}`);
  const result = await response.json();
  if (!response.ok) return;
  const invoice = result.invoice;
  detail.hidden = false;
  detail.innerHTML = `<div class="section-row"><div><p class="app-kicker">${invoice.status}</p><h2>Invoice ${invoice.invoiceNumber}</h2></div><strong>${money(invoice.totalMinor)}</strong></div><p class="settings-note">${invoice.customerName} · Issued ${invoice.issueDate} · Due ${invoice.dueDate}</p><div class="invoice-detail-items"></div><div class="invoice-editor-total"><span>Total</span><strong>${money(invoice.totalMinor)}</strong></div><div class="invoice-form-actions"></div><p class="transaction-message" role="status"></p>`;
  const itemList = detail.querySelector(".invoice-detail-items");
  for (const item of invoice.items) {
    const row = document.createElement("div");
    row.className = "settings-fact";
    row.innerHTML = `<span></span><strong></strong>`;
    row.querySelector("span").textContent = `${item.description} · ${item.quantityMilli / 1000} × ${money(item.unitPriceMinor)}`;
    row.querySelector("strong").textContent = money(item.amountMinor);
    itemList.append(row);
  }
  const actions = detail.querySelector(".invoice-form-actions");
  if (invoice.status === "draft") {
    actions.append(actionButton("Edit draft", () => editInvoice(invoice), true), actionButton("Send invoice", () => sendInvoice(id)), actionButton("Delete", () => removeInvoice(id), true));
  } else if (invoice.status !== "paid" && invoice.status !== "void") {
    actions.append(actionButton("Send again", () => sendInvoice(id), true), actionButton("Mark paid", () => payInvoice(id)));
  } else if (invoice.status === "paid") {
    const note = document.createElement("span"); note.className = "invoice-paid-note"; note.textContent = `Paid ${invoice.paidDate || ""}`; actions.append(note);
  }
}

function actionButton(label, handler, secondary = false) {
  const button = document.createElement("button"); button.type = "button"; button.className = `button ${secondary ? "button-secondary" : "button-primary"}`; button.textContent = label; button.addEventListener("click", handler); return button;
}

function editInvoice(invoice) {
  editingId = invoice.id;
  form.elements.customerId.value = invoice.customerId;
  form.elements.invoiceNumber.value = invoice.invoiceNumber;
  form.elements.issueDate.value = invoice.issueDate;
  form.elements.dueDate.value = invoice.dueDate;
  form.elements.taxRate.value = invoice.taxRateBasisPoints / 100;
  form.elements.notes.value = invoice.notes || "";
  items.replaceChildren();
  invoice.items.forEach(addItem);
  document.querySelector("#invoice-form-title").textContent = `Edit ${invoice.invoiceNumber}`;
  form.querySelector('button[type="submit"]').textContent = "Save changes";
  form.scrollIntoView({ behavior: "smooth" });
}

async function sendInvoice(id) {
  const response = await fetch(`/api/invoices/${id}/send`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
  const result = await response.json();
  detail.querySelector('[role="status"]').textContent = response.ok ? "Invoice emailed to the customer." : result.error;
  if (response.ok) { await load(); await showInvoice(id); }
}

async function payInvoice(id) {
  const paidDate = window.prompt("Payment date (YYYY-MM-DD)", new Date().toISOString().slice(0, 10));
  if (!paidDate) return;
  const response = await fetch(`/api/invoices/${id}/paid`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ paidDate }) });
  const result = await response.json();
  if (!response.ok) { detail.querySelector('[role="status"]').textContent = result.error; return; }
  await load(); await showInvoice(id);
}

async function removeInvoice(id) {
  if (!window.confirm("Delete this draft invoice?")) return;
  const response = await fetch(`/api/invoices/${id}`, { method: "DELETE" });
  if (response.ok) { detail.hidden = true; await load(); }
}

list.addEventListener("click", (event) => { const button = event.target.closest("button[data-invoice-id]"); if (button) showInvoice(button.dataset.invoiceId); });
document.querySelector("#add-invoice-item").addEventListener("click", () => addItem());
document.querySelector("#cancel-invoice").addEventListener("click", resetForm);
document.querySelector("#new-invoice").addEventListener("click", () => { resetForm(); form.scrollIntoView({ behavior: "smooth" }); });
document.querySelectorAll("[data-filter]").forEach((button) => button.addEventListener("click", () => { document.querySelectorAll("[data-filter]").forEach((item) => item.classList.remove("active")); button.classList.add("active"); filter = button.dataset.filter; renderList(); }));
form.elements.taxRate.addEventListener("input", calculateTotal);
resetForm();
load().catch((error) => { message.className = "transaction-message error"; message.textContent = error.message; });
