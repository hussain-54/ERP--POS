-- POS search / hydration indexes (performance)
-- Supports batched product search without full-table scans on hot paths.

create index if not exists products_org_updated_idx
  on public.products (organization_id, updated_at desc)
  where deleted_at is null and is_active = true;

create index if not exists products_org_sku_trgm_ready_idx
  on public.products (organization_id, sku)
  where deleted_at is null;

create index if not exists products_org_product_code_idx
  on public.products (organization_id, product_code)
  where deleted_at is null;

create index if not exists barcodes_org_code_idx
  on public.barcodes (organization_id, code)
  where deleted_at is null;

create index if not exists stock_balances_warehouse_product_idx
  on public.stock_balances (warehouse_id, product_id);

create index if not exists held_sales_branch_status_held_at_idx
  on public.held_sales (organization_id, branch_id, status, held_at desc);
