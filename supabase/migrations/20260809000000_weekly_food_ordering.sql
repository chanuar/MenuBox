-- Weekly food ordering for /food.
-- Catalog rows are owned by the scraper (service_role). Public and admin clients
-- use only the narrowly scoped functions granted at the end of this migration.

create extension if not exists pgcrypto with schema extensions;
create schema if not exists food;

revoke all on schema food from public, anon, authenticated;
grant usage on schema food to service_role;

create table food.food_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table food.restaurants (
  id uuid primary key default extensions.gen_random_uuid(),
  scraper_key text not null unique check (length(scraper_key) between 1 and 240),
  name text not null check (length(btrim(name)) between 1 and 160),
  description text check (description is null or length(description) <= 1000),
  image_url text check (image_url is null or length(image_url) <= 2000),
  source_url text check (source_url is null or length(source_url) <= 2000),
  source_metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(source_metadata) = 'object'),
  is_available boolean not null default true,
  scraped_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table food.menu_items (
  id uuid primary key default extensions.gen_random_uuid(),
  restaurant_id uuid not null references food.restaurants(id) on delete cascade,
  scraper_key text not null check (length(scraper_key) between 1 and 240),
  category text not null default 'Otros' check (length(btrim(category)) between 1 and 100),
  name text not null check (length(btrim(name)) between 1 and 180),
  description text check (description is null or length(description) <= 1200),
  price_cents integer not null check (price_cents between 0 and 1000000),
  currency text not null default 'EUR' check (currency = 'EUR'),
  image_url text check (image_url is null or length(image_url) <= 2000),
  source_url text check (source_url is null or length(source_url) <= 2000),
  source_metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(source_metadata) = 'object'),
  is_available boolean not null default true,
  sort_order integer not null default 0,
  scraped_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (restaurant_id, scraper_key)
);

create index menu_items_restaurant_available_idx
  on food.menu_items (restaurant_id, is_available, sort_order, name);

create table food.order_cycles (
  id uuid primary key default extensions.gen_random_uuid(),
  restaurant_id uuid not null references food.restaurants(id) on delete restrict,
  status text not null default 'open' check (status in ('open', 'closed')),
  created_by uuid not null references auth.users(id) on delete restrict,
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  check (
    (status = 'open' and closed_at is null)
    or (status = 'closed' and closed_at is not null and closed_at >= opened_at)
  )
);

create unique index order_cycles_single_open_idx
  on food.order_cycles ((status)) where status = 'open';

create index order_cycles_closed_at_idx
  on food.order_cycles (closed_at desc) where status = 'closed';

