const form = document.querySelector("#settings-form");
const message = document.querySelector("#settings-message");
const currency = form.elements.currency;
const timezone = form.elements.timezone;
const timezones = [
  ["UTC", "UTC"],
  ["America/New_York", "Eastern Time (US & Canada)"],
  ["America/Chicago", "Central Time (US & Canada)"],
  ["America/Denver", "Mountain Time (US & Canada)"],
  ["America/Los_Angeles", "Pacific Time (US & Canada)"],
  ["America/Toronto", "Toronto"],
  ["Europe/London", "London"],
  ["Europe/Paris", "Paris"],
  ["Europe/Berlin", "Berlin"],
  ["Europe/Zurich", "Zurich"],
  ["Europe/Tirane", "Tirana"],
  ["Asia/Dubai", "Dubai"],
  ["Asia/Kolkata", "India"],
  ["Asia/Singapore", "Singapore"],
  ["Asia/Tokyo", "Tokyo"],
  ["Australia/Sydney", "Sydney"],
];

timezone.replaceChildren(...timezones.map(([value, label]) => new Option(label, value)));

function amountValue(amountMinor) {
  return (amountMinor / 100).toFixed(2);
}

function amountMinor(value) {
  const normalized = value.trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) return null;
  const amount = Math.round(Number(normalized) * 100);
  return Number.isSafeInteger(amount) ? amount : null;
}

async function loadSettings() {
  const response = await fetch("/api/settings", { headers: { accept: "application/json" } });
  if (!response.ok) throw new Error("Unable to load settings.");
  const { settings } = await response.json();
  form.elements.name.value = settings.name;
  currency.value = settings.currency;
  timezone.value = settings.timezone;
  form.elements.minimumBuffer.value = amountValue(settings.minimumBufferMinor);
  form.elements.taxReserve.value = amountValue(settings.taxReserveMinor);
  form.elements.taxReserveMode.value = settings.taxReserveMode;
  form.elements.taxRate.value = (settings.taxRateBasisPoints / 100).toFixed(2);
  form.elements.paymentDelayDays.value = settings.paymentDelayDays;
  document.querySelector("#account-email").textContent = settings.email;
  if (settings.currencyLocked) {
    currency.disabled = true;
    document.querySelector("#currency-help").textContent = "Locked because this workspace has financial records.";
  } else {
    document.querySelector("#currency-help").textContent = "Currency locks after your first financial record.";
  }
}

function billingButton(label, action, secondary = false) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `button ${secondary ? "button-secondary" : "button-primary"}`;
  button.textContent = label;
  button.addEventListener("click", async () => {
    const billingMessage = document.querySelector("#billing-message");
    billingMessage.className = "transaction-message";
    billingMessage.textContent = "Opening secure billing…";
    button.disabled = true;
    try {
      const response = await fetch(action.path, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(action.body || {}),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Billing is temporarily unavailable.");
      window.location.assign(result.url);
    } catch (error) {
      button.disabled = false;
      billingMessage.className = "transaction-message error";
      billingMessage.textContent = error instanceof Error ? error.message : "Billing is temporarily unavailable.";
    }
  });
  return button;
}

async function loadBilling() {
  const response = await fetch("/api/billing", { headers: { accept: "application/json" } });
  if (!response.ok) throw new Error("Unable to load billing status.");
  const data = await response.json();
  const subscription = data.subscription;
  const status = subscription.status || "trialing";
  const statusLabel = status.replaceAll("_", " ");
  const actions = document.querySelector("#billing-actions");
  document.querySelector("#billing-status").textContent = statusLabel[0].toUpperCase() + statusLabel.slice(1);
  actions.replaceChildren();

  if (status === "trialing") {
    const days = Math.max(0, Math.ceil((data.trialEndsAt - Date.now() / 1000) / 86400));
    document.querySelector("#billing-note").textContent = `${days} days remain in your free trial. Choose a plan to continue after it ends.`;
    actions.append(
      billingButton("Choose monthly", { path: "/api/billing/checkout", body: { interval: "monthly" } }),
      billingButton("Choose annual", { path: "/api/billing/checkout", body: { interval: "annual" } }, true),
    );
    return;
  }

  const periodEnd = subscription.currentPeriodEnd
    ? new Date(subscription.currentPeriodEnd * 1000).toLocaleDateString(undefined, { dateStyle: "medium" })
    : null;
  document.querySelector("#billing-note").textContent = subscription.cancelAtPeriodEnd
    ? `Cancellation is scheduled${periodEnd ? ` for ${periodEnd}` : ""}.`
    : periodEnd ? `Current billing period ends ${periodEnd}.` : "Manage payment details and your subscription in Stripe.";
  actions.append(billingButton("Manage billing", { path: "/api/billing/portal" }));
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const minimumBufferMinor = amountMinor(form.elements.minimumBuffer.value);
  const taxReserveMinor = amountMinor(form.elements.taxReserve.value);
  const taxRate = form.elements.taxRate.value.trim();
  const taxRateBasisPoints = /^\d+(?:\.\d{1,2})?$/.test(taxRate) ? Math.round(Number(taxRate) * 100) : null;
  const paymentDelayDays = Number(form.elements.paymentDelayDays.value);
  message.className = "transaction-message";
  message.textContent = "";
  if (minimumBufferMinor === null || taxReserveMinor === null || taxRateBasisPoints === null || taxRateBasisPoints > 10000 || !Number.isInteger(paymentDelayDays) || paymentDelayDays < 0 || paymentDelayDays > 365) {
    message.classList.add("error");
    message.textContent = "Enter valid non-negative amounts with up to two decimal places.";
    return;
  }

  const submit = form.querySelector('button[type="submit"]');
  submit.disabled = true;
  try {
    const response = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: form.elements.name.value,
        currency: currency.value,
        timezone: timezone.value,
        minimumBufferMinor,
        taxReserveMinor,
        taxReserveMode: form.elements.taxReserveMode.value,
        taxRateBasisPoints,
        paymentDelayDays,
      }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Unable to save settings.");
    message.textContent = "Workspace settings saved.";
  } catch (error) {
    message.classList.add("error");
    message.textContent = error instanceof Error ? error.message : "Unable to save settings.";
  } finally {
    submit.disabled = false;
  }
});

Promise.all([loadSettings(), loadBilling()]).catch((error) => {
  message.className = "transaction-message error";
  message.textContent = error instanceof Error ? error.message : "Unable to load settings.";
});

async function destructiveAction(path, method, confirmation) {
  const dataMessage = document.querySelector("#data-message");
  const password = document.querySelector("#destructive-password").value;
  if (!password || !window.confirm(confirmation)) return;
  const response = await fetch(path, { method, headers: { "content-type": "application/json" }, body: JSON.stringify({ password }) });
  if (response.ok) {
    if (path === "/api/account") window.location.assign("/");
    else window.location.assign("/app");
    return;
  }
  const result = await response.json();
  dataMessage.className = "transaction-message error";
  dataMessage.textContent = result.error || "Unable to complete this request.";
}

document.querySelector("#reset-plan").addEventListener("click", () => destructiveAction("/api/plan/reset", "POST", "Delete all financial records and review history? This cannot be undone."));
document.querySelector("#delete-account").addEventListener("click", () => destructiveAction("/api/account", "DELETE", "Permanently delete your Finvayo account and all workspace data?"));
