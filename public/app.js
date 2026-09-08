const page = document.body;
const form = document.querySelector("#transaction-form");

if (form && page.dataset.preview === "true") {
  form.querySelectorAll("input, select, button").forEach((control) => {
    control.disabled = true;
  });
  document.querySelector("#transaction-message").textContent = "Create a workspace to record transactions.";
}

if (form && page.dataset.preview !== "true") {
  const message = document.querySelector("#transaction-message");
  const list = document.querySelector("#transaction-list");
  const count = document.querySelector("#transaction-count");
  const submit = form.querySelector('button[type="submit"]');
  const dateInput = form.elements.date;
  let entries = [];

  dateInput.value = new Date().toISOString().slice(0, 10);

  function money(amountMinor, currency) {
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(amountMinor / 100);
  }

  function transactionLabel(entry) {
    if (entry.direction === "inflow") return [entry.clientName, entry.invoiceReference].filter(Boolean).join(" · ") || "Payment received";
    return entry.category ? entry.category.replaceAll("_", " ") : "Expense paid";
  }

  function render(currency) {
    const transactions = entries.filter((entry) => entry.status === "paid").sort((a, b) => b.scheduledDate.localeCompare(a.scheduledDate));
    count.textContent = `${transactions.length} ${transactions.length === 1 ? "entry" : "entries"}`;
    list.replaceChildren();

    if (!transactions.length) {
      const empty = document.createElement("p");
      empty.className = "transaction-empty";
      empty.textContent = "No payments or expenses recorded yet.";
      list.append(empty);
      return;
    }

    for (const entry of transactions) {
      const row = document.createElement("div");
      row.className = `transaction-row ${entry.direction}`;
      const details = document.createElement("div");
      const name = document.createElement("strong");
      const meta = document.createElement("small");
      const amount = document.createElement("b");
      const remove = document.createElement("button");

      name.textContent = entry.name;
      meta.textContent = `${entry.scheduledDate} · ${transactionLabel(entry)}`;
      amount.textContent = `${entry.direction === "inflow" ? "+" : "−"}${money(entry.actualAmountMinor, currency)}`;
      remove.className = "transaction-delete";
      remove.type = "button";
      remove.dataset.id = entry.id;
      remove.setAttribute("aria-label", `Delete ${entry.name}`);
      remove.textContent = "×";
      details.append(name, meta);
      row.append(details, amount, remove);
      list.append(row);
    }
  }

  async function load() {
    const response = await fetch("/api/financials", { headers: { accept: "application/json" } });
    if (!response.ok) throw new Error("Unable to load transaction history.");
    const data = await response.json();
    entries = data.entries;
    form.dataset.currency = data.currency || "USD";
    render(form.dataset.currency);
  }

  function setDirection() {
    const inflow = form.elements.direction.value === "inflow";
    form.querySelectorAll("[data-inflow-field]").forEach((field) => { field.hidden = !inflow; });
    form.querySelectorAll("[data-outflow-field]").forEach((field) => { field.hidden = inflow; });
    submit.textContent = inflow ? "Record payment" : "Record expense";
  }

  form.addEventListener("change", (event) => {
    if (event.target.name === "direction") setDirection();
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    message.className = "transaction-message";
    message.textContent = "";
    const amount = form.elements.amount.value.trim();
    if (!/^\d+(?:\.\d{1,2})?$/.test(amount) || Number(amount) <= 0) {
      message.classList.add("error");
      message.textContent = "Enter a valid positive amount with up to two decimal places.";
      return;
    }

    const direction = form.elements.direction.value;
    const amountMinor = Math.round(Number(amount) * 100);
    const payload = {
      direction,
      name: form.elements.name.value,
      amountMinor,
      actualAmountMinor: amountMinor,
      scheduledDate: form.elements.date.value,
      status: "paid",
      clientName: direction === "inflow" ? form.elements.clientName.value : undefined,
      invoiceReference: direction === "inflow" ? form.elements.invoiceReference.value : undefined,
      category: direction === "outflow" ? form.elements.category.value : undefined,
    };

    submit.disabled = true;
    try {
      const response = await fetch("/api/cash-entries", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to record transaction.");
      form.reset();
      dateInput.value = new Date().toISOString().slice(0, 10);
      setDirection();
      await load();
      message.textContent = direction === "inflow" ? "Payment recorded." : "Expense recorded.";
    } catch (error) {
      message.classList.add("error");
      message.textContent = error instanceof Error ? error.message : "Unable to record transaction.";
    } finally {
      submit.disabled = false;
    }
  });

  list.addEventListener("click", async (event) => {
    const button = event.target.closest("button[data-id]");
    if (!button || !window.confirm("Delete this transaction?")) return;
    button.disabled = true;
    try {
      const response = await fetch(`/api/cash-entries/${button.dataset.id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Unable to delete transaction.");
      await load();
      message.className = "transaction-message";
      message.textContent = "Transaction deleted.";
    } catch (error) {
      button.disabled = false;
      message.className = "transaction-message error";
      message.textContent = error instanceof Error ? error.message : "Unable to delete transaction.";
    }
  });

  load().catch((error) => {
    message.className = "transaction-message error";
    message.textContent = error instanceof Error ? error.message : "Unable to load transaction history.";
  });
}
