# Repository Guidelines

MenuBox is a standalone Vite application using React 19, React Router 7, and
strict TypeScript. Public routes are `/` and `/options`; `/admin` and unknown
direct requests must remain `noindex`, with unknown requests returning `404.html`.
`/roulette` provides a visual restaurant picker and remains `noindex`.

- Keep product code in `src/products/food/`; standalone startup, metadata,
  routing, and 404 code belong in `src/app/`.
- Keep raw Supabase payloads in `src/products/food/api/foodApi.ts`. Preserve
  the `food` schema, RPC parameters, scraper payloads, and local-storage keys.
- Preserve semantic controls, keyboard behavior, focus restoration, the skip
  link, and `<main id="main-content" tabIndex={-1}>` on every route surface.
- Keep static and runtime metadata synchronized with `https://menubox.chanuar.com`.
- Never commit `.env`, build output, dependencies, tokens, database passwords,
  service-role keys, or administrator identifiers.
- Database tests are local only: use `npm run db:test`, never `--linked` or
  `--db-url`, and never run `supabase link`, `db pull`, `db push`, or `db dump`.

Use Prettier, ESLint with zero warnings, strict TypeScript, Vitest, lint-staged,
and Husky. Before handoff run `npm run lint`, `npm run format:check`,
`npm run typecheck`, `npm test`, `npm run build`, and `npm run db:test` when
Docker is available.
