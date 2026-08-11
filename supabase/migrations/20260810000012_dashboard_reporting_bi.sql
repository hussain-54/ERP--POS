-- Phase 12: Dashboard + Reporting + Business Intelligence permissions

insert into public.permissions (key, module, action, description) values
  ('dashboard.view', 'dashboard', 'view', 'View executive / role dashboard'),
  ('dashboard.view_finance', 'dashboard', 'view_finance', 'View finance KPIs on dashboard'),
  ('dashboard.view_all_branches', 'dashboard', 'view_all_branches', 'View dashboard across all branches'),
  ('reports.view', 'reports', 'view', 'View operational reports'),
  ('reports.export', 'reports', 'export', 'Export reports'),
  ('reports.sales', 'reports', 'sales', 'Sales reports'),
  ('reports.purchases', 'reports', 'purchases', 'Purchase reports'),
  ('reports.stock', 'reports', 'stock', 'Stock reports'),
  ('reports.profit', 'reports', 'profit', 'Profit reports'),
  ('reports.finance', 'reports', 'finance', 'Accounting / finance reports'),
  ('bi.view', 'bi', 'view', 'Business intelligence views'),
  ('bi.view_all_branches', 'bi', 'view_all_branches', 'BI across all branches')
on conflict (key) do nothing;

-- Helpful indexes for reporting date/branch filters
create index if not exists sales_posted_at_idx on public.sales (organization_id, posted_at desc)
  where status = 'posted';
create index if not exists purchases_posted_at_idx on public.purchases (organization_id, posted_at desc)
  where status = 'posted';
create index if not exists expenses_org_date_status_idx
  on public.expenses (organization_id, expense_date desc)
  where status = 'posted';
create index if not exists stock_balances_branch_wh_idx
  on public.stock_balances (organization_id, branch_id, warehouse_id);

comment on table public.sales is 'POS sales — reporting source for Phase 12 sales/profit/BI';
comment on table public.purchases is 'Purchases — reporting source for Phase 12 purchase/BI';
comment on table public.stock_balances is 'Stock balances — reporting source for Phase 12 stock/valuation';