create table food.orders (
  id uuid primary key default extensions.gen_random_uuid(),
  cycle_id uuid not null references food.order_cycles(id) on delete restrict,
  display_name text not null check (length(btrim(display_name)) between 1 and 80),
  note text check (note is null or length(note) <= 500),
  edit_token_digest bytea not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index orders_cycle_idx on food.orders (cycle_id, created_at);

create table food.order_items (
  id uuid primary key default extensions.gen_random_uuid(),
  order_id uuid not null references food.orders(id) on delete cascade,
  menu_item_id uuid not null references food.menu_items(id) on delete restrict,
  quantity integer not null check (quantity between 1 and 20),
  note text check (note is null or length(note) <= 240),
  item_name text not null check (length(btrim(item_name)) between 1 and 180),
  unit_price_cents integer not null check (unit_price_cents between 0 and 1000000),
  currency text not null default 'EUR' check (currency = 'EUR'),
  created_at timestamptz not null default now(),
  unique (order_id, menu_item_id)
);

create index order_items_order_idx on food.order_items (order_id);

create or replace function food.food_touch_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger restaurants_touch_updated_at
before update on food.restaurants
for each row execute function food.food_touch_updated_at();

create trigger menu_items_touch_updated_at
before update on food.menu_items
for each row execute function food.food_touch_updated_at();

create trigger orders_touch_updated_at
before update on food.orders
for each row execute function food.food_touch_updated_at();

alter table food.food_admins enable row level security;
alter table food.restaurants enable row level security;
alter table food.menu_items enable row level security;
alter table food.order_cycles enable row level security;
alter table food.orders enable row level security;
alter table food.order_items enable row level security;

alter table food.food_admins force row level security;
alter table food.restaurants force row level security;
alter table food.menu_items force row level security;
alter table food.order_cycles force row level security;
alter table food.orders force row level security;
alter table food.order_items force row level security;

revoke all on table food.food_admins, food.restaurants, food.menu_items,
  food.order_cycles, food.orders, food.order_items from anon, authenticated;

grant select, insert, update, delete on table food.food_admins, food.restaurants,
  food.menu_items, food.order_cycles, food.orders, food.order_items to service_role;

create or replace function food._food_require_admin()
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if auth.uid() is null or not exists (
    select 1 from food.food_admins a where a.user_id = auth.uid()
  ) then
    raise exception using errcode = 'P0001', message = 'FOOD_FORBIDDEN';
  end if;
end;
$$;

create or replace function food._food_validate_order_input(
  p_display_name text,
  p_note text,
  p_items jsonb
)
returns void
language plpgsql
immutable
set search_path = pg_catalog, public
as $$
begin
  if p_display_name is null or length(btrim(p_display_name)) not between 1 and 80 then
    raise exception using errcode = 'P0001', message = 'FOOD_INVALID_INPUT';
  end if;
  if p_note is not null and length(p_note) > 500 then
    raise exception using errcode = 'P0001', message = 'FOOD_INVALID_INPUT';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array'
    or jsonb_array_length(p_items) not between 1 and 50 then
    raise exception using errcode = 'P0001', message = 'FOOD_INVALID_INPUT';
  end if;
end;
$$;

create or replace function food._food_replace_order_items(
  p_order_id uuid,
  p_restaurant_id uuid,
  p_items jsonb
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_input_count integer;
  v_valid_count integer;
  v_inserted_count integer;
begin
  v_input_count := jsonb_array_length(p_items);

  begin
    select count(*), count(distinct x.menu_item_id)
      into v_valid_count, v_input_count
    from jsonb_to_recordset(p_items) as x(menu_item_id uuid, quantity integer, note text)
    where x.menu_item_id is not null
      and x.quantity between 1 and 20
      and (x.note is null or length(x.note) <= 240);
  exception when invalid_text_representation or data_exception then
    raise exception using errcode = 'P0001', message = 'FOOD_INVALID_INPUT';
  end;

  if v_valid_count <> jsonb_array_length(p_items)
    or v_input_count <> jsonb_array_length(p_items) then
    raise exception using errcode = 'P0001', message = 'FOOD_INVALID_INPUT';
  end if;

  -- Keep the validated catalog rows locked until this transaction commits. This
  -- prevents a scraper availability update from racing the replacement insert.
  select count(*) into v_valid_count
  from (
    select mi.id
    from jsonb_to_recordset(p_items) as x(menu_item_id uuid, quantity integer, note text)
    join food.menu_items mi on mi.id = x.menu_item_id
    where mi.restaurant_id = p_restaurant_id and mi.is_available
    for share of mi
  ) as locked_items;

  if v_valid_count <> jsonb_array_length(p_items) then
    raise exception using errcode = 'P0001', message = 'FOOD_INVALID_ITEMS';
  end if;

  delete from food.order_items where order_id = p_order_id;

  insert into food.order_items (
    order_id, menu_item_id, quantity, note, item_name, unit_price_cents, currency
  )
  select
    p_order_id,
    mi.id,
    x.quantity,
    nullif(btrim(x.note), ''),
    mi.name,
    mi.price_cents,
    mi.currency
  from jsonb_to_recordset(p_items) as x(menu_item_id uuid, quantity integer, note text)
  join food.menu_items mi on mi.id = x.menu_item_id
  where mi.restaurant_id = p_restaurant_id and mi.is_available;

  get diagnostics v_inserted_count = row_count;
  if v_inserted_count <> jsonb_array_length(p_items) then
    -- Raising rolls back both the delete and insert, so an order can never be
    -- committed with a partial set of items.
    raise exception using errcode = 'P0001', message = 'FOOD_INVALID_ITEMS';
  end if;
end;
$$;

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
      'source_url', r.source_url
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

create or replace function public.food_submit_order(
  p_cycle_id uuid,
  p_display_name text,
  p_note text,
  p_items jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_restaurant_id uuid;
  v_order_id uuid := extensions.gen_random_uuid();
  v_token text := encode(extensions.gen_random_bytes(32), 'hex');
begin
  perform food._food_validate_order_input(p_display_name, p_note, p_items);

  select c.restaurant_id into v_restaurant_id
  from food.order_cycles c
  where c.id = p_cycle_id and c.status = 'open'
  for update;

  if v_restaurant_id is null then
    if exists (select 1 from food.order_cycles c where c.id = p_cycle_id and c.status = 'closed') then
      raise exception using errcode = 'P0001', message = 'FOOD_CYCLE_CLOSED';
    end if;
    raise exception using errcode = 'P0001', message = 'FOOD_NO_ACTIVE_CYCLE';
  end if;

  insert into food.orders (id, cycle_id, display_name, note, edit_token_digest)
  values (
    v_order_id,
    p_cycle_id,
    btrim(p_display_name),
    nullif(btrim(p_note), ''),
    extensions.digest(v_token, 'sha256')
  );

  perform food._food_replace_order_items(v_order_id, v_restaurant_id, p_items);

  return jsonb_build_object('order_id', v_order_id, 'edit_token', v_token);
end;
$$;

create or replace function public.food_get_order(p_order_id uuid, p_token text)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_result jsonb;
begin
  if p_token is null or length(p_token) <> 64 then
    raise exception using errcode = 'P0001', message = 'FOOD_ORDER_NOT_FOUND';
  end if;

  select jsonb_build_object(
    'id', o.id,
    'cycle_id', o.cycle_id,
    'cycle_status', c.status,
    'display_name', o.display_name,
    'note', o.note,
    'created_at', o.created_at,
    'updated_at', o.updated_at,
    'restaurant', jsonb_build_object('id', r.id, 'name', r.name, 'image_url', r.image_url),
    'total_cents', coalesce(sum(oi.quantity * oi.unit_price_cents), 0),
    'items', coalesce(jsonb_agg(jsonb_build_object(
      'id', oi.id,
      'menu_item_id', oi.menu_item_id,
      'item_name', oi.item_name,
      'unit_price_cents', oi.unit_price_cents,
      'currency', oi.currency,
      'quantity', oi.quantity,
      'note', oi.note,
      'line_total_cents', oi.quantity * oi.unit_price_cents
    ) order by oi.created_at) filter (where oi.id is not null), '[]'::jsonb)
  ) into v_result
  from food.orders o
  join food.order_cycles c on c.id = o.cycle_id
  join food.restaurants r on r.id = c.restaurant_id
  left join food.order_items oi on oi.order_id = o.id
  where o.id = p_order_id
    and o.edit_token_digest = extensions.digest(p_token, 'sha256')
  group by o.id, c.status, r.id;

  if v_result is null then
    raise exception using errcode = 'P0001', message = 'FOOD_ORDER_NOT_FOUND';
  end if;
  return v_result;
end;
$$;

create or replace function public.food_update_order(
  p_order_id uuid,
  p_token text,
  p_display_name text,
  p_note text,
  p_items jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_cycle_id uuid;
  v_restaurant_id uuid;
  v_status text;
begin
  perform food._food_validate_order_input(p_display_name, p_note, p_items);
  if p_token is null or length(p_token) <> 64 then
    raise exception using errcode = 'P0001', message = 'FOOD_ORDER_NOT_FOUND';
  end if;

  select o.cycle_id into v_cycle_id
  from food.orders o
  where o.id = p_order_id
    and o.edit_token_digest = extensions.digest(p_token, 'sha256')
  for update;

  if v_cycle_id is null then
    raise exception using errcode = 'P0001', message = 'FOOD_ORDER_NOT_FOUND';
  end if;

  select c.restaurant_id, c.status into v_restaurant_id, v_status
  from food.order_cycles c where c.id = v_cycle_id for update;

  if v_status <> 'open' then
    raise exception using errcode = 'P0001', message = 'FOOD_CYCLE_CLOSED';
  end if;

  update food.orders
  set display_name = btrim(p_display_name), note = nullif(btrim(p_note), '')
  where id = p_order_id;

  perform food._food_replace_order_items(p_order_id, v_restaurant_id, p_items);
  return public.food_get_order(p_order_id, p_token);
end;
$$;

create or replace function public.food_admin_access()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select auth.uid() is not null and exists (
    select 1 from food.food_admins a where a.user_id = auth.uid()
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
    'available_items', (select count(*) from food.menu_items mi where mi.restaurant_id = r.id and mi.is_available)
  ) order by r.name), '[]'::jsonb)
  into v_result
  from food.restaurants r
  where r.is_available
    and exists (select 1 from food.menu_items mi where mi.restaurant_id = r.id and mi.is_available);
  return v_result;
end;
$$;

create or replace function food._food_cycle_summary(p_cycle_id uuid)
returns jsonb
language sql
security definer
set search_path = pg_catalog, public
as $$
  select jsonb_build_object(
    'cycle', jsonb_build_object(
      'id', c.id, 'status', c.status, 'opened_at', c.opened_at, 'closed_at', c.closed_at
    ),
    'id', c.id,
    'status', c.status,
    'opened_at', c.opened_at,
    'closed_at', c.closed_at,
    'restaurant', jsonb_build_object('id', r.id, 'name', r.name, 'image_url', r.image_url),
    'total_cents', coalesce((
      select sum(oi.quantity * oi.unit_price_cents)
      from food.orders o join food.order_items oi on oi.order_id = o.id
      where o.cycle_id = c.id
    ), 0),
    'orders', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', o.id,
        'display_name', o.display_name,
        'note', o.note,
        'created_at', o.created_at,
        'updated_at', o.updated_at,
        'total_cents', coalesce((select sum(oi.quantity * oi.unit_price_cents) from food.order_items oi where oi.order_id = o.id), 0),
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
          from food.order_items oi where oi.order_id = o.id
        ), '[]'::jsonb)
      ) order by o.created_at)
      from food.orders o where o.cycle_id = c.id
    ), '[]'::jsonb)
  )
  from food.order_cycles c
  join food.restaurants r on r.id = c.restaurant_id
  where c.id = p_cycle_id;
