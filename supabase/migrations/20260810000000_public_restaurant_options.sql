-- Public restaurant directory for /food/options.
-- Exposes only presentation fields and an aggregate item count; catalog rows,
-- scraper metadata, order data, and administrator data remain private.

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
    'available_items', (
      select count(*)
      from food.menu_items mi
      where mi.restaurant_id = r.id and mi.is_available
    )
  ) order by r.name), '[]'::jsonb)
  from food.restaurants r
  where r.is_available
    and r.source_url is not null
    and exists (
      select 1
      from food.menu_items mi
      where mi.restaurant_id = r.id and mi.is_available
    );
$$;

revoke all on function public.food_restaurant_options() from public;
grant execute on function public.food_restaurant_options() to anon, authenticated;

comment on function public.food_restaurant_options() is
  'Public presentation-only directory of scraper-imported restaurants with available menu items.';
