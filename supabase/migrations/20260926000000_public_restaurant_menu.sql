-- Public catalogue browsing, independent of the team's active order cycle.
-- Only the same presentation fields already exposed by food_active_menu.
create or replace function public.food_restaurant_menu(p_restaurant_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', mi.id,
    'restaurant_id', mi.restaurant_id,
    'category', mi.category,
    'name', mi.name,
    'description', mi.description,
    'price_cents', mi.price_cents,
    'currency', mi.currency,
    'image_url', mi.image_url
  ) order by mi.category, mi.sort_order, mi.name), '[]'::jsonb)
  from food.menu_items mi
  join food.restaurants r on r.id = mi.restaurant_id
  where r.id = p_restaurant_id and r.is_available and mi.is_available
    and r.source_url is not null;
$$;

revoke all on function public.food_restaurant_menu(uuid) from public;
grant execute on function public.food_restaurant_menu(uuid) to anon, authenticated;
comment on function public.food_restaurant_menu(uuid) is
  'Available dishes and presentation fields for one publicly listed restaurant; no order data.';
