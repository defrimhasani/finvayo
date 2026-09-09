import { FormEvent, useEffect, useState } from "react";

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
  AlertDialogTrigger,
} from "../components/ui/alert-dialog";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { amountMinor } from "../utils";

type Settings = {
  name: string;
  currency: string;
  timezone: string;
  minimumBufferMinor: number;
  taxReserveMinor: number;
  taxReserveMode: "fixed" | "percentage";
  taxRateBasisPoints: number;
  paymentDelayDays: number;
  email: string;
  currencyLocked: boolean;
};

type SettingsForm = {
  name: string;
  currency: string;
  timezone: string;
  minimumBuffer: string;
  taxReserve: string;
  taxReserveMode: "fixed" | "percentage";
  taxRate: string;
  paymentDelayDays: string;
};

type Billing = {
  subscription: {
    status?: string;
    currentPeriodEnd?: number | null;
    cancelAtPeriodEnd?: boolean;
  };
  trialEndsAt: number;
};

type DestructiveAction = "reset" | "delete";

const TIMEZONES = [
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
] as const;

const EMPTY_FORM: SettingsForm = {
  name: "",
  currency: "USD",
  timezone: "UTC",
  minimumBuffer: "0.00",
  taxReserve: "0.00",
  taxReserveMode: "fixed",
  taxRate: "0.00",
  paymentDelayDays: "0",
};

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function amountValue(value: number) {
  return (value / 100).toFixed(2);
}

