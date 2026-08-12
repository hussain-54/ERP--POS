-- Phase 8: POS payments — walk-in receipts + installment frequency / late fee

do $$
declare
  cname text;
begin
  for cname in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public'
      and rel.relname = 'payments'
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ilike '%party_type%'
  loop
    execute format('alter table public.payments drop constraint %I', cname);
  end loop;
end $$;

alter table public.payments
  add constraint payments_party_check check (
    (party_type = 'customer' and supplier_id is null)
    or (party_type = 'supplier' and supplier_id is not null and customer_id is null)
  );

alter table public.installment_plans
  add column if not exists frequency text not null default 'monthly';

alter table public.installment_plans
  drop constraint if exists installment_plans_frequency_check;

alter table public.installment_plans
  add constraint installment_plans_frequency_check
  check (frequency in ('weekly','biweekly','monthly','quarterly'));

alter table public.installment_plans
  add column if not exists late_fee_percent numeric(8,2) not null default 0;

alter table public.installment_plans
  add column if not exists late_fee_fixed numeric(18,2) not null default 0;

alter table public.installment_schedule
  add column if not exists late_fee numeric(18,2) not null default 0;
