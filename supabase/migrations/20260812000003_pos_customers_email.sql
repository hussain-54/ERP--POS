-- Phase 7: POS customer email field (shared customers table — no separate POS records)

alter table public.customers
  add column if not exists email text;

comment on column public.customers.email is 'Optional customer email; not required for walk-in sales';
