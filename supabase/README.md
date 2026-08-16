# Supabase deployment

Apply the migrations in `supabase/migrations` with the Supabase CLI or the SQL editor before enabling MenuBox in production.

The scraper must use the Supabase service role to upsert `restaurants` and `menu_items`. It should use the stable `scraper_key` fields and update `is_available`, `scraped_at`, images, source URLs, and source metadata on every import. Prices are integer euro cents.

Catalog imports call `public.food_scraper_sync_catalog` with the service-role key.
The function validates and publishes the entire restaurant snapshot in one
transaction; the publishable frontend key cannot execute it.

Apply `20260811010000_scraper_opening_hours.sql` before deploying the scraper
version that publishes `opening_hours`; older versions of the RPC ignore that field.

Scraper opening hours initialize and refresh a restaurant until an approved
administrator edits its schedule from the **Restaurantes** tab in `/admin`.
After that first manual edit, later catalog syncs preserve the administrator's
hours. Schedules support up to four periods per day in `Atlantic/Canary` time.

## First administrator

1. Create the administrator in Supabase Authentication (email/password).
2. Copy that Auth user's UUID.
3. Run this once in the SQL editor as the project owner:

```sql
insert into food.food_admins (user_id)
values ('00000000-0000-0000-0000-000000000000');
```

Replace the example UUID with the real Auth UUID. Signing in is not enough by itself: only users in `food.food_admins` can call administration functions.

## Security verification

Run the database checks in `supabase/tests/food_security.sql` only against a disposable local Supabase project with `npm run db:test`. Never use a linked project or a database URL. The migration revokes direct access for `anon` and ordinary `authenticated` users; service-role catalog imports remain possible.
