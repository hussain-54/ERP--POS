-- Phase 3B: atomic stock_movements insert + stock_balances update (same Postgres transaction).
-- Conversion to base units stays in the application (domain convertQuantity / qtyToBaseUnits).
-- SECURITY INVOKER: RLS still applies as the calling user.

create or replace function public.apply_stock_movement_atomic(
  p_movement jsonb,
  p_balance_id uuid,
  p_expected_version integer,
  p_qty_on_hand numeric,
  p_qty_reserved numeric,
  p_qty_damaged numeric,
  p_qty_in_transit numeric,
  p_average_unit_cost numeric,
  p_occurred_at timestamptz
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_org uuid := public.current_organization_id();
  v_row public.stock_movements%rowtype;
  v_updated integer;
  v_op uuid;
begin
  if v_org is null then
    raise exception 'organization required';
  end if;
  if (p_movement->>'organization_id')::uuid is distinct from v_org then
    raise exception 'organization mismatch';
  end if;

  v_op := nullif(p_movement->>'operation_id', '')::uuid;

  begin
    insert into public.stock_movements (
      organization_id,
      branch_id,
      warehouse_id,
      product_id,
      variant_id,
      batch_id,
      serial_number_id,
      unit_id,
      movement_type,
      qty_delta,
      qty_before,
      qty_after,
      unit_cost,
      source_type,
      source_id,
      reason,
      occurred_at,
      device_id,
      offline_transaction_id,
      operation_id,
      sync_state,
      created_by
    ) values (
      v_org,
      (p_movement->>'branch_id')::uuid,
      (p_movement->>'warehouse_id')::uuid,
      (p_movement->>'product_id')::uuid,
      nullif(p_movement->>'variant_id', '')::uuid,
      nullif(p_movement->>'batch_id', '')::uuid,
      nullif(p_movement->>'serial_number_id', '')::uuid,
      (p_movement->>'unit_id')::uuid,
      p_movement->>'movement_type',
      (p_movement->>'qty_delta')::numeric,
      (p_movement->>'qty_before')::numeric,
      (p_movement->>'qty_after')::numeric,
      nullif(p_movement->>'unit_cost', '')::numeric,
      p_movement->>'source_type',
      (p_movement->>'source_id')::uuid,
      nullif(p_movement->>'reason', ''),
      p_occurred_at,
      nullif(p_movement->>'device_id', ''),
      nullif(p_movement->>'offline_transaction_id', '')::uuid,
      v_op,
      coalesce(nullif(p_movement->>'sync_state', ''), 'synced'),
      nullif(p_movement->>'created_by', '')::uuid
    )
    returning * into v_row;
  exception
    when unique_violation then
      if v_op is not null then
        select * into v_row
        from public.stock_movements
        where organization_id = v_org
          and operation_id = v_op
        limit 1;
        if found then
          return to_jsonb(v_row);
        end if;
      end if;
      raise;
  end;

  update public.stock_balances
  set
    qty_on_hand = p_qty_on_hand,
    qty_reserved = p_qty_reserved,
    qty_damaged = p_qty_damaged,
    qty_in_transit = p_qty_in_transit,
    average_unit_cost = p_average_unit_cost,
    last_movement_at = p_occurred_at,
    updated_at = now(),
    version = p_expected_version + 1
  where id = p_balance_id
    and organization_id = v_org
    and version = p_expected_version;

  get diagnostics v_updated = row_count;
  if v_updated <> 1 then
    raise exception 'Concurrent stock update conflict';
  end if;

  return to_jsonb(v_row);
end;
$$;

revoke all on function public.apply_stock_movement_atomic(
  jsonb, uuid, integer, numeric, numeric, numeric, numeric, numeric, timestamptz
) from public;

grant execute on function public.apply_stock_movement_atomic(
  jsonb, uuid, integer, numeric, numeric, numeric, numeric, numeric, timestamptz
) to authenticated;

grant execute on function public.apply_stock_movement_atomic(
  jsonb, uuid, integer, numeric, numeric, numeric, numeric, numeric, timestamptz
) to service_role;

comment on function public.apply_stock_movement_atomic(
  jsonb, uuid, integer, numeric, numeric, numeric, numeric, numeric, timestamptz
) is 'Phase 3B: insert stock_movements and update stock_balances in one transaction. Qty must already be product base units.';
