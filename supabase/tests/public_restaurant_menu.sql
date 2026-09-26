-- Run only against the disposable local Supabase stack.
begin;
create extension if not exists pgtap with schema extensions;
select extensions.plan(6);
insert into food.restaurants (id, scraper_key, name, source_url, is_available) values
('00000000-0000-0000-0000-00000000f201', 'menu-test-visible', 'Visible', 'https://example.invalid', true),
('00000000-0000-0000-0000-00000000f202', 'menu-test-hidden', 'Hidden', 'https://example.invalid', false),
('00000000-0000-0000-0000-00000000f203', 'menu-test-unlisted', 'Unlisted', null, true);
insert into food.menu_items (restaurant_id, scraper_key, name, price_cents, is_available) values
('00000000-0000-0000-0000-00000000f201', 'visible', 'Visible dish', 700, true),
('00000000-0000-0000-0000-00000000f201', 'hidden', 'Hidden dish', 800, false),
('00000000-0000-0000-0000-00000000f202', 'hidden-restaurant', 'Hidden restaurant dish', 800, true),
('00000000-0000-0000-0000-00000000f203', 'unlisted', 'Unlisted dish', 800, true);
select extensions.function_privs_are('public', 'food_restaurant_menu', array['uuid']::name[], 'anon', array['EXECUTE'], 'anonymous visitors can browse menus');
set local role anon;
select extensions.is(jsonb_array_length(public.food_restaurant_menu('00000000-0000-0000-0000-00000000f201')), 1, 'only available items appear without an active cycle');
select extensions.is(public.food_restaurant_menu('00000000-0000-0000-0000-00000000f201')->0->>'name', 'Visible dish', 'returns presentation fields');
select extensions.is(public.food_restaurant_menu('00000000-0000-0000-0000-00000000f202'), '[]'::jsonb, 'unavailable restaurants are hidden');
select extensions.is(public.food_restaurant_menu('00000000-0000-0000-0000-00000000f203'), '[]'::jsonb, 'unlisted restaurants are hidden');
select extensions.ok(not (public.food_restaurant_menu('00000000-0000-0000-0000-00000000f201')->0 ?| array['source_metadata','scraper_key','order_id','token']), 'no private or ordering fields escape');
reset role;
select * from extensions.finish();
rollback;
