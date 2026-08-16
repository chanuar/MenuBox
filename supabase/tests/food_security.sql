-- Run with `supabase test db` against a disposable local project.
begin;

create extension if not exists pgtap with schema extensions;
select extensions.plan(33);

select extensions.has_table('food', 'food_admins', 'food.food_admins exists');
select extensions.has_table('food', 'restaurants', 'food.restaurants exists');
select extensions.has_table('food', 'menu_items', 'food.menu_items exists');
select extensions.has_table('food', 'order_cycles', 'food.order_cycles exists');
select extensions.has_table('food', 'orders', 'food.orders exists');
select extensions.has_table('food', 'order_items', 'food.order_items exists');

select extensions.table_privs_are('food', 'orders', 'anon', array[]::name[], 'anon cannot read order rows');
select extensions.table_privs_are('food', 'order_items', 'anon', array[]::name[], 'anon cannot read order item rows');
select extensions.table_privs_are('food', 'food_admins', 'anon', array[]::name[], 'anon cannot enumerate admins');
select extensions.table_privs_are('food', 'orders', 'authenticated', array[]::name[], 'ordinary authenticated users cannot read order rows');
select extensions.table_privs_are('food', 'order_cycles', 'authenticated', array[]::name[], 'ordinary authenticated users cannot enumerate history');

select extensions.function_privs_are(
  'public', 'food_active_menu', array[]::name[], 'anon', array['EXECUTE'],
  'anon can only use the public active-menu function'
);
select extensions.function_privs_are(
  'public', 'food_restaurant_options', array[]::name[], 'anon', array['EXECUTE'],
  'anon can use the presentation-only restaurant directory function'
);
select extensions.function_privs_are(
  'public', 'food_admin_current', array[]::name[], 'anon', array[]::name[],
  'anon cannot call admin summaries'
);
select extensions.function_privs_are(
  'public', 'food_admin_current', array[]::name[], 'authenticated', array['EXECUTE'],
  'authenticated role can call the function, which applies the allowlist internally'
);
select extensions.function_privs_are(
  'public', 'food_admin_close_cycle', array['uuid', 'integer'], 'anon', array[]::name[],
  'anon cannot close cycles or set service fees'
);
select extensions.function_privs_are(
  'public', 'food_admin_close_cycle', array['uuid', 'integer'], 'authenticated', array['EXECUTE'],
  'authenticated role can call cycle closure, which applies the allowlist internally'
);
select extensions.function_privs_are(
  'public', 'food_admin_update_restaurant_hours', array['uuid', 'jsonb'], 'anon', array[]::name[],
  'anon cannot update restaurant opening hours'
);
select extensions.function_privs_are(
  'public', 'food_admin_update_restaurant_hours', array['uuid', 'jsonb'], 'authenticated', array['EXECUTE'],
  'authenticated role can call the hours function, which applies the allowlist internally'
);
select extensions.function_privs_are(
  'public', 'food_scraper_sync_catalog', array['jsonb', 'jsonb', 'boolean', 'boolean'], 'anon', array[]::name[],
  'anon cannot publish scraper catalogs'
);
select extensions.function_privs_are(
  'public', 'food_scraper_sync_catalog', array['jsonb', 'jsonb', 'boolean', 'boolean'], 'authenticated', array[]::name[],
  'ordinary authenticated users cannot publish scraper catalogs'
);
select extensions.function_privs_are(
  'public', 'food_scraper_sync_catalog', array['jsonb', 'jsonb', 'boolean', 'boolean'], 'service_role', array['EXECUTE'],
  'only the service role can publish scraper catalogs'
);

select set_config('request.jwt.claim.role', 'service_role', true);
set local role service_role;
select extensions.is(
  (public.food_scraper_sync_catalog(
    '{"scraper_key":"hours-test","name":"Hours Test","source_url":"https://example.invalid","opening_hours":[{"day":1,"periods":[{"open":"12:00","close":"23:00"}]}]}'::jsonb,
    '[{"scraper_key":"item-a","category":"Test","name":"Item A","price_cents":100,"currency":"EUR","source_url":"https://example.invalid","sort_order":0}]'::jsonb,
    true,
    true
  )->>'dry_run')::boolean,
  true,
  'scraper RPC accepts a validated weekly schedule'
);
select extensions.throws_ok(
  $$select public.food_scraper_sync_catalog(
    '{"scraper_key":"hours-test","name":"Hours Test","source_url":"https://example.invalid"}'::jsonb,
    '[{"scraper_key":"item-a","category":"Test","name":"Item A","price_cents":100,"currency":"EUR","source_url":"https://example.invalid","sort_order":0}]'::jsonb,
    true,
    true
  )$$,
  'P0001', 'FOOD_SCRAPER_INVALID_INPUT',
  'scraper RPC rejects restaurant snapshots without opening hours'
);
reset role;
select set_config('request.jwt.claim.role', '', true);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at
)
values (
  '00000000-0000-0000-0000-00000000f001',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'food-security@example.invalid', '',
  now(), now(), now()
) on conflict (id) do nothing;

insert into food.restaurants (id, scraper_key, name)
values ('00000000-0000-0000-0000-00000000f101', 'test-restaurant', 'Restaurante de prueba');