export function SettingsPage() {
  const [form, setForm] = useState<SettingsForm>(EMPTY_FORM);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [billing, setBilling] = useState<Billing | null>(null);
  const [loading, setLoading] = useState(true);
  const [settingsMessage, setSettingsMessage] = useState("");
  const [settingsError, setSettingsError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [billingMessage, setBillingMessage] = useState("");
  const [billingError, setBillingError] = useState(false);
  const [billingAction, setBillingAction] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [pendingDestructiveAction, setPendingDestructiveAction] = useState<DestructiveAction | null>(null);
  const [destructiveAction, setDestructiveAction] = useState<DestructiveAction | null>(null);
  const [dataMessage, setDataMessage] = useState("");

  useEffect(() => {
    let active = true;
    const settingsRequest = api<{ settings: Settings }>("/api/settings").then((settingsResult) => {
        if (!active) return;
        const value = settingsResult.settings;
        setSettings(value);
        setForm({
          name: value.name,
          currency: value.currency,
          timezone: value.timezone,
          minimumBuffer: amountValue(value.minimumBufferMinor),
          taxReserve: amountValue(value.taxReserveMinor),
          taxReserveMode: value.taxReserveMode,
          taxRate: (value.taxRateBasisPoints / 100).toFixed(2),
          paymentDelayDays: String(value.paymentDelayDays),
        });
      }).catch((error) => {
        if (!active) return;
        setSettingsError(true);
        setSettingsMessage(errorMessage(error, "Unable to load settings."));
      });
    const billingRequest = api<Billing>("/api/billing").then((billingResult) => {
      if (active) setBilling(billingResult);
    }).catch((error) => {
      if (!active) return;
      setBillingError(true);
      setBillingMessage(errorMessage(error, "Unable to load billing status."));
    });
    Promise.all([settingsRequest, billingRequest])
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  function update<K extends keyof SettingsForm>(key: K, value: SettingsForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSettingsMessage("");
    setSettingsError(false);

    const minimumBufferMinor = amountMinor(form.minimumBuffer);
    const taxReserveMinor = amountMinor(form.taxReserve);
    const taxRateBasisPoints = /^\d+(?:\.\d{1,2})?$/.test(form.taxRate.trim())
      ? Math.round(Number(form.taxRate) * 100)
      : null;
    const paymentDelayDays = Number(form.paymentDelayDays);
    if (
      minimumBufferMinor === null ||
      taxReserveMinor === null ||
      taxRateBasisPoints === null ||
      taxRateBasisPoints > 10000 ||
      !Number.isInteger(paymentDelayDays) ||
      paymentDelayDays < 0 ||
      paymentDelayDays > 365
    ) {
      setSettingsError(true);
      setSettingsMessage("Enter valid non-negative amounts with up to two decimal places.");
      return;
    }

    setSaving(true);
    try {
      await api<{ updated: true }>("/api/settings", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          currency: form.currency,
          timezone: form.timezone,
          minimumBufferMinor,
          taxReserveMinor,
          taxReserveMode: form.taxReserveMode,
          taxRateBasisPoints,
          paymentDelayDays,
        }),
      });
      setSettingsMessage("Workspace settings saved.");
    } catch (error) {
      setSettingsError(true);
      setSettingsMessage(errorMessage(error, "Unable to save settings."));
    } finally {
      setSaving(false);
    }
  }

  async function openBilling(path: string, body: Record<string, string> = {}) {
    setBillingAction(path + JSON.stringify(body));
    setBillingError(false);
    setBillingMessage("Opening secure billing...");
    try {
      const result = await api<{ url: string }>(path, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      window.location.assign(result.url);
    } catch (error) {
      setBillingError(true);
      setBillingMessage(errorMessage(error, "Billing is temporarily unavailable."));
      setBillingAction(null);
    }
  }

  async function confirmDestructiveAction() {
    if (!pendingDestructiveAction || !password) return;
    const action = pendingDestructiveAction;
    const path = action === "delete" ? "/api/account" : "/api/plan/reset";
    setDestructiveAction(action);
    setDataMessage("");
    try {
      await api(path, {
        method: action === "delete" ? "DELETE" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password }),
      });
      window.location.assign(action === "delete" ? "/" : "/app");
    } catch (error) {
      setDataMessage(errorMessage(error, "Unable to complete this request."));
      setDestructiveAction(null);
    }
  }

  const status = billing?.subscription.status || "trialing";
  const statusLabel = status.replaceAll("_", " ");
  let billingNote = "Checking your subscription.";
  if (billing && status === "trialing") {
    const days = Math.max(0, Math.ceil((billing.trialEndsAt - Date.now() / 1000) / 86400));
    billingNote = `${days} days remain in your free trial. Choose a plan to continue after it ends.`;
  } else if (billing) {
    const periodEnd = billing.subscription.currentPeriodEnd
      ? new Date(billing.subscription.currentPeriodEnd * 1000).toLocaleDateString(undefined, { dateStyle: "medium" })
      : null;
    billingNote = billing.subscription.cancelAtPeriodEnd
      ? `Cancellation is scheduled${periodEnd ? ` for ${periodEnd}` : ""}.`
      : periodEnd
        ? `Current billing period ends ${periodEnd}.`
        : "Manage payment details and your subscription in Stripe.";
  }

  return (
    <AppShell activePage="settings">
      <main className="app-main settings-main" id="app-main">
        <header className="workspace-header">
          <div><p className="app-kicker">Workspace controls</p><h1>Settings</h1></div>
        </header>
        <section className="settings-grid" aria-busy={loading}>
          <form className="settings-card settings-form" onSubmit={saveSettings}>
            <div><p className="app-kicker">Planning defaults</p><h2>Workspace</h2><p>These values shape how your cash plan is displayed and protected.</p></div>
            <Label className="transaction-field"><span>Workspace name</span><Input value={form.name} onChange={(event) => update("name", event.target.value)} maxLength={80} autoComplete="organization" required disabled={loading} /></Label>
            <div className="transaction-fields">
              <div className="transaction-field"><Label className="mb-[0.45rem] block text-[0.58rem]" htmlFor="settings-currency">Currency</Label><Select value={form.currency} onValueChange={(value) => update("currency", value)} disabled={loading || settings?.currencyLocked}><SelectTrigger id="settings-currency"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="USD">USD - US dollar</SelectItem><SelectItem value="EUR">EUR - Euro</SelectItem><SelectItem value="GBP">GBP - British pound</SelectItem></SelectContent></Select><small>{settings?.currencyLocked ? "Locked because this workspace has financial records." : "Currency locks after your first financial record."}</small></div>
              <div className="transaction-field"><Label className="mb-[0.45rem] block text-[0.58rem]" htmlFor="settings-timezone">Timezone</Label><Select value={form.timezone} onValueChange={(value) => update("timezone", value)} disabled={loading}><SelectTrigger id="settings-timezone"><SelectValue /></SelectTrigger><SelectContent>{TIMEZONES.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div>
            </div>
            <div className="transaction-fields">
              <Label className="transaction-field"><span>Minimum cash buffer</span><Input value={form.minimumBuffer} onChange={(event) => update("minimumBuffer", event.target.value)} inputMode="decimal" required placeholder="0.00" disabled={loading} /></Label>
              <Label className="transaction-field"><span>Tax already reserved</span><Input value={form.taxReserve} onChange={(event) => update("taxReserve", event.target.value)} inputMode="decimal" required placeholder="0.00" disabled={loading} /></Label>
            </div>
            <div className="transaction-fields">
              <div className="transaction-field"><Label className="mb-[0.45rem] block text-[0.58rem]" htmlFor="settings-tax-reserve-method">Tax reserve method</Label><Select value={form.taxReserveMode} onValueChange={(value) => update("taxReserveMode", value as SettingsForm["taxReserveMode"])} disabled={loading}><SelectTrigger id="settings-tax-reserve-method"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="fixed">Fixed amount only</SelectItem><SelectItem value="percentage">Reserve future income percentage</SelectItem></SelectContent></Select></div>
              <Label className="transaction-field"><span>Future income tax rate (%)</span><Input value={form.taxRate} onChange={(event) => update("taxRate", event.target.value)} inputMode="decimal" required placeholder="0" disabled={loading} /></Label>
            </div>
            <Label className="transaction-field"><span>Typical customer payment delay (days)</span><Input value={form.paymentDelayDays} onChange={(event) => update("paymentDelayDays", event.target.value)} type="number" min={0} max={365} required disabled={loading} /></Label>
            <Button className="button button-primary" type="submit" disabled={loading || saving}>{saving ? "Saving..." : "Save workspace settings"}</Button>
            <p className={`transaction-message${settingsError ? " error" : ""}`} role="status" aria-live="polite">{settingsMessage}</p>
          </form>
          <div className="settings-stack">
            <Card className="settings-card"><p className="app-kicker">Account</p><h2>Owner details</h2><div className="settings-fact"><span>Email</span><strong>{settings?.email || "Loading..."}</strong></div><p className="settings-note">Your email identifies the workspace owner and is not currently editable.</p></Card>
            <Card className="settings-card">
              <p className="app-kicker">Subscription</p><h2>Billing</h2>
              <div className="settings-fact"><span>Status</span><strong>{billing ? statusLabel[0].toUpperCase() + statusLabel.slice(1) : "Loading..."}</strong></div>
              <p className="settings-note">{billingNote}</p>
              <div className="billing-actions">
                {billing && status === "trialing" ? <><Button className="button button-primary" type="button" disabled={billingAction !== null} onClick={() => openBilling("/api/billing/checkout", { interval: "monthly" })}>Choose monthly</Button><Button className="button button-secondary" variant="secondary" type="button" disabled={billingAction !== null} onClick={() => openBilling("/api/billing/checkout", { interval: "annual" })}>Choose annual</Button></> : null}
                {billing && status !== "trialing" ? <Button className="button button-primary" type="button" disabled={billingAction !== null} onClick={() => openBilling("/api/billing/portal")}>Manage billing</Button> : null}
              </div>
              <p className={`transaction-message${billingError ? " error" : ""}`} role="status" aria-live="polite">{billingMessage}</p>
            </Card>
            <Card className="settings-card"><p className="app-kicker">Your data</p><h2>Export</h2><p className="settings-note">Download a complete JSON archive or a spreadsheet-ready transaction CSV.</p><div className="billing-actions"><Button asChild className="button button-secondary" variant="secondary"><a href="/api/export?format=json">Download JSON</a></Button><Button asChild className="button button-secondary" variant="secondary"><a href="/api/export?format=csv">Download CSV</a></Button></div></Card>
            <Card className="settings-card danger-card">
              <p className="app-kicker">Danger zone</p><h2>Reset or delete</h2>
              <p className="settings-note">Resetting removes all financial records and review history but keeps your account and parties. Account deletion removes the entire workspace and cannot proceed while a paid subscription is active.</p>
              <Label className="transaction-field"><span>Current password</span><Input value={password} onChange={(event) => setPassword(event.target.value)} type="password" autoComplete="current-password" disabled={destructiveAction !== null} /></Label>
              <AlertDialog open={pendingDestructiveAction !== null} onOpenChange={(open) => { if (!open && destructiveAction === null) setPendingDestructiveAction(null); }}>
                <div className="billing-actions">
                  <AlertDialogTrigger asChild><Button className="button button-secondary" variant="secondary" type="button" disabled={!password || destructiveAction !== null} onClick={() => setPendingDestructiveAction("reset")}>Reset financial plan</Button></AlertDialogTrigger>
                  <AlertDialogTrigger asChild><Button className="button danger-button" variant="destructive" type="button" disabled={!password || destructiveAction !== null} onClick={() => setPendingDestructiveAction("delete")}>Delete account</Button></AlertDialogTrigger>
                </div>
                <AlertDialogContent className="settings-card">
                  <AlertDialogHeader>
                    <AlertDialogTitle>Confirm {pendingDestructiveAction === "delete" ? "account deletion" : "financial plan reset"}</AlertDialogTitle>
                    <AlertDialogDescription>{pendingDestructiveAction === "delete" ? "Permanently delete your Finvayo account and all workspace data?" : "Delete all financial records and review history?"} This cannot be undone.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <p className={`transaction-message${dataMessage ? " error" : ""}`} role="status" aria-live="polite">{dataMessage}</p>
                  <AlertDialogFooter className="billing-actions">
                    <AlertDialogAction asChild><Button className="button danger-button" variant="destructive" type="button" disabled={destructiveAction !== null} onClick={(event) => { event.preventDefault(); void confirmDestructiveAction(); }}>{destructiveAction ? "Working..." : "Confirm"}</Button></AlertDialogAction>
                    <AlertDialogCancel asChild><Button className="button button-secondary" variant="secondary" type="button" disabled={destructiveAction !== null}>Cancel</Button></AlertDialogCancel>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              {!pendingDestructiveAction ? <p className={`transaction-message${dataMessage ? " error" : ""}`} role="status" aria-live="polite">{dataMessage}</p> : null}
            </Card>
          </div>
        </section>
      </main>
    </AppShell>
  );
}

export default SettingsPage;
