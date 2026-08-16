-- Require and persist weekly opening hours in scraper-owned restaurant snapshots.

create or replace function public.food_scraper_sync_catalog(
  p_restaurant jsonb,
  p_items jsonb,
  p_allow_large_change boolean default false,
  p_dry_run boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_restaurant_id uuid;
  v_restaurant_key text;
  v_item_count integer;
  v_valid_count integer;
  v_distinct_count integer;
  v_existing_payload_count integer;
  v_existing_available_count integer;
  v_deactivated_count integer;
  v_item_keys text[];
begin
  if auth.role() is distinct from 'service_role' then
    raise exception using errcode = '42501', message = 'FOOD_SCRAPER_FORBIDDEN';
  end if;

  if jsonb_typeof(p_restaurant) <> 'object'
    or jsonb_typeof(p_items) <> 'array'
    or p_allow_large_change is null
    or p_dry_run is null then
    raise exception using errcode = 'P0001', message = 'FOOD_SCRAPER_INVALID_INPUT';
  end if;

  v_restaurant_key := btrim(p_restaurant->>'scraper_key');
  if v_restaurant_key is null
    or length(v_restaurant_key) not between 1 and 240
    or length(btrim(p_restaurant->>'name')) not between 1 and 160
    or length(coalesce(p_restaurant->>'description', '')) > 1000
    or length(coalesce(p_restaurant->>'image_url', '')) > 2000
    or length(coalesce(p_restaurant->>'source_url', '')) > 2000
    or (
      p_restaurant ? 'source_metadata'
      and jsonb_typeof(p_restaurant->'source_metadata') <> 'object'
    )
    or jsonb_typeof(p_restaurant->'opening_hours') <> 'array'
    or jsonb_array_length(p_restaurant->'opening_hours') not between 1 and 7
    or not food.food_valid_opening_hours(p_restaurant->'opening_hours') then
    raise exception using errcode = 'P0001', message = 'FOOD_SCRAPER_INVALID_INPUT';
  end if;

  begin
    select
      count(*),
      count(*) filter (
        where length(btrim(x.scraper_key)) between 1 and 240
          and length(btrim(x.category)) between 1 and 100
          and length(btrim(x.name)) between 1 and 180
          and length(coalesce(x.description, '')) <= 1200
          and x.price_cents between 0 and 1000000
          and coalesce(x.currency, 'EUR') = 'EUR'
          and length(coalesce(x.image_url, '')) <= 2000
          and length(coalesce(x.source_url, '')) <= 2000
          and (x.source_metadata is null or jsonb_typeof(x.source_metadata) = 'object')
      ),
      count(distinct btrim(x.scraper_key)),
      array_agg(btrim(x.scraper_key) order by coalesce(x.sort_order, 0), btrim(x.name))
    into v_item_count, v_valid_count, v_distinct_count, v_item_keys
    from jsonb_to_recordset(p_items) as x(
      scraper_key text,
      category text,
      name text,
      description text,
      price_cents integer,
      currency text,
      image_url text,
      source_url text,
      source_metadata jsonb,
      sort_order integer
    );
  exception when invalid_text_representation or data_exception then
    raise exception using errcode = 'P0001', message = 'FOOD_SCRAPER_INVALID_INPUT';
  end;

  if v_item_count < 1
    or v_valid_count <> v_item_count
    or v_distinct_count <> v_item_count then
    raise exception using errcode = 'P0001', message = 'FOOD_SCRAPER_INVALID_INPUT';
  end if;

  select id into v_restaurant_id
  from food.restaurants
  where scraper_key = v_restaurant_key;

  if v_restaurant_id is not null then
    select count(*) into v_existing_available_count
    from food.menu_items
    where restaurant_id = v_restaurant_id and is_available;

    select count(*) into v_existing_payload_count
    from food.menu_items
    where restaurant_id = v_restaurant_id
      and scraper_key = any(v_item_keys);

    select count(*) into v_deactivated_count
    from food.menu_items
    where restaurant_id = v_restaurant_id
      and is_available
      and not (scraper_key = any(v_item_keys));
  else
    v_existing_available_count := 0;
    v_existing_payload_count := 0;
    v_deactivated_count := 0;
  end if;

  if not p_allow_large_change
    and v_existing_available_count > 0
    and v_item_count * 2 < v_existing_available_count then
    raise exception using errcode = 'P0001', message = 'FOOD_CATALOG_LARGE_CHANGE';
  end if;

  if p_dry_run then
    return jsonb_build_object(
      'restaurant_id', v_restaurant_id,
      'dry_run', true,
      'inserted', v_item_count - v_existing_payload_count,
      'updated', v_existing_payload_count,
      'deactivated', v_deactivated_count,
      'total', v_item_count,
      'opening_hours_days', jsonb_array_length(p_restaurant->'opening_hours')
    );
  end if;

  insert into food.restaurants (
    scraper_key, name, description, image_url, source_url, opening_hours,
    source_metadata, is_available, scraped_at
  ) values (
    v_restaurant_key,
    btrim(p_restaurant->>'name'),
    nullif(btrim(p_restaurant->>'description'), ''),
    nullif(btrim(p_restaurant->>'image_url'), ''),
    nullif(btrim(p_restaurant->>'source_url'), ''),
    p_restaurant->'opening_hours',
    coalesce(p_restaurant->'source_metadata', '{}'::jsonb),
    true,
    v_now
  )
  on conflict (scraper_key) do update set
    name = excluded.name,
    description = excluded.description,
    image_url = excluded.image_url,
    source_url = excluded.source_url,
    opening_hours = excluded.opening_hours,
    source_metadata = excluded.source_metadata,
    is_available = true,
    scraped_at = excluded.scraped_at,
    updated_at = v_now
  returning id into v_restaurant_id;

  insert into food.menu_items (
    restaurant_id, scraper_key, category, name, description, price_cents,
    currency, image_url, source_url, source_metadata, is_available,
    sort_order, scraped_at
  )
  select
    v_restaurant_id,
    btrim(x.scraper_key),
    btrim(x.category),
    btrim(x.name),
    nullif(btrim(x.description), ''),
    x.price_cents,
    coalesce(x.currency, 'EUR'),
    nullif(btrim(x.image_url), ''),
    nullif(btrim(x.source_url), ''),
    coalesce(x.source_metadata, '{}'::jsonb),
    true,
    coalesce(x.sort_order, 0),
    v_now
  from jsonb_to_recordset(p_items) as x(
    scraper_key text,
    category text,
    name text,
    description text,
    price_cents integer,
    currency text,
    image_url text,
    source_url text,
    source_metadata jsonb,
    sort_order integer
  )
  on conflict (restaurant_id, scraper_key) do update set
    category = excluded.category,
    name = excluded.name,
    description = excluded.description,
    price_cents = excluded.price_cents,
    currency = excluded.currency,
    image_url = excluded.image_url,
    source_url = excluded.source_url,
    source_metadata = excluded.source_metadata,
    is_available = true,
    sort_order = excluded.sort_order,
    scraped_at = excluded.scraped_at,
    updated_at = v_now;

  update food.menu_items
  set is_available = false, scraped_at = v_now, updated_at = v_now
  where restaurant_id = v_restaurant_id
    and is_available
    and not (scraper_key = any(v_item_keys));
  get diagnostics v_deactivated_count = row_count;

  return jsonb_build_object(
    'restaurant_id', v_restaurant_id,
    'scraped_at', v_now,
    'dry_run', false,
    'inserted', v_item_count - v_existing_payload_count,
    'updated', v_existing_payload_count,
    'deactivated', v_deactivated_count,
    'total', v_item_count,
    'opening_hours_days', jsonb_array_length(p_restaurant->'opening_hours')
  );
end;
$$;

revoke all on function public.food_scraper_sync_catalog(jsonb, jsonb, boolean, boolean)
  from public, anon, authenticated;
grant execute on function public.food_scraper_sync_catalog(jsonb, jsonb, boolean, boolean)
  to service_role;

comment on function public.food_scraper_sync_catalog(jsonb, jsonb, boolean, boolean) is
  'Atomically validates and publishes scraper restaurant data, opening hours, and menu items.';
