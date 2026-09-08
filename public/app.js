const page = document.body;
const form = document.querySelector("#transaction-form");
const partyForm = document.querySelector("#party-form");

if (form && page.dataset.preview === "true") {
  form.querySelectorAll("input, select, button").forEach((control) => {
    control.disabled = true;
  });
  document.querySelector("#transaction-message").textContent = "Create a workspace to record transactions.";
  partyForm.querySelectorAll("input, select, button").forEach((control) => {
    control.disabled = true;
  });
  document.querySelector("#party-message").textContent = "Create a workspace to register parties.";
}

if (form && page.dataset.preview !== "true") {
  const message = document.querySelector("#transaction-message");
  const list = document.querySelector("#transaction-list");
  const count = document.querySelector("#transaction-count");
  const submit = form.querySelector('button[type="submit"]');
  const dateInput = form.elements.date;
  let entries = [];
  let parties = [];

  dateInput.value = new Date().toISOString().slice(0, 10);

  function money(amountMinor, currency) {
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(amountMinor / 100);
  }

  function transactionLabel(entry) {
    const detail = entry.direction === "inflow" ? entry.invoiceReference : entry.category?.replaceAll("_", " ");
    return [entry.partyName || entry.clientName, detail].filter(Boolean).join(" · ") || (entry.direction === "inflow" ? "Payment received" : "Expense paid");
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
    const [financialsResponse, partiesResponse] = await Promise.all([
      fetch("/api/financials", { headers: { accept: "application/json" } }),
      fetch("/api/parties", { headers: { accept: "application/json" } }),
    ]);
    if (!financialsResponse.ok || !partiesResponse.ok) throw new Error("Unable to load workspace data.");
    const [financials, directory] = await Promise.all([financialsResponse.json(), partiesResponse.json()]);
    entries = financials.entries;
    parties = directory.parties;
    form.dataset.currency = financials.currency || "USD";
    render(form.dataset.currency);
    renderParties();
    renderPartyOptions();
  }

  function roleLabel(role) {
    return role === "both" ? "Customer & supplier" : role[0].toUpperCase() + role.slice(1);
  }

  function renderParties() {
    const partyList = document.querySelector("#party-list");
    const partyCount = document.querySelector("#party-count");
    partyCount.textContent = `${parties.length} ${parties.length === 1 ? "party" : "parties"}`;
    partyList.replaceChildren();
    if (!parties.length) {
      const empty = document.createElement("p");
      empty.className = "transaction-empty";
      empty.textContent = "No customers or suppliers registered yet.";
      partyList.append(empty);
      return;
    }
    for (const party of parties) {
      const row = document.createElement("div");
      row.className = "party-row";
      const details = document.createElement("div");
      const name = document.createElement("strong");
      const contact = document.createElement("small");
      const role = document.createElement("span");
      const remove = document.createElement("button");
      name.textContent = party.name;
      contact.textContent = [party.email, party.phone].filter(Boolean).join(" · ") || "No contact details";
      role.className = "party-role";
      role.textContent = roleLabel(party.role);
      remove.className = "transaction-delete";
      remove.type = "button";
      remove.dataset.partyId = party.id;
      remove.setAttribute("aria-label", `Delete ${party.name}`);
      remove.textContent = "×";
      details.append(name, contact);
      row.append(details, role, remove);
      partyList.append(row);
    }
  }

  function renderPartyOptions() {
    const select = form.elements.partyId;
    const requiredRole = form.elements.direction.value === "inflow" ? "customer" : "supplier";
    const selected = select.value;
    select.replaceChildren(new Option(`No registered ${requiredRole}`, ""));
    for (const party of parties.filter((item) => item.role === requiredRole || item.role === "both")) {
      select.add(new Option(party.name, party.id));
    }
    select.value = selected;
  }

  function setDirection() {
    const inflow = form.elements.direction.value === "inflow";
    form.querySelectorAll("[data-inflow-field]").forEach((field) => { field.hidden = !inflow; });
    form.querySelectorAll("[data-outflow-field]").forEach((field) => { field.hidden = inflow; });
    form.querySelector("[data-party-label]").textContent = inflow ? "Customer" : "Supplier";
    renderPartyOptions();
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
      partyId: form.elements.partyId.value || undefined,
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

  partyForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const partyMessage = document.querySelector("#party-message");
    const partySubmit = partyForm.querySelector('button[type="submit"]');
    partyMessage.className = "transaction-message";
    partyMessage.textContent = "";
    partySubmit.disabled = true;
    try {
      const response = await fetch("/api/parties", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: partyForm.elements.name.value,
          role: partyForm.elements.role.value,
          email: partyForm.elements.email.value,
          phone: partyForm.elements.phone.value,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to register party.");
      partyForm.reset();
      await load();
      form.elements.partyId.value = result.id;
      const selected = form.elements.partyId.value === result.id;
      partyMessage.textContent = selected ? "Party registered and selected for the next transaction." : "Party registered in the directory.";
    } catch (error) {
      partyMessage.className = "transaction-message error";
      partyMessage.textContent = error instanceof Error ? error.message : "Unable to register party.";
    } finally {
      partySubmit.disabled = false;
    }
  });

  document.querySelector("#party-list").addEventListener("click", async (event) => {
    const button = event.target.closest("button[data-party-id]");
    if (!button || !window.confirm("Delete this party? Existing transactions will keep its name.")) return;
    button.disabled = true;
    try {
      const response = await fetch(`/api/parties/${button.dataset.partyId}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Unable to delete party.");
      await load();
      const partyMessage = document.querySelector("#party-message");
      partyMessage.className = "transaction-message";
      partyMessage.textContent = "Party deleted. Historical transactions were preserved.";
    } catch (error) {
      button.disabled = false;
      const partyMessage = document.querySelector("#party-message");
      partyMessage.className = "transaction-message error";
      partyMessage.textContent = error instanceof Error ? error.message : "Unable to delete party.";
    }
  });

  load().catch((error) => {
    message.className = "transaction-message error";
    message.textContent = error instanceof Error ? error.message : "Unable to load transaction history.";
  });
}
