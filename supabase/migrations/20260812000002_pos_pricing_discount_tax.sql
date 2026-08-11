-- Phase 6: POS pricing / discount / tax permission ladder

insert into public.permissions (key, module, action, description) values
  ('pos.discount_supervisor', 'pos', 'discount_supervisor', 'Apply supervisor discounts up to 10%'),
  ('pos.discount_special', 'pos', 'discount_special', 'Apply special discounts above 50%')
on conflict (key) do nothing;

update public.permissions
set description = 'Apply manager discounts up to 20%'
where key = 'pos.discount_manager';

update public.permissions
set description = 'Apply owner discounts up to 50%'
where key = 'pos.discount_owner';
