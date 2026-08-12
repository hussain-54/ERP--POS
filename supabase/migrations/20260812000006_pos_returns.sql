-- Phase 11: Sales return / exchange — inspection, qty tracking, refund method, scope

alter table public.sale_returns
  add column if not exists return_scope text,
  add column if not exists reason_code text,
  add column if not exists refund_method text,
  add column if not exists warehouse_id uuid references public.warehouses(id),
  add column if not exists confirmation_notes text,
  add column if not exists posted_at timestamptz;

update public.sale_returns
set return_scope = coalesce(return_scope, 'partial'),
    posted_at = coalesce(posted_at, created_at)
where true;

do $$
declare cname text;
begin
  select con.conname into cname
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  join pg_namespace nsp on nsp.oid = rel.relnamespace
  where nsp.nspname = 'public' and rel.relname = 'sale_returns'
    and con.contype = 'c' and pg_get_constraintdef(con.oid) ilike '%return_scope%';
  if cname is not null then
    execute format('alter table public.sale_returns drop constraint %I', cname);
  end if;
end $$;

alter table public.sale_returns
  drop constraint if exists sale_returns_return_scope_check;
alter table public.sale_returns
  add constraint sale_returns_return_scope_check
  check (return_scope is null or return_scope in ('full','partial'));

alter table public.sale_returns
  drop constraint if exists sale_returns_reason_code_check;
alter table public.sale_returns
  add constraint sale_returns_reason_code_check
  check (reason_code is null or reason_code in ('damaged','wrong_product','defective','not_satisfied','other'));

alter table public.sale_returns
  drop constraint if exists sale_returns_refund_method_check;
alter table public.sale_returns
  add constraint sale_returns_refund_method_check
  check (refund_method is null or refund_method in ('cash','bank','customer_credit'));

alter table public.sale_return_items
  add column if not exists condition text,
  add column if not exists original_packaging boolean not null default true,
  add column if not exists accessories_complete boolean not null default true,
  add column if not exists inspection_notes text,
  add column if not exists batch_id uuid references public.stock_batches(id),
  add column if not exists restock_target text,
  add column if not exists restocked boolean not null default false;

alter table public.sale_return_items
  drop constraint if exists sale_return_items_condition_check;
alter table public.sale_return_items
  add constraint sale_return_items_condition_check
  check (condition is null or condition in ('good','opened','damaged','defective','incomplete'));

alter table public.sale_return_items
  drop constraint if exists sale_return_items_restock_target_check;
alter table public.sale_return_items
  add constraint sale_return_items_restock_target_check
  check (restock_target is null or restock_target in ('on_hand','damaged','none'));

create index if not exists sale_returns_original_sale_idx
  on public.sale_returns (original_sale_id, status);

create index if not exists sale_return_items_original_item_idx
  on public.sale_return_items (original_sale_item_id)
  where original_sale_item_id is not null;
