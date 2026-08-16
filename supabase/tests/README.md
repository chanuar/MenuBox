# Food database tests

Run `npm run db:test` after starting a disposable local Supabase stack. It runs `supabase test db --local`; never use `--linked` or `--db-url`. `food_security.sql` covers table/function privileges, token isolation, input and availability validation, trusted totals, and immutable historical snapshots.

The close-versus-edit invariant is implemented by locking the same `order_cycles` row in both `food_update_order` and `food_admin_close_cycle`. The partial unique index on open cycles serializes competing open attempts. For a manual concurrency smoke test, call each pair from two SQL sessions inside explicit transactions and confirm that the second call waits, then observes `FOOD_CYCLE_CLOSED` or `FOOD_OPEN_CYCLE_EXISTS` after the first commits.
