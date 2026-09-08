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
  document.querySelectorAll("#balance-form input, #balance-form button, #scenario-form input, #scenario-form button").forEach((control) => {
    control.disabled = true;
  });
}

if (form && page.dataset.preview !== "true") {
  const message = document.querySelector("#transaction-message");
  const list = document.querySelector("#transaction-list");
  const count = document.querySelector("#transaction-count");
  const submit = form.querySelector('button[type="submit"]');
  const dateInput = form.elements.date;
  const balanceForm = document.querySelector("#balance-form");
  const scenarioForm = document.querySelector("#scenario-form");
  let entries = [];
  let parties = [];
  let currentOverview = null;
  let editingId = null;
  let editingEntry = null;
  let editingPartyId = null;
  let currentScenario = null;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const scrollToForm = (target) => target.scrollIntoView({ behavior: reducedMotion.matches ? "auto" : "smooth", block: "center" });
  const categories = {
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

  dateInput.value = new Date().toISOString().slice(0, 10);
  balanceForm.elements.effectiveDate.value = dateInput.value;
  scenarioForm.elements.date.value = dateInput.value;

  function money(amountMinor, currency) {
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(amountMinor / 100);
  }

  function transactionLabel(entry) {
    const options = categories[entry.direction] || [];
    const category = options.find(([value]) => value === entry.category)?.[1] || entry.category?.replaceAll("_", " ");
    return [entry.partyName || entry.clientName, category, entry.invoiceReference].filter(Boolean).join(" · ") || (entry.direction === "inflow" ? "Payment received" : "Expense paid");
  }

  function render(currency) {
    const transactions = [...entries].sort((a, b) => b.scheduledDate.localeCompare(a.scheduledDate));
    count.textContent = `${transactions.length} ${transactions.length === 1 ? "entry" : "entries"}`;
    list.replaceChildren();

    if (!transactions.length) {
      const empty = document.createElement("p");
      empty.className = "transaction-empty";
      empty.textContent = "No payments or expenses added yet.";
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
      const actions = document.createElement("div");

      name.textContent = entry.name;
      meta.textContent = `${entry.scheduledDate} · ${entry.status} · ${transactionLabel(entry)}`;
      amount.textContent = `${entry.direction === "inflow" ? "+" : "−"}${money(entry.actualAmountMinor || entry.amountMinor, currency)}`;
      remove.className = "transaction-delete";
      remove.type = "button";
      remove.dataset.id = entry.id;
      remove.setAttribute("aria-label", `Delete ${entry.name}`);
      remove.textContent = "×";
      actions.className = "transaction-actions";
      if (entry.status !== "paid") {
        const complete = document.createElement("button");
        complete.type = "button";
        complete.dataset.completeId = entry.id;
        complete.textContent = "Mark paid";
        const include = document.createElement("button");
        include.type = "button";
        include.dataset.includeId = entry.id;
        include.dataset.included = String(Boolean(entry.included));
        include.textContent = entry.included ? "Exclude" : "Include";
        actions.append(complete, include);
      }
      const edit = document.createElement("button");
      edit.type = "button";
      edit.dataset.editId = entry.id;
      edit.textContent = "Edit";
      actions.append(edit, remove);
      details.append(name, meta);
      row.append(details, amount, actions);
      list.append(row);
    }
  }

  function shortMoney(amountMinor, currency) {
    return new Intl.NumberFormat(undefined, { style: "currency", currency, notation: "compact", maximumFractionDigits: 1 }).format(amountMinor / 100);
  }

  function dayDifference(date, start) {
    return Math.round((new Date(`${date}T00:00:00Z`) - new Date(`${start}T00:00:00Z`)) / 86400000);
  }

  function renderOverview(overview, currency) {
    currentOverview = overview;
    if (!overview) {
      document.querySelector("#safe-amount").textContent = "—";
      document.querySelector("#current-cash").textContent = "Not confirmed";
      document.querySelector("#tax-reserve").textContent = "—";
      document.querySelector("#minimum-buffer").textContent = "—";
      document.querySelector("#safe-summary").lastChild.textContent = " Confirm your current cash to calculate a real 90-day outlook.";
      document.querySelector("#risk-label").textContent = "Setup needed";
      document.querySelector("#risk-detail").textContent = "Confirm current cash";
      document.querySelector("#action-type").textContent = "First step";
      document.querySelector("#action-title").textContent = "Confirm the cash currently available to your business.";
      document.querySelector("#action-detail").textContent = "Required for forecast";
      document.querySelector("#action-amount").textContent = "";
      document.querySelector("#action-link").setAttribute("href", "#balance-form");
      document.querySelector("#overview-chart").hidden = true;
      document.querySelector("#chart-summary").innerHTML = "<span>01</span>Add a confirmed balance to start your 90-day projection.";
      document.querySelector("#upcoming-list").innerHTML = '<p class="transaction-empty">No forecast is available until current cash is confirmed.</p>';
      return;
    }

    document.querySelector("#overview-chart").hidden = false;
    document.querySelector("#safe-amount").textContent = money(overview.safeToSpendMinor, currency);
    document.querySelector("#current-cash").textContent = money(overview.currentCashMinor, currency);
    document.querySelector("#tax-reserve").textContent = money(overview.taxReserveMinor, currency);
    document.querySelector("#minimum-buffer").textContent = money(overview.minimumBufferMinor, currency);
    const riskText = overview.risk === "normal" ? "On track" : overview.risk === "caution" ? "Caution" : "At risk";
    document.querySelector("#risk-label").textContent = riskText;
    document.querySelector("#risk-detail").textContent = overview.provisional ? "Balance confirmation needed" : `Based on data through ${overview.horizonEnd}`;
    document.querySelector("#review-state").dataset.risk = overview.risk;
    const summary = overview.provisional
      ? "Your outlook is provisional because transactions were recorded after the last balance confirmation."
      : overview.risk === "normal"
        ? "Your protected cash stays intact for the next 90 days."
        : overview.risk === "caution"
          ? `Projected cash crosses your protected level on ${overview.firstBreachDate}.`
          : `Projected cash falls below zero by ${overview.firstNegativeDate}.`;
    document.querySelector("#safe-summary").lastChild.textContent = summary;

    const recommendation = overview.recommendation;
    document.querySelector("#action-type").textContent = recommendation.type;
    document.querySelector("#action-title").textContent = recommendation.title;
    document.querySelector("#action-detail").textContent = recommendation.detail;
    document.querySelector("#action-amount").textContent = recommendation.amountMinor === null ? "" : money(recommendation.amountMinor, currency);
    document.querySelector("#action-link").setAttribute("href", recommendation.type === "Invoice follow-up" ? "#transactions" : "#cash-plan");

    const values = [...overview.points.map((point) => point.balanceMinor), overview.protectedMinor, 0];
    const minimum = Math.min(...values);
    const maximum = Math.max(...values);
    const padding = Math.max((maximum - minimum) * 0.12, 100);
    const chartMin = minimum - padding;
    const chartMax = maximum + padding;
    const range = chartMax - chartMin;
    const x = (date) => (dayDifference(date, overview.horizonStart) / 90) * 900;
    const y = (value) => 250 - ((value - chartMin) / range) * 250;
    let line = `M0 ${y(overview.currentCashMinor).toFixed(1)}`;
    for (const point of overview.points.slice(1)) line += ` H${x(point.date).toFixed(1)} V${y(point.balanceMinor).toFixed(1)}`;
    line += " H900";
    document.querySelector("#chart-line").setAttribute("d", line);
    document.querySelector("#chart-area").setAttribute("d", `${line} V250 H0 Z`);
    document.querySelector("#protected-zone").hidden = true;
    let reserveLine = `M0 ${y(overview.points[0].protectedMinor).toFixed(1)}`;
    for (const point of overview.points.slice(1)) reserveLine += ` H${x(point.date).toFixed(1)} V${y(point.protectedMinor).toFixed(1)}`;
    document.querySelector("#reserve-line").setAttribute("d", `${reserveLine} H900`);
    document.querySelector("#protected-label").textContent = `Protected ${shortMoney(overview.protectedMinor, currency)}`;
    const ticks = [chartMax, chartMax - range / 3, chartMax - (2 * range) / 3, chartMin];
    ["#axis-max", "#axis-mid-high", "#axis-mid-low", "#axis-min"].forEach((selector, index) => {
      document.querySelector(selector).textContent = shortMoney(ticks[index], currency);
    });
    document.querySelector("#overview-chart").setAttribute("aria-label", `Projected cash reaches a low of ${money(overview.lowestBalanceMinor, currency)} by ${overview.limitingDate}.`);
    const difference = Math.abs(overview.lowestHeadroomMinor);
    document.querySelector("#chart-summary").innerHTML = `<span>01</span>Your lowest projected balance is <strong>${money(overview.lowestBalanceMinor, currency)} on ${overview.limitingDate}</strong>, ${money(difference, currency)} ${overview.lowestHeadroomMinor >= 0 ? "above" : "below"} your protected level.`;

    const upcomingList = document.querySelector("#upcoming-list");
    const upcoming = overview.events.filter((entry) => dayDifference(entry.date, overview.horizonStart) <= 14).slice(0, 5);
    upcomingList.replaceChildren();
    if (!upcoming.length) {
      const empty = document.createElement("p");
      empty.className = "transaction-empty";
      empty.textContent = "No projected payments or expenses in the next 14 days.";
      upcomingList.append(empty);
    }
    for (const entry of upcoming) {
      const row = document.createElement("div");
      row.className = "ledger-row";
      const days = dayDifference(entry.date, overview.horizonStart);
      const timing = document.createElement("time");
      timing.dateTime = entry.date;
      timing.innerHTML = `<strong>${days === 0 ? "Now" : `+${days}`}</strong><span>${days === 0 ? "" : "days"}</span>`;
      const details = document.createElement("div");
      const name = document.createElement("strong");
      const kind = document.createElement("span");
      const amount = document.createElement("b");
      name.textContent = entry.name;
      kind.textContent = entry.direction === "inflow" ? "Projected income" : "Planned expense";
      amount.className = entry.direction === "inflow" ? "money-in" : "";
      amount.textContent = `${entry.direction === "inflow" ? "+" : "−"}${money(entry.amountMinor, currency)}`;
      details.append(name, kind);
      row.append(timing, details, amount);
      upcomingList.append(row);
    }
  }

  async function load() {
    const [financialsResponse, partiesResponse, workflowsResponse] = await Promise.all([
      fetch("/api/financials", { headers: { accept: "application/json" } }),
      fetch("/api/parties", { headers: { accept: "application/json" } }),
      fetch("/api/workflows", { headers: { accept: "application/json" } }),
    ]);
    if (!financialsResponse.ok || !partiesResponse.ok || !workflowsResponse.ok) throw new Error("Unable to load workspace data.");
    const [financials, directory, workflows] = await Promise.all([financialsResponse.json(), partiesResponse.json(), workflowsResponse.json()]);
    entries = financials.entries;
    parties = directory.parties;
    form.dataset.currency = financials.currency || "USD";
    render(form.dataset.currency);
    renderOverview(financials.overview, form.dataset.currency);
    renderParties();
    setDirection();
    renderWorkflows(workflows);
  }

  function renderWorkflows(workflows) {
    const review = document.querySelector("#last-review");
    review.textContent = workflows.lastReview
      ? `Last completed ${new Date(workflows.lastReview.completedAt * 1000).toLocaleDateString(undefined, { dateStyle: "medium" })}. ${workflows.lastReview.summary}`
      : "No review completed yet.";
    const overdue = entries.filter((entry) => entry.direction === "inflow" && entry.status === "overdue");
    const select = document.querySelector("#follow-up-entry");
    select.replaceChildren(new Option(overdue.length ? "Choose an overdue payment" : "No overdue payments", ""));
    for (const entry of overdue) select.add(new Option(`${entry.partyName || entry.clientName || entry.name} · ${money(entry.amountMinor, form.dataset.currency)}`, entry.id));
    document.querySelector("#generate-follow-up").disabled = overdue.length === 0;
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
      const edit = document.createElement("button");
      name.textContent = party.name;
      contact.textContent = [party.email, party.phone].filter(Boolean).join(" · ") || "No contact details";
      role.className = "party-role";
      role.textContent = roleLabel(party.role);
      remove.className = "transaction-delete";
      remove.type = "button";
      remove.dataset.partyId = party.id;
      remove.setAttribute("aria-label", `Delete ${party.name}`);
      remove.textContent = "×";
      edit.type = "button";
      edit.dataset.editPartyId = party.id;
      edit.textContent = "Edit";
      details.append(name, contact);
      const actions = document.createElement("div");
      actions.className = "transaction-actions";
      actions.append(edit, remove);
      row.append(details, role, actions);
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
    const recorded = form.elements.timing.value === "recorded";
    form.querySelectorAll("[data-inflow-field]").forEach((field) => { field.hidden = !inflow; });
    form.querySelectorAll("[data-outflow-field]").forEach((field) => { field.hidden = inflow; });
    form.querySelectorAll("[data-planned-field]").forEach((field) => { field.hidden = recorded; });
    form.querySelector("[data-party-label]").textContent = inflow ? "Customer" : "Supplier";
    const category = form.elements.category;
    category.replaceChildren(...categories[inflow ? "inflow" : "outflow"].map(([value, label]) => new Option(label, value)));
    const status = form.elements.status;
    status.replaceChildren(...(inflow ? [["expected", "Expected"], ["invoiced", "Invoiced"], ["unlikely", "Unlikely"]] : [["planned", "Planned"]]).map(([value, label]) => new Option(label, value)));
    renderPartyOptions();
    submit.textContent = editingId ? "Save transaction" : recorded ? (inflow ? "Record payment" : "Record expense") : (inflow ? "Add expected income" : "Add planned expense");
  }

  function stopEditing() {
    editingId = null;
    editingEntry = null;
    form.reset();
    dateInput.value = new Date().toISOString().slice(0, 10);
    document.querySelector("#cancel-entry-edit").hidden = true;
    setDirection();
  }

  document.querySelector("#cancel-entry-edit").addEventListener("click", stopEditing);

  form.addEventListener("change", (event) => {
    if (event.target.name === "direction" || event.target.name === "timing") setDirection();
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
    const recorded = form.elements.timing.value === "recorded";
    const amountMinor = Math.round(Number(amount) * 100);
    const payload = {
      direction,
      name: form.elements.name.value,
      amountMinor: editingEntry?.status === "paid" ? editingEntry.amountMinor : amountMinor,
      actualAmountMinor: recorded ? amountMinor : undefined,
      actualDate: recorded ? form.elements.date.value : undefined,
      scheduledDate: editingEntry?.status === "paid" ? editingEntry.scheduledDate : form.elements.date.value,
      status: recorded ? "paid" : form.elements.status.value,
      partyId: form.elements.partyId.value || (editingId ? null : undefined),
      invoiceReference: direction === "inflow" ? form.elements.invoiceReference.value : undefined,
      category: form.elements.category.value,
      recurrence: !recorded && form.elements.recurring.checked ? "monthly" : editingId ? null : undefined,
    };

    submit.disabled = true;
    try {
      const response = await fetch(editingId ? `/api/cash-entries/${editingId}` : "/api/cash-entries", {
        method: editingId ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to record transaction.");
      const wasEditing = Boolean(editingId);
      stopEditing();
      await load();
      message.textContent = wasEditing ? "Transaction updated." : recorded
        ? direction === "inflow" ? "Payment recorded." : "Expense recorded."
        : direction === "inflow" ? "Expected income added to the forecast." : "Planned expense added to the forecast.";
    } catch (error) {
      message.classList.add("error");
      message.textContent = error instanceof Error ? error.message : "Unable to record transaction.";
    } finally {
      submit.disabled = false;
    }
  });

  list.addEventListener("click", async (event) => {
    const action = event.target.closest("button");
    if (!action) return;
    if (action.dataset.completeId) {
      const entry = entries.find((item) => item.id === action.dataset.completeId);
      const amount = window.prompt("Actual amount", ((entry.actualAmountMinor || entry.amountMinor) / 100).toFixed(2));
      const actualDate = window.prompt("Actual date (YYYY-MM-DD)", new Date().toISOString().slice(0, 10));
      if (amount === null || actualDate === null || !/^\d+(?:\.\d{1,2})?$/.test(amount)) return;
      const response = await fetch(`/api/cash-entries/${entry.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: "paid", actualAmountMinor: Math.round(Number(amount) * 100), actualDate }),
      });
      if (!response.ok) { message.className = "transaction-message error"; message.textContent = (await response.json()).error; return; }
      await load();
      message.className = "transaction-message";
      message.textContent = "Transaction marked paid.";
      return;
    }
    if (action.dataset.includeId) {
      const response = await fetch(`/api/cash-entries/${action.dataset.includeId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ included: action.dataset.included !== "true" }),
      });
      if (response.ok) await load();
      return;
    }
    if (action.dataset.editId) {
      const entry = entries.find((item) => item.id === action.dataset.editId);
      editingId = entry.id;
      editingEntry = entry;
      form.elements.direction.value = entry.direction;
      form.elements.timing.value = entry.status === "paid" ? "recorded" : "planned";
      setDirection();
      form.elements.name.value = entry.name;
      form.elements.amount.value = (entry.amountMinor / 100).toFixed(2);
      form.elements.date.value = entry.scheduledDate;
      form.elements.partyId.value = entry.partyId || "";
      form.elements.invoiceReference.value = entry.invoiceReference || "";
      form.elements.category.value = entry.category || (entry.direction === "inflow" ? "service_income" : "other");
      if (entry.status !== "paid") form.elements.status.value = entry.storedStatus || entry.status;
      form.elements.recurring.checked = entry.recurrence === "monthly";
      document.querySelector("#cancel-entry-edit").hidden = false;
      submit.textContent = "Save transaction";
       scrollToForm(form);
       form.elements.name.focus();
      return;
    }
    const button = action.closest("button[data-id]");
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

  balanceForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const balanceMessage = document.querySelector("#balance-message");
    const value = balanceForm.elements.balance.value.trim();
    if (!/^-?\d+(?:\.\d{1,2})?$/.test(value)) {
      balanceMessage.className = "transaction-message error";
      balanceMessage.textContent = "Enter a valid balance with up to two decimal places.";
      return;
    }
    const button = balanceForm.querySelector("button");
    button.disabled = true;
    try {
      const response = await fetch("/api/cash-snapshots", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ balanceMinor: Math.round(Number(value) * 100), effectiveDate: balanceForm.elements.effectiveDate.value }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to confirm balance.");
      await load();
      balanceMessage.className = "transaction-message";
      balanceMessage.textContent = "Current cash confirmed and forecast updated.";
    } catch (error) {
      balanceMessage.className = "transaction-message error";
      balanceMessage.textContent = error instanceof Error ? error.message : "Unable to confirm balance.";
    } finally {
      button.disabled = false;
    }
  });

  scenarioForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const result = document.querySelector("#scenario-result");
    const value = scenarioForm.elements.amount.value.trim();
    const amount = /^\d+(?:\.\d{1,2})?$/.test(value) ? Math.round(Number(value) * 100) : 0;
    const date = scenarioForm.elements.date.value;
    currentScenario = null;
    document.querySelector("#save-scenario").hidden = true;
    const response = await fetch("/api/scenarios", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ amountMinor: amount, date }) });
    const scenario = await response.json();
    if (!response.ok) { result.textContent = scenario.error; return; }
    currentScenario = scenario;
    const state = scenario.risk === "at_risk" ? "at risk" : scenario.risk === "caution" ? "caution" : "within your protected plan";
    result.textContent = `Lowest projected cash: ${money(scenario.lowestBalanceMinor, form.dataset.currency)}. Safe-to-spend changes by ${money(scenario.safeToSpendChangeMinor, form.dataset.currency)}: ${state}.`;
    document.querySelector("#save-scenario").hidden = false;
  });

  document.querySelector("#save-scenario").addEventListener("click", () => {
    if (!currentScenario) return;
    editingId = null;
    form.elements.direction.value = "outflow";
    form.elements.timing.value = "planned";
    setDirection();
    form.elements.name.value = "Scenario purchase";
    form.elements.amount.value = (currentScenario.amountMinor / 100).toFixed(2);
    form.elements.date.value = currentScenario.date;
    form.elements.category.value = "equipment";
     scrollToForm(form);
     form.elements.name.focus();
    message.textContent = "Scenario copied into the transaction form. Review and add it to your plan.";
  });

  document.querySelector("#review-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const reviewForm = event.currentTarget;
    const completed = [...reviewForm.querySelectorAll('input[name="step"]:checked')].map((item) => item.value);
    const reviewMessage = document.querySelector("#review-message");
    const response = await fetch("/api/weekly-reviews", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ completed }) });
    const result = await response.json();
    reviewMessage.className = `transaction-message${response.ok ? "" : " error"}`;
    reviewMessage.textContent = response.ok ? "Weekly review completed." : result.error;
    if (response.ok) { reviewForm.reset(); await load(); }
  });

  document.querySelector("#generate-follow-up").addEventListener("click", async () => {
    const entryId = document.querySelector("#follow-up-entry").value;
    const tone = document.querySelector("#follow-up-tone").value;
    if (!entryId) return;
    const response = await fetch("/api/follow-ups/preview", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ entryId, tone }) });
    const result = await response.json();
    const status = document.querySelector("#follow-up-status");
    status.className = `transaction-message${response.ok ? "" : " error"}`;
    if (response.ok) document.querySelector("#follow-up-message").value = result.message;
    status.textContent = response.ok ? "Message ready to review and edit." : result.error;
  });

  document.querySelector("#copy-follow-up").addEventListener("click", async () => {
    const text = document.querySelector("#follow-up-message").value;
    if (!text) return;
    await navigator.clipboard.writeText(text);
    document.querySelector("#follow-up-status").textContent = "Message copied.";
  });

  document.querySelector("#complete-follow-up").addEventListener("click", async () => {
    const entryId = document.querySelector("#follow-up-entry").value;
    const tone = document.querySelector("#follow-up-tone").value;
    const followUpMessage = document.querySelector("#follow-up-message").value;
    if (!entryId || !followUpMessage) return;
    const response = await fetch("/api/follow-ups", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ entryId, tone, message: followUpMessage }) });
    const result = await response.json();
    const status = document.querySelector("#follow-up-status");
    status.className = `transaction-message${response.ok ? "" : " error"}`;
    status.textContent = response.ok ? "Follow-up marked as sent." : result.error;
  });

  partyForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const partyMessage = document.querySelector("#party-message");
    const partySubmit = partyForm.querySelector('button[type="submit"]');
    partyMessage.className = "transaction-message";
    partyMessage.textContent = "";
    partySubmit.disabled = true;
    try {
      const response = await fetch(editingPartyId ? `/api/parties/${editingPartyId}` : "/api/parties", {
        method: editingPartyId ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: partyForm.elements.name.value,
          role: partyForm.elements.role.value,
          email: partyForm.elements.email.value,
          phone: partyForm.elements.phone.value,
          notes: partyForm.elements.notes.value,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to register party.");
      const wasEditing = Boolean(editingPartyId);
      editingPartyId = null;
      partyForm.reset();
      document.querySelector("#cancel-party-edit").hidden = true;
      partySubmit.textContent = "Register party";
      await load();
      if (!wasEditing) form.elements.partyId.value = result.id;
      const selected = form.elements.partyId.value === result.id;
      partyMessage.textContent = wasEditing ? "Party updated." : selected ? "Party registered and selected for the next transaction." : "Party registered in the directory.";
    } catch (error) {
      partyMessage.className = "transaction-message error";
      partyMessage.textContent = error instanceof Error ? error.message : "Unable to register party.";
    } finally {
      partySubmit.disabled = false;
    }
  });

  document.querySelector("#party-list").addEventListener("click", async (event) => {
    const edit = event.target.closest("button[data-edit-party-id]");
    if (edit) {
      const party = parties.find((item) => item.id === edit.dataset.editPartyId);
      editingPartyId = party.id;
      partyForm.elements.name.value = party.name;
      partyForm.elements.role.value = party.role;
      partyForm.elements.email.value = party.email || "";
      partyForm.elements.phone.value = party.phone || "";
      partyForm.elements.notes.value = party.notes || "";
      partyForm.querySelector('button[type="submit"]').textContent = "Save party";
      document.querySelector("#cancel-party-edit").hidden = false;
       scrollToForm(partyForm);
       partyForm.elements.name.focus();
      return;
    }
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

  document.querySelector("#cancel-party-edit").addEventListener("click", () => {
    editingPartyId = null;
    partyForm.reset();
    partyForm.querySelector('button[type="submit"]').textContent = "Register party";
    document.querySelector("#cancel-party-edit").hidden = true;
  });

  load().catch((error) => {
    message.className = "transaction-message error";
    message.textContent = error instanceof Error ? error.message : "Unable to load transaction history.";
  });
}
