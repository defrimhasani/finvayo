ALTER TABLE cash_entries ADD COLUMN transaction_category TEXT CHECK (
  transaction_category IS NULL OR transaction_category IN (
    'service_income', 'product_sales', 'retainer_income', 'commission_income', 'interest_income',
    'refund_received', 'grant_income', 'loan_proceeds', 'owner_contribution', 'asset_sale',
    'transfer_in', 'other_income',
    'contractors', 'payroll_owner_pay', 'inventory', 'software', 'subscriptions', 'rent',
    'utilities', 'insurance', 'professional_services', 'marketing', 'advertising', 'travel',
    'meals', 'office_supplies', 'equipment', 'repairs_maintenance', 'shipping', 'vehicle',
    'training', 'licenses_permits', 'bank_fees', 'payment_processing_fees', 'tax', 'debt',
    'loan_repayment', 'owner_draw', 'refunds', 'charitable_giving', 'transfer_out', 'other'
  )
);
