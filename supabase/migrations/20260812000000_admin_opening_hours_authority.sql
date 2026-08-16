-- Scraper hours initialize and refresh restaurants until an administrator
-- explicitly takes ownership of the schedule. Later catalog syncs preserve it.

alter table food.restaurants
  add column opening_hours_managed_by_admin boolean not null default false;

create or replace function food.food_preserve_admin_opening_hours()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if auth.role() = 'service_role' and old.opening_hours_managed_by_admin then
    new.opening_hours := old.opening_hours;
    new.opening_hours_managed_by_admin := true;
  end if;
  return new;
end;
$$;

create trigger restaurants_preserve_admin_opening_hours
before update of opening_hours on food.restaurants
for each row execute function food.food_preserve_admin_opening_hours();

revoke all on function food.food_preserve_admin_opening_hours()
  from public, anon, authenticated, service_role;

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
  set opening_hours = p_opening_hours,
      opening_hours_managed_by_admin = true
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

comment on column food.restaurants.opening_hours_managed_by_admin is
  'True after an administrator edits the schedule; scraper catalog syncs then preserve opening_hours.';
