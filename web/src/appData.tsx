import type { ReactNode } from "react";

import { Badge } from "./components/ui/badge";
import { Button } from "./components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./components/ui/card";
import { money } from "./utils";

export type Direction = "inflow" | "outflow";
export type Timing = "recorded" | "planned";
export type PartyRole = "customer" | "supplier" | "both";
export type CashEntry = { id: string; direction: Direction; name: string; amountMinor: number; actualAmountMinor?: number | null; actualDate?: string | null; scheduledDate: string; status: string; storedStatus?: string; included?: boolean; partyId?: string | null; partyName?: string | null; clientName?: string | null; invoiceReference?: string | null; category?: string | null; recurrence?: string | null };
export type Party = { id: string; name: string; role: PartyRole; email?: string | null; phone?: string | null; notes?: string | null };
export type ForecastPoint = { date: string; balanceMinor: number; protectedMinor: number };
export type ForecastEvent = { date: string; name: string; direction: Direction; amountMinor: number };
export type Overview = { safeToSpendMinor: number; currentCashMinor: number; taxReserveMinor: number; minimumBufferMinor: number; protectedMinor: number; risk: "normal" | "caution" | "at_risk"; provisional?: boolean; horizonStart: string; horizonEnd: string; firstBreachDate?: string | null; firstNegativeDate?: string | null; lowestBalanceMinor: number; lowestHeadroomMinor: number; limitingDate: string; points: ForecastPoint[]; events: ForecastEvent[]; recommendation: { type: string; title: string; detail: string; amountMinor: number | null } };
export type Financials = { entries: CashEntry[]; overview: Overview | null; currency?: string };
export type Workflows = { lastReview?: { completedAt: number; summary: string } | null };

export const categories: Record<Direction, [string, string][]> = {
  inflow: [["service_income", "Service income"], ["product_sales", "Product sales"], ["retainer_income", "Retainer income"], ["commission_income", "Commission income"], ["interest_income", "Interest income"], ["refund_received", "Refund received"], ["grant_income", "Grant income"], ["loan_proceeds", "Loan proceeds"], ["owner_contribution", "Owner contribution"], ["asset_sale", "Asset sale"], ["transfer_in", "Transfer in"], ["other_income", "Other income"]],
  outflow: [["contractors", "Contractors"], ["payroll_owner_pay", "Payroll / owner pay"], ["inventory", "Inventory / materials"], ["software", "Software"], ["subscriptions", "Subscriptions"], ["rent", "Rent"], ["utilities", "Utilities"], ["insurance", "Insurance"], ["professional_services", "Professional services"], ["marketing", "Marketing"], ["advertising", "Advertising"], ["travel", "Travel"], ["meals", "Meals"], ["office_supplies", "Office supplies"], ["equipment", "Equipment"], ["repairs_maintenance", "Repairs & maintenance"], ["shipping", "Shipping / postage"], ["vehicle", "Vehicle"], ["training", "Training / education"], ["licenses_permits", "Licenses / permits"], ["bank_fees", "Bank fees"], ["payment_processing_fees", "Payment processing fees"], ["tax", "Tax"], ["debt", "Debt interest"], ["loan_repayment", "Loan repayment"], ["owner_draw", "Owner draw"], ["refunds", "Customer refunds"], ["charitable_giving", "Charitable giving"], ["transfer_out", "Transfer out"], ["other", "Other"]],
};

export const today = () => new Date().toISOString().slice(0, 10);
export const validPositiveAmount = (value: string) => /^\d+(?:\.\d{1,2})?$/.test(value) && Number(value) > 0;
export const validIsoDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
export const daysBetween = (date: string, start: string) => Math.round((new Date(`${date}T00:00:00Z`).getTime() - new Date(`${start}T00:00:00Z`).getTime()) / 86_400_000);
export const fail = (error: unknown, fallback: string) => error instanceof Error ? error.message : fallback;
export const emptyTransaction = () => ({ direction: "inflow" as Direction, timing: "recorded" as Timing, name: "", amount: "", date: today(), partyId: "", invoiceReference: "", category: "service_income", status: "expected", recurring: false });

export const previewOverview: Overview = {
  safeToSpendMinor: 428000, currentCashMinor: 1142000, taxReserveMinor: 210000, minimumBufferMinor: 200000, protectedMinor: 410000, risk: "normal", horizonStart: today(), horizonEnd: "90 days from today", lowestBalanceMinor: 594000, lowestHeadroomMinor: 184000, limitingDate: "in 40 days",
  points: [{ date: today(), balanceMinor: 1142000, protectedMinor: 410000 }, { date: new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10), balanceMinor: 930000, protectedMinor: 410000 }, { date: new Date(Date.now() + 60 * 86_400_000).toISOString().slice(0, 10), balanceMinor: 594000, protectedMinor: 410000 }, { date: new Date(Date.now() + 90 * 86_400_000).toISOString().slice(0, 10), balanceMinor: 780000, protectedMinor: 410000 }],
  events: [{ date: new Date(Date.now() + 4 * 86_400_000).toISOString().slice(0, 10), name: "Northstar retainer", direction: "inflow", amountMinor: 320000 }, { date: new Date(Date.now() + 9 * 86_400_000).toISOString().slice(0, 10), name: "Contractor payment", direction: "outflow", amountMinor: 145000 }],
  recommendation: { type: "Invoice follow-up", title: "Acme Studio is 8 days overdue.", detail: "INV-024", amountMinor: 240000 },
};

