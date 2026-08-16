-- Store a cycle-level service fee at closure without allocating it to orders.

alter table food.order_cycles
  add column service_fee_cents integer not null default 0
  check (service_fee_cents between 0 and 1000000);

create or replace function food._food_cycle_summary(p_cycle_id uuid)
returns jsonb
language sql
security definer
set search_path = pg_catalog, public
as $$
  select jsonb_build_object(
    'cycle', jsonb_build_object(
      'id', c.id,
      'status', c.status,
      'opened_at', c.opened_at,
      'closed_at', c.closed_at,
      'service_fee_cents', c.service_fee_cents
    ),
    'id', c.id,
    'status', c.status,
    'opened_at', c.opened_at,
    'closed_at', c.closed_at,
    'restaurant', jsonb_build_object('id', r.id, 'name', r.name, 'image_url', r.image_url),
    'subtotal_cents', totals.subtotal_cents,
    'service_fee_cents', c.service_fee_cents,
    'total_cents', totals.subtotal_cents + c.service_fee_cents,
    'orders', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', o.id,
        'display_name', o.display_name,
        'note', o.note,
        'created_at', o.created_at,
        'updated_at', o.updated_at,
        'total_cents', coalesce((
          select sum(oi.quantity * oi.unit_price_cents)
          from food.order_items oi
          where oi.order_id = o.id
        ), 0),
        'items', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', oi.id,
            'menu_item_id', oi.menu_item_id,
            'item_name', oi.item_name,
            'unit_price_cents', oi.unit_price_cents,
            'currency', oi.currency,
            'quantity', oi.quantity,
            'note', oi.note
          ) order by oi.created_at)
          from food.order_items oi
          where oi.order_id = o.id
        ), '[]'::jsonb)
      ) order by o.created_at)
      from food.orders o
      where o.cycle_id = c.id
    ), '[]'::jsonb)
  )
  from food.order_cycles c
  join food.restaurants r on r.id = c.restaurant_id
  cross join lateral (
    select coalesce(sum(oi.quantity * oi.unit_price_cents), 0) as subtotal_cents
    from food.orders o
    join food.order_items oi on oi.order_id = o.id
    where o.cycle_id = c.id
  ) totals
  where c.id = p_cycle_id;
$$;

revoke all on function public.food_admin_close_cycle(uuid) from public, anon, authenticated;
drop function public.food_admin_close_cycle(uuid);

create function public.food_admin_close_cycle(
  p_cycle_id uuid,
  p_service_fee_cents integer default 0
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_status text;
begin
  perform food._food_require_admin();

  if p_service_fee_cents is null or p_service_fee_cents not between 0 and 1000000 then
    raise exception using errcode = 'P0001', message = 'FOOD_INVALID_INPUT';
  end if;

  select status into v_status
  from food.order_cycles
  where id = p_cycle_id
  for update;

  if v_status is null then
    raise exception using errcode = 'P0001', message = 'FOOD_NO_ACTIVE_CYCLE';
  end if;
  if v_status <> 'open' then
    raise exception using errcode = 'P0001', message = 'FOOD_CYCLE_CLOSED';
  end if;

  update food.order_cycles
  set status = 'closed', closed_at = now(), service_fee_cents = p_service_fee_cents
  where id = p_cycle_id;

  return food._food_cycle_summary(p_cycle_id);
end;
$$;

revoke all on function public.food_admin_close_cycle(uuid, integer) from public;
grant execute on function public.food_admin_close_cycle(uuid, integer) to authenticated;

comment on column food.order_cycles.service_fee_cents is
  'Cycle-level fee captured at closure. It contributes to the cycle total but is never allocated to employee orders.';
