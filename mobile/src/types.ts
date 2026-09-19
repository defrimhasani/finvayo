export type Risk = "normal" | "caution" | "at_risk";
export type Direction = "inflow" | "outflow";

export type CashEntry = {
  id: string;
  direction: Direction;
  name: string;
  amountMinor: number;
  scheduledDate: string;
  status: string;
  storedStatus: string;
  clientName: string | null;
  invoiceReference: string | null;
  category: string | null;
  recurrence: "monthly" | null;
  included: 0 | 1;
  actualAmountMinor: number | null;
  actualDate: string | null;
  completedAt: number | null;
  partyId: string | null;
  partyName: string | null;
  createdAt: number;
  updatedAt: number;
};

export type Overview = {
  safeToSpendMinor: number;
  currentCashMinor: number;
  minimumBufferMinor: number;
  taxReserveMinor: number;
  taxReserveMode: "fixed" | "percentage";
  taxRateBasisPoints: number;
  protectedMinor: number;
  lowestBalanceMinor: number;
  lowestHeadroomMinor: number;
  limitingDate: string;
  firstBreachDate: string | null;
  firstNegativeDate: string | null;
  risk: Risk;
  provisional: boolean;
  horizonStart: string;
  horizonEnd: string;
  points: Array<{ date: string; balanceMinor: number; protectedMinor: number }>;
  events: Array<{
    id: string;
    name: string;
    direction: Direction;
    amountMinor: number;
    date: string;
    status: string;
    partyName: string | null;
    invoiceReference: string | null;
    category: string | null;
  }>;
  recommendation: { type: string; title: string; amountMinor: number | null; detail: string };
};

export type Financials = {
  currency?: string;
  timezone?: string;
  snapshot: null | { id: string; balanceMinor: number; effectiveDate: string; confirmedAt: number };
  entries: CashEntry[];
  overview: Overview | null;
};

export type Settings = {
  name: string;
  currency: "USD" | "EUR" | "GBP";
  timezone: string;
  minimumBufferMinor: number;
  taxReserveMinor: number;
  taxReserveMode: "fixed" | "percentage";
  taxRateBasisPoints: number;
  paymentDelayDays: number;
  email: string;
  currencyLocked: 0 | 1;
};

export type Workflows = {
  lastReview: null | { id: string; summary: string; completedAt: number };
  followUps: Array<{ id: string; cashEntryId: string; tone: string; message: string; completedAt: number }>;
};

export type ScenarioResult = {
  amountMinor: number;
  date: string;
  lowestBalanceMinor: number;
  safeToSpendMinor: number;
  safeToSpendChangeMinor: number;
  risk: Risk;
  crossesProtectedLevel: boolean;
};

export type Party = {
  id: string;
  name: string;
  role: "customer" | "supplier" | "both";
  email: string | null;
  phone: string | null;
  notes: string | null;
};

export type InvoiceSummary = {
  id: string;
  invoiceNumber: string;
  issueDate: string;
  dueDate: string;
  status: string;
  totalMinor: number;
  customerName: string;
};

export type InvoiceItem = {
  id?: string;
  description: string;
  quantityMilli: number;
  unitPriceMinor: number;
  amountMinor: number;
  position?: number;
};

export type Invoice = InvoiceSummary & {
  subtotalMinor: number;
  taxRateBasisPoints: number;
  taxMinor: number;
  notes: string | null;
  sentAt: number | null;
  paidAt: number | null;
  paidDate: string | null;
  customerId: string;
  customerEmail: string | null;
  businessName: string;
  currency: string;
  timezone: string;
  items: InvoiceItem[];
};