export const previewEntries: CashEntry[] = [{ id: "preview-income", direction: "inflow", name: "Acme Studio project", amountMinor: 240000, scheduledDate: today(), status: "overdue", included: true, partyName: "Acme Studio", invoiceReference: "INV-024", category: "service_income" }, { id: "preview-expense", direction: "outflow", name: "Design software", amountMinor: 4900, actualAmountMinor: 4900, scheduledDate: today(), status: "paid", partyName: "Creative Cloud", category: "software" }];

export type CategoryActivity = { category: string; label: string; amountMinor: number; count: number };

export function categoryActivity(entries: CashEntry[], direction: Direction): CategoryActivity[] {
  const labels = new Map(categories[direction]);
  const totals = new Map<string, CategoryActivity>();
  for (const entry of entries) {
    if (entry.direction !== direction) continue;
    const category = entry.category || (direction === "inflow" ? "other_income" : "other");
    const current = totals.get(category) ?? {
      category,
      label: labels.get(category) || category.replaceAll("_", " ").replace(/^./, (character) => character.toUpperCase()),
      amountMinor: 0,
      count: 0,
    };
    current.amountMinor += entry.status === "paid" && entry.actualAmountMinor != null ? entry.actualAmountMinor : entry.amountMinor;
    current.count += 1;
    totals.set(category, current);
  }
  return [...totals.values()].sort((first, second) => second.amountMinor - first.amountMinor);
}

export function PageHeader({ kicker, title, children }: { kicker: string; title: string; children?: ReactNode }) {
  return <header className="flex flex-col gap-5 border-b border-foreground pb-6 sm:flex-row sm:items-end sm:justify-between"><div><p className="mb-2 font-mono text-[0.68rem] font-medium uppercase tracking-[0.12em] text-muted-foreground">{kicker}</p><h1 className="font-serif text-4xl leading-none tracking-[-0.04em] sm:text-5xl">{title}</h1></div>{children}</header>;
}

export function UpcomingLedger({ overview, currency, compact = false }: { overview: Overview | null; currency: string; compact?: boolean }) {
  const upcoming = overview?.events.filter((entry) => daysBetween(entry.date, overview.horizonStart) <= 14).slice(0, compact ? 3 : 8) ?? [];
  return <article><Card><CardHeader className="flex-row items-end justify-between gap-4 border-b"><div><p className="mb-2 font-mono text-[0.68rem] font-medium uppercase tracking-[0.12em] text-muted-foreground">Coming up</p><CardTitle className="text-2xl">Next 14 days</CardTitle></div><Button nativeButton={false} render={<a href="/app/transactions" />} variant="link">Manage entries</Button></CardHeader><CardContent className="p-0">{!overview ? <p className="p-6 text-sm leading-6 text-muted-foreground">No forecast is available until current cash is confirmed.</p> : upcoming.length === 0 ? <p className="p-6 text-sm leading-6 text-muted-foreground">No projected payments or expenses in the next 14 days.</p> : upcoming.map((entry, index) => { const days = daysBetween(entry.date, overview.horizonStart); return <div className="grid grid-cols-[3.5rem_minmax(0,1fr)] items-center gap-x-4 gap-y-2 border-b p-4 last:border-b-0 sm:grid-cols-[4rem_minmax(0,1fr)_auto] sm:px-6" key={`${entry.date}-${index}`}><time className="row-span-2 flex flex-col font-mono text-xs uppercase text-muted-foreground" dateTime={entry.date}><strong className="text-base text-foreground">{days === 0 ? "Now" : `+${days}`}</strong><span>{days === 0 ? "" : "days"}</span></time><div className="min-w-0"><strong className="block truncate text-sm">{entry.name}</strong><Badge className="mt-1" variant={entry.direction === "inflow" ? "success" : "outline"}>{entry.direction === "inflow" ? "Projected income" : "Planned expense"}</Badge></div><b className={`col-start-2 font-mono text-sm sm:col-start-3 sm:row-start-1 ${entry.direction === "inflow" ? "text-[#225c50]" : "text-foreground"}`}>{entry.direction === "inflow" ? "+" : "−"}{money(entry.amountMinor, currency)}</b></div>; })}</CardContent></Card></article>;
}

export function transactionLabel(entry: CashEntry) {
  const category = categories[entry.direction].find(([value]) => value === entry.category)?.[1] || entry.category?.replaceAll("_", " ");
  return [entry.partyName || entry.clientName, category, entry.invoiceReference].filter(Boolean).join(" · ") || (entry.direction === "inflow" ? "Payment received" : "Expense paid");
}
