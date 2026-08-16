-- Structured weekly opening hours, maintained by food administrators and
-- exposed through the existing presentation-only restaurant functions.

create or replace function food.food_valid_opening_hours(p_value jsonb)
returns boolean
language plpgsql
immutable
set search_path = pg_catalog, public
as $$
declare
  v_entry jsonb;
  v_period jsonb;
  v_day integer;
  v_days integer[] := array[]::integer[];
begin
  if jsonb_typeof(p_value) <> 'array' or jsonb_array_length(p_value) > 7 then
    return false;
  end if;

  for v_entry in select value from jsonb_array_elements(p_value)
  loop
    if jsonb_typeof(v_entry) <> 'object'
      or not (v_entry ? 'day')
      or not (v_entry ? 'periods')
      or jsonb_typeof(v_entry->'periods') <> 'array'
      or jsonb_array_length(v_entry->'periods') > 4 then
      return false;
    end if;

    v_day := (v_entry->>'day')::integer;
    if v_day not between 1 and 7 or v_day = any(v_days) then return false; end if;
    v_days := array_append(v_days, v_day);

    for v_period in select value from jsonb_array_elements(v_entry->'periods')
    loop
      if jsonb_typeof(v_period) <> 'object'
        or coalesce(v_period->>'open', '') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
        or coalesce(v_period->>'close', '') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
        or v_period->>'open' = v_period->>'close' then
        return false;
      end if;
    end loop;
  end loop;
  return true;
exception when invalid_text_representation or numeric_value_out_of_range then
  return false;
end;
$$;

alter table food.restaurants
  add column opening_hours jsonb not null default '[]'::jsonb,
  add constraint restaurants_opening_hours_valid
    check (food.food_valid_opening_hours(opening_hours));

create or replace function public.food_active_menu()
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select jsonb_build_object(
    'cycle', jsonb_build_object(
      'id', c.id,
      'status', c.status,
      'opened_at', c.opened_at
    ),
    'restaurant', jsonb_build_object(
      'id', r.id,
      'name', r.name,
      'description', r.description,
      'image_url', r.image_url,
      'source_url', r.source_url,
      'opening_hours', r.opening_hours
    ),
    'menu_items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', mi.id,
        'restaurant_id', mi.restaurant_id,
        'category', mi.category,
        'name', mi.name,
        'description', mi.description,
        'price_cents', mi.price_cents,
        'currency', mi.currency,
        'image_url', mi.image_url,
        'available', mi.is_available
      ) order by mi.category, mi.sort_order, mi.name)
      from food.menu_items mi
      where mi.restaurant_id = c.restaurant_id and mi.is_available
    ), '[]'::jsonb)
  )
  from food.order_cycles c
  join food.restaurants r on r.id = c.restaurant_id
  where c.status = 'open'
  limit 1;
$$;

create or replace function public.food_restaurant_options()
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', r.id,
    'name', r.name,
    'description', r.description,
    'image_url', r.image_url,
    'source_url', r.source_url,
    'opening_hours', r.opening_hours,
    'available_items', (
      select count(*) from food.menu_items mi
      where mi.restaurant_id = r.id and mi.is_available
    )
  ) order by r.name), '[]'::jsonb)
  from food.restaurants r
  where r.is_available
    and r.source_url is not null
    and exists (
      select 1 from food.menu_items mi
      where mi.restaurant_id = r.id and mi.is_available
    );
$$;

create or replace function public.food_admin_catalog()
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  v_result jsonb;
begin
  perform food._food_require_admin();
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', r.id,
    'name', r.name,
    'description', r.description,
    'image_url', r.image_url,
    'source_url', r.source_url,
    'opening_hours', r.opening_hours,
    'available_items', (select count(*) from food.menu_items mi where mi.restaurant_id = r.id and mi.is_available)
  ) order by r.name), '[]'::jsonb)
  into v_result
  from food.restaurants r
  where r.is_available
    and exists (select 1 from food.menu_items mi where mi.restaurant_id = r.id and mi.is_available);
  return v_result;
end;
$$;

create or replace function public.food_admin_update_restaurant_hours(
  p_restaurant_id uuid,
  p_opening_hours jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_result jsonb;
begin
  perform food._food_require_admin();
  if p_opening_hours is null or not food.food_valid_opening_hours(p_opening_hours) then
    raise exception using errcode = 'P0001', message = 'FOOD_INVALID_INPUT';
  end if;

  update food.restaurants r
  set opening_hours = p_opening_hours
  where r.id = p_restaurant_id;

  if not found then
    raise exception using errcode = 'P0001', message = 'FOOD_INVALID_INPUT';
  end if;

  select jsonb_build_object(
    'id', r.id,
    'name', r.name,
    'description', r.description,
    'image_url', r.image_url,
    'source_url', r.source_url,
    'opening_hours', r.opening_hours,
    'available_items', (select count(*) from food.menu_items mi where mi.restaurant_id = r.id and mi.is_available)
  ) into v_result
  from food.restaurants r
  where r.id = p_restaurant_id;
  return v_result;
end;
$$;

revoke all on function food.food_valid_opening_hours(jsonb) from public, anon, authenticated;
grant execute on function food.food_valid_opening_hours(jsonb) to service_role;
revoke all on function public.food_admin_update_restaurant_hours(uuid, jsonb) from public;
grant execute on function public.food_admin_update_restaurant_hours(uuid, jsonb) to authenticated;

comment on column food.restaurants.opening_hours is
  'ISO weekday (1=Monday, 7=Sunday) opening periods in Atlantic/Canary local time.';
comment on function public.food_admin_update_restaurant_hours(uuid, jsonb) is
  'Admin-only update for a restaurant weekly opening schedule.';