insert into food.menu_items (id, restaurant_id, scraper_key, category, name, price_cents)
values
  ('00000000-0000-0000-0000-00000000f201', '00000000-0000-0000-0000-00000000f101', 'dish-a', 'Platos', 'Plato A', 725),
  ('00000000-0000-0000-0000-00000000f202', '00000000-0000-0000-0000-00000000f101', 'dish-b', 'Platos', 'Plato B', 950);

insert into food.food_admins (user_id)
values ('00000000-0000-0000-0000-00000000f001');

select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000f001', true);
set local role authenticated;
select public.food_admin_update_restaurant_hours(
  '00000000-0000-0000-0000-00000000f101',
  '[{"day":1,"periods":[{"open":"09:00","close":"17:00"}]}]'::jsonb
);
reset role;

select set_config('request.jwt.claim.role', 'service_role', true);
set local role service_role;
select public.food_scraper_sync_catalog(
  '{"scraper_key":"test-restaurant","name":"Restaurante de prueba","source_url":"https://example.invalid","opening_hours":[{"day":1,"periods":[{"open":"12:00","close":"23:00"}]}]}'::jsonb,
  '[{"scraper_key":"dish-a","category":"Platos","name":"Plato A","price_cents":725,"currency":"EUR"},{"scraper_key":"dish-b","category":"Platos","name":"Plato B","price_cents":950,"currency":"EUR"}]'::jsonb,
  true,
  false
);
reset role;
select set_config('request.jwt.claim.role', '', true);
select set_config('request.jwt.claim.sub', '', true);

select extensions.is(
  (select opening_hours from food.restaurants where id = '00000000-0000-0000-0000-00000000f101'),
  '[{"day":1,"periods":[{"open":"09:00","close":"17:00"}]}]'::jsonb,
  'scraper sync preserves an administrator-managed opening schedule'
);

select extensions.ok(
  food.food_valid_opening_hours('[{"day":1,"periods":[{"open":"12:00","close":"23:30"}]}]'::jsonb),
  'structured weekly opening hours are accepted'
);
select extensions.is(
  food.food_valid_opening_hours('[{"day":1,"periods":[{"open":"25:00","close":"23:30"}]}]'::jsonb),
  false,
  'invalid opening times are rejected'
);

insert into food.order_cycles (id, restaurant_id, created_by)
values ('00000000-0000-0000-0000-00000000f301', '00000000-0000-0000-0000-00000000f101', '00000000-0000-0000-0000-00000000f001');

create temporary table food_test_orders (label text primary key, result jsonb);
insert into food_test_orders values (
  'a', public.food_submit_order(
    '00000000-0000-0000-0000-00000000f301', 'Ana', null,
    '[{"menu_item_id":"00000000-0000-0000-0000-00000000f201","quantity":2,"note":"Salsa aparte","price_cents":1}]'::jsonb
  )
);
insert into food_test_orders values (
  'b', public.food_submit_order(
    '00000000-0000-0000-0000-00000000f301', 'Luis', null,
    '[{"menu_item_id":"00000000-0000-0000-0000-00000000f202","quantity":1}]'::jsonb
  )
);

select extensions.is(
  (public.food_get_order(
    ((select result from food_test_orders where label = 'a')->>'order_id')::uuid,
    (select result from food_test_orders where label = 'a')->>'edit_token'
  )->>'total_cents')::integer,
  1450,
  'client-supplied prices are ignored and trusted snapshots determine totals'
);

select extensions.throws_ok(
  format(
    'select public.food_get_order(%L::uuid, %L)',
    (select result->>'order_id' from food_test_orders where label = 'a'),
    (select result->>'edit_token' from food_test_orders where label = 'b')
  ),
  'P0001', 'FOOD_ORDER_NOT_FOUND',
  'an edit token cannot read another order'
);

select extensions.throws_ok(
  $$select public.food_submit_order(
    '00000000-0000-0000-0000-00000000f301', 'Mal', null,
    '[{"menu_item_id":"00000000-0000-0000-0000-00000000f201","quantity":21}]'::jsonb
  )$$,
  'P0001', 'FOOD_INVALID_INPUT',
  'out-of-range quantities are rejected'
);

update food.menu_items set is_available = false where id = '00000000-0000-0000-0000-00000000f202';
select extensions.throws_ok(
  $$select public.food_submit_order(
    '00000000-0000-0000-0000-00000000f301', 'Mal', null,
    '[{"menu_item_id":"00000000-0000-0000-0000-00000000f202","quantity":1}]'::jsonb
  )$$,
  'P0001', 'FOOD_INVALID_ITEMS',
  'unavailable menu items are rejected'
);

update food.menu_items set name = 'Nombre nuevo', price_cents = 5000
where id = '00000000-0000-0000-0000-00000000f201';
select extensions.is(
  (public.food_get_order(
    ((select result from food_test_orders where label = 'a')->>'order_id')::uuid,
    (select result from food_test_orders where label = 'a')->>'edit_token'
  )->'items'->0->>'item_name'),
  'Plato A',
  'historical item names remain immutable after scraper updates'
);

select extensions.is(
  (public.food_get_order(
    ((select result from food_test_orders where label = 'a')->>'order_id')::uuid,
    (select result from food_test_orders where label = 'a')->>'edit_token'
  )->'items'->0->>'unit_price_cents')::integer,
  725,
  'historical prices remain immutable after scraper updates'
);

select * from extensions.finish();
rollback;
