-- Phase 17: targeted performance indexes for realistic ERP volumes.
-- Added only where query patterns (reports, POS lookup, ledger timelines) justify them.

-- Invoice line reporting / product analytics (50k–500k sale_items)
create index if not exists sale_items_org_product_idx
  on public.sale_items (organization_id, product_id)
  where product_id is not null;

-- Customer search at 50k+ parties (name path; mobile already indexed)
create index if not exists customers_org_name_idx
  on public.customers (organization_id, name)
  where deleted_at is null;

-- Org-wide stock movement timelines (100k+ movements)
create index if not exists stock_movements_org_occurred_idx
  on public.stock_movements (organization_id, occurred_at desc);

-- Purchase line product analytics
create index if not exists purchase_items_org_product_idx
  on public.purchase_items (organization_id, product_id);

-- Installment due-date sweeps
create index if not exists installment_schedule_due_idx
  on public.installment_schedule (organization_id, due_date)
  where status in ('pending', 'partial', 'overdue');