$$;

create or replace function public.food_admin_current()
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_cycle_id uuid;
begin
  perform food._food_require_admin();
  select id into v_cycle_id from food.order_cycles where status = 'open' limit 1;
  if v_cycle_id is null then return null; end if;
  return food._food_cycle_summary(v_cycle_id);
end;
$$;

create or replace function public.food_admin_history()
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_result jsonb;
begin
  perform food._food_require_admin();
  select coalesce(jsonb_agg(food._food_cycle_summary(c.id) order by c.closed_at desc), '[]'::jsonb)
  into v_result
  from food.order_cycles c where c.status = 'closed';
  return v_result;
end;
$$;

create or replace function public.food_admin_open_cycle(p_restaurant_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_cycle_id uuid;
begin
  perform food._food_require_admin();

  if not exists (
    select 1 from food.restaurants r
    where r.id = p_restaurant_id and r.is_available
      and exists (select 1 from food.menu_items mi where mi.restaurant_id = r.id and mi.is_available)
  ) then
    raise exception using errcode = 'P0001', message = 'FOOD_INVALID_ITEMS';
  end if;

  begin
    insert into food.order_cycles (restaurant_id, created_by)
    values (p_restaurant_id, auth.uid()) returning id into v_cycle_id;
  exception when unique_violation then
    raise exception using errcode = 'P0001', message = 'FOOD_OPEN_CYCLE_EXISTS';
  end;

  return food._food_cycle_summary(v_cycle_id);
end;
$$;

create or replace function public.food_admin_close_cycle(p_cycle_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_status text;
begin
  perform food._food_require_admin();
  select status into v_status from food.order_cycles where id = p_cycle_id for update;
  if v_status is null then
    raise exception using errcode = 'P0001', message = 'FOOD_NO_ACTIVE_CYCLE';
  end if;
  if v_status <> 'open' then
    raise exception using errcode = 'P0001', message = 'FOOD_CYCLE_CLOSED';
  end if;
  update food.order_cycles set status = 'closed', closed_at = now() where id = p_cycle_id;
  return food._food_cycle_summary(p_cycle_id);
end;
$$;

revoke all on function food.food_touch_updated_at() from public, anon, authenticated;
revoke all on function food._food_require_admin() from public, anon, authenticated;
revoke all on function food._food_validate_order_input(text, text, jsonb) from public, anon, authenticated;
revoke all on function food._food_replace_order_items(uuid, uuid, jsonb) from public, anon, authenticated;
revoke all on function food._food_cycle_summary(uuid) from public, anon, authenticated;

revoke all on function public.food_active_menu() from public;
revoke all on function public.food_submit_order(uuid, text, text, jsonb) from public;
revoke all on function public.food_get_order(uuid, text) from public;
revoke all on function public.food_update_order(uuid, text, text, text, jsonb) from public;
revoke all on function public.food_admin_access() from public;
revoke all on function public.food_admin_catalog() from public;
revoke all on function public.food_admin_current() from public;
revoke all on function public.food_admin_history() from public;
revoke all on function public.food_admin_open_cycle(uuid) from public;
revoke all on function public.food_admin_close_cycle(uuid) from public;

grant execute on function public.food_active_menu() to anon, authenticated;
grant execute on function public.food_submit_order(uuid, text, text, jsonb) to anon, authenticated;
grant execute on function public.food_get_order(uuid, text) to anon, authenticated;
grant execute on function public.food_update_order(uuid, text, text, text, jsonb) to anon, authenticated;
grant execute on function public.food_admin_access() to authenticated;
grant execute on function public.food_admin_catalog() to authenticated;
grant execute on function public.food_admin_current() to authenticated;
grant execute on function public.food_admin_history() to authenticated;
grant execute on function public.food_admin_open_cycle(uuid) to authenticated;
grant execute on function public.food_admin_close_cycle(uuid) to authenticated;

comment on table food.food_admins is
  'Approved Supabase Auth user IDs. Bootstrap the first admin with: insert into food.food_admins (user_id) values (''AUTH_USER_UUID'');';
