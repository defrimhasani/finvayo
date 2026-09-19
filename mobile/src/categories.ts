import type { Direction } from "./types";

export const categories: Record<Direction, Array<[string, string]>> = {
  inflow: [
    ["service_income", "Service income"],
    ["product_sales", "Product sales"],
    ["retainer_income", "Retainer income"],
    ["commission_income", "Commission income"],
    ["interest_income", "Interest income"],
    ["refund_received", "Refund received"],
    ["grant_income", "Grant income"],
    ["loan_proceeds", "Loan proceeds"],
    ["owner_contribution", "Owner contribution"],
    ["asset_sale", "Asset sale"],
    ["transfer_in", "Transfer in"],
    ["other_income", "Other income"],
  ],
  outflow: [
    ["contractors", "Contractors"],
    ["payroll_owner_pay", "Payroll / owner pay"],
    ["inventory", "Inventory / materials"],
    ["software", "Software"],
    ["subscriptions", "Subscriptions"],
    ["rent", "Rent"],
    ["utilities", "Utilities"],
    ["insurance", "Insurance"],
    ["professional_services", "Professional services"],
    ["marketing", "Marketing"],
    ["advertising", "Advertising"],
    ["travel", "Travel"],
    ["meals", "Meals"],
    ["office_supplies", "Office supplies"],
    ["equipment", "Equipment"],
    ["repairs_maintenance", "Repairs & maintenance"],
    ["shipping", "Shipping / postage"],
    ["vehicle", "Vehicle"],
    ["training", "Training / education"],
    ["licenses_permits", "Licenses / permits"],
    ["bank_fees", "Bank fees"],
    ["payment_processing_fees", "Payment processing fees"],
    ["tax", "Tax"],
    ["debt", "Debt interest"],
    ["loan_repayment", "Loan repayment"],
    ["owner_draw", "Owner draw"],
    ["refunds", "Customer refunds"],
    ["charitable_giving", "Charitable giving"],
    ["transfer_out", "Transfer out"],
    ["other", "Other"],
  ],
};

export function categoryLabel(direction: Direction, category: string | null): string {
  return categories[direction].find(([value]) => value === category)?.[1] || "Uncategorized";
}

export function defaultCategory(direction: Direction): string {
  return categories[direction][0]![0];
}
