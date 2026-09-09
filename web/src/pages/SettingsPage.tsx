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
import { Badge } from "../components/ui/badge";
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
      <main
        className="min-h-screen w-full px-4 pb-24 pt-6 min-[761px]:px-6 min-[761px]:pb-20 min-[1200px]:px-8"
        id="app-main"
      >
        <header className="flex min-h-[150px] items-center border-b border-border">
          <div>
            <p className="mb-2 font-mono text-[0.7rem] uppercase leading-[1.35] tracking-[0.08em] text-[#3f665e]">Workspace controls</p>
            <h1 className="text-[clamp(2.5rem,4.2vw,4.5rem)] font-semibold tracking-[-0.06em]">Settings</h1>
          </div>
        </header>
        <section className="grid items-start gap-4 pt-5 lg:grid-cols-[minmax(340px,460px)_minmax(0,1fr)]" aria-busy={loading}>
          <form className="grid gap-4 border border-foreground bg-card p-[clamp(1.5rem,3vw,2.5rem)] text-card-foreground shadow-[5px_5px_0_rgba(23,24,21,0.12)]" onSubmit={saveSettings}>
            <div>
              <p className="mb-2 font-mono text-[0.7rem] uppercase leading-[1.35] tracking-[0.08em] text-[#3f665e]">Planning defaults</p>
              <h2 className="text-[1.4rem] font-semibold tracking-[-0.045em]">Workspace</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">These values shape how your cash plan is displayed and protected.</p>
            </div>
            <Label className="block">
              <span className="mb-[0.45rem] block">Workspace name</span>
              <Input value={form.name} onChange={(event) => update("name", event.target.value)} maxLength={80} autoComplete="organization" required disabled={loading} />
            </Label>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              <div>
                <Label className="mb-[0.45rem] block" htmlFor="settings-currency">Currency</Label>
                <Select value={form.currency} onValueChange={(value) => update("currency", value ?? "USD")} disabled={loading || settings?.currencyLocked}>
                  <SelectTrigger id="settings-currency"><SelectValue>{() => form.currency === "EUR" ? "EUR - Euro" : form.currency === "GBP" ? "GBP - British pound" : "USD - US dollar"}</SelectValue></SelectTrigger>
                  <SelectContent><SelectItem value="USD">USD - US dollar</SelectItem><SelectItem value="EUR">EUR - Euro</SelectItem><SelectItem value="GBP">GBP - British pound</SelectItem></SelectContent>
                </Select>
                <small className="mt-1.5 block min-h-4 text-xs leading-5 text-muted-foreground">{settings?.currencyLocked ? "Locked because this workspace has financial records." : "Currency locks after your first financial record."}</small>
              </div>
              <div>
                <Label className="mb-[0.45rem] block" htmlFor="settings-timezone">Timezone</Label>
                <Select value={form.timezone} onValueChange={(value) => update("timezone", value ?? "UTC")} disabled={loading}>
                  <SelectTrigger id="settings-timezone"><SelectValue>{() => TIMEZONES.find(([value]) => value === form.timezone)?.[1]}</SelectValue></SelectTrigger>
                  <SelectContent>{TIMEZONES.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Label className="block"><span className="mb-[0.45rem] block">Minimum cash buffer</span><Input value={form.minimumBuffer} onChange={(event) => update("minimumBuffer", event.target.value)} inputMode="decimal" required placeholder="0.00" disabled={loading} /></Label>
              <Label className="block"><span className="mb-[0.45rem] block">Tax already reserved</span><Input value={form.taxReserve} onChange={(event) => update("taxReserve", event.target.value)} inputMode="decimal" required placeholder="0.00" disabled={loading} /></Label>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label className="mb-[0.45rem] block" htmlFor="settings-tax-reserve-method">Tax reserve method</Label>
                <Select value={form.taxReserveMode} onValueChange={(value) => update("taxReserveMode", (value ?? "fixed") as SettingsForm["taxReserveMode"])} disabled={loading}>
                  <SelectTrigger id="settings-tax-reserve-method"><SelectValue>{() => form.taxReserveMode === "percentage" ? "Reserve future income percentage" : "Fixed amount only"}</SelectValue></SelectTrigger>
                  <SelectContent><SelectItem value="fixed">Fixed amount only</SelectItem><SelectItem value="percentage">Reserve future income percentage</SelectItem></SelectContent>
                </Select>
              </div>
              <Label className="block"><span className="mb-[0.45rem] block">Future income tax rate (%)</span><Input value={form.taxRate} onChange={(event) => update("taxRate", event.target.value)} inputMode="decimal" required placeholder="0" disabled={loading} /></Label>
            </div>
            <Label className="block"><span className="mb-[0.45rem] block">Typical customer payment delay (days)</span><Input value={form.paymentDelayDays} onChange={(event) => update("paymentDelayDays", event.target.value)} type="number" min={0} max={365} required disabled={loading} /></Label>
            <Button className="mt-2 w-full" type="submit" disabled={loading || saving}>{saving ? "Saving..." : "Save workspace settings"}</Button>
            <p className={`min-h-5 text-xs ${settingsError ? "text-destructive" : "text-[#225c50]"}`} role="status" aria-live="polite">{settingsMessage}</p>
          </form>
          <div className="grid min-w-0 gap-4 md:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            <Card className="p-[clamp(1.5rem,3vw,2.5rem)]">
              <p className="mb-2 font-mono text-[0.7rem] uppercase tracking-[0.08em] text-[#3f665e]">Account</p>
              <h2 className="text-[1.4rem] font-semibold tracking-[-0.045em]">Owner details</h2>
              <div className="mt-6 flex justify-between gap-4 border-y border-border py-4 text-sm"><span className="text-muted-foreground">Email</span><strong className="min-w-0 break-all text-right">{settings?.email || "Loading..."}</strong></div>
              <p className="mt-4 text-sm leading-6 text-muted-foreground">Your email identifies the workspace owner and is not currently editable.</p>
            </Card>
            <Card className="p-[clamp(1.5rem,3vw,2.5rem)]">
              <p className="mb-2 font-mono text-[0.7rem] uppercase tracking-[0.08em] text-[#3f665e]">Subscription</p>
              <h2 className="text-[1.4rem] font-semibold tracking-[-0.045em]">Billing</h2>
              <div className="mt-6 flex items-center justify-between gap-4 border-y border-border py-4 text-sm">
                <span className="text-muted-foreground">Status</span>
                {billing ? <Badge variant={status === "active" || status === "trialing" ? "success" : status === "canceled" || status === "unpaid" ? "destructive" : "outline"}>{statusLabel}</Badge> : <span className="font-semibold">Loading...</span>}
              </div>
              <p className="mt-4 text-sm leading-6 text-muted-foreground">{billingNote}</p>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {billing && status === "trialing" ? <><Button type="button" disabled={billingAction !== null} onClick={() => openBilling("/api/billing/checkout", { interval: "monthly" })}>Choose monthly</Button><Button variant="secondary" type="button" disabled={billingAction !== null} onClick={() => openBilling("/api/billing/checkout", { interval: "annual" })}>Choose annual</Button></> : null}
                {billing && status !== "trialing" ? <Button className="sm:col-span-2" type="button" disabled={billingAction !== null} onClick={() => openBilling("/api/billing/portal")}>Manage billing</Button> : null}
              </div>
              <p className={`mt-3 min-h-5 text-xs ${billingError ? "text-destructive" : "text-[#225c50]"}`} role="status" aria-live="polite">{billingMessage}</p>
            </Card>
            <Card className="p-[clamp(1.5rem,3vw,2.5rem)]">
              <p className="mb-2 font-mono text-[0.7rem] uppercase tracking-[0.08em] text-[#3f665e]">Your data</p>
              <h2 className="text-[1.4rem] font-semibold tracking-[-0.045em]">Export</h2>
              <p className="mt-4 text-sm leading-6 text-muted-foreground">Download a complete JSON archive or a spreadsheet-ready transaction CSV.</p>
              <div className="mt-4 grid gap-2 sm:grid-cols-2"><Button nativeButton={false} render={<a href="/api/export?format=json" />} variant="secondary">Download JSON</Button><Button nativeButton={false} render={<a href="/api/export?format=csv" />} variant="secondary">Download CSV</Button></div>
            </Card>
            <Card className="border-destructive p-[clamp(1.5rem,3vw,2.5rem)]">
              <p className="mb-2 font-mono text-[0.7rem] uppercase tracking-[0.08em] text-destructive">Danger zone</p>
              <h2 className="text-[1.4rem] font-semibold tracking-[-0.045em]">Reset or delete</h2>
              <p className="mt-4 text-sm leading-6 text-muted-foreground">Resetting removes all financial records and review history but keeps your account and parties. Account deletion removes the entire workspace and cannot proceed while a paid subscription is active.</p>
              <Label className="mt-4 block"><span className="mb-[0.45rem] block">Current password</span><Input value={password} onChange={(event) => setPassword(event.target.value)} type="password" autoComplete="current-password" disabled={destructiveAction !== null} /></Label>
              <AlertDialog open={pendingDestructiveAction !== null} onOpenChange={(open) => { if (!open && destructiveAction === null) setPendingDestructiveAction(null); }}>
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  <AlertDialogTrigger render={<Button variant="secondary" type="button" disabled={!password || destructiveAction !== null} onClick={() => setPendingDestructiveAction("reset")} />}>Reset financial plan</AlertDialogTrigger>
                  <AlertDialogTrigger render={<Button variant="destructive" type="button" disabled={!password || destructiveAction !== null} onClick={() => setPendingDestructiveAction("delete")} />}>Delete account</AlertDialogTrigger>
                </div>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Confirm {pendingDestructiveAction === "delete" ? "account deletion" : "financial plan reset"}</AlertDialogTitle>
                    <AlertDialogDescription>{pendingDestructiveAction === "delete" ? "Permanently delete your Finvayo account and all workspace data?" : "Delete all financial records and review history?"} This cannot be undone.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <p className={`min-h-5 text-xs ${dataMessage ? "text-destructive" : "text-[#225c50]"}`} role="status" aria-live="polite">{dataMessage}</p>
                  <AlertDialogFooter className="gap-2">
                    <AlertDialogAction variant="destructive" type="button" disabled={destructiveAction !== null} onClick={(event) => { event.preventDefault(); void confirmDestructiveAction(); }}>{destructiveAction ? "Working..." : "Confirm"}</AlertDialogAction>
                    <AlertDialogCancel variant="secondary" type="button" disabled={destructiveAction !== null}>Cancel</AlertDialogCancel>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              {!pendingDestructiveAction ? <p className={`mt-3 min-h-5 text-xs ${dataMessage ? "text-destructive" : "text-[#225c50]"}`} role="status" aria-live="polite">{dataMessage}</p> : null}
            </Card>
          </div>
        </section>
      </main>
    </AppShell>
  );
}

export default SettingsPage;
