# MenuBox

MenuBox is a weekly team-ordering application for choosing a restaurant,
sharing its menu, collecting individual orders, and managing the final group
order. The interface is currently available in Spanish.

## Features

- Browse available restaurants and their weekly opening hours.
- Build an order from the active restaurant menu, including quantities and
  per-item or general notes.
- Recover and edit a submitted order from the same browser while its weekly
  cycle remains open.
- Keep prices and historical order snapshots authoritative on the server.
- Give approved administrators a private workspace for restaurant schedules,
  weekly cycles, order summaries, service fees, and history.
- Import validated restaurant catalogs through a separate service-role-only
  scraper workflow.

## Architecture and security

MenuBox stores its application data in the Supabase `food` schema and exposes
purpose-built PostgreSQL functions to the browser. Anonymous users can read the
active menu and manage only an order for which they hold the edit token.
Administrative functions require both an authenticated Supabase session and an
entry in the `food.food_admins` allowlist.

The browser uses only a Supabase publishable key. Service-role credentials
belong exclusively to the separate catalog scraper and must never be added to
this repository or exposed to frontend code.

Database migrations and pgTAP security tests are versioned in this repository
alongside the web application.

## Tech stack

- React 19
- React Router 7
- TypeScript
- Vite
- Supabase and PostgreSQL
- Vitest, Testing Library, and pgTAP
- ESLint, Prettier, Husky, and lint-staged

## Getting started

### Requirements

- Node.js 22.22.1 or newer within Node 22, or Node 24+. Node 22 is the repository default.
- npm
- Docker Desktop for the disposable local Supabase stack and database tests

### Setup

```bash
git clone https://github.com/chanuar/MenuBox.git
cd MenuBox
npm ci
```

Copy `.env.example` to `.env` and provide the browser-safe Supabase values:

```dotenv
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

Never add a service-role key, database password, access token, or administrator
identifier to `.env`.

Start the development server:

```bash
npm run dev
```

## Available scripts

| Command                | Description                                          |
| ---------------------- | ---------------------------------------------------- |
| `npm run dev`          | Start the Vite development server.                   |
| `npm run build`        | Type-check and create a production build.            |
| `npm run preview`      | Preview the production build locally.                |
| `npm run lint`         | Run ESLint with zero warnings allowed.               |
| `npm run format`       | Format supported files with Prettier.                |
| `npm run format:check` | Check formatting without changing files.             |
| `npm run typecheck`    | Run strict TypeScript checks.                        |
| `npm test`             | Run the Vitest suite once.                           |
| `npm run test:watch`   | Run Vitest in watch mode.                            |
| `npm run db:test`      | Run pgTAP tests against the local Supabase database. |

## Database tests

Start a disposable local Supabase stack, run the SQL tests, and stop it when
finished:

```bash
npx supabase start
npm run db:test
npx supabase stop --no-backup
```

`npm run db:test` always executes `supabase test db --local`. Never link this
workflow to a hosted project or pass `--linked` or `--db-url`; the suite creates
test records and is intended only for the disposable local database.

## Project structure

```text
src/
├── app/                  # Application startup, routing, metadata, and 404 UI
├── products/food/        # Ordering routes, components, models, APIs, and CSS
├── shared/config/        # Browser-safe Supabase environment configuration
└── test/                 # Shared test setup
supabase/
├── migrations/           # Versioned food schema and RPC changes
└── tests/                # Local pgTAP security and contract tests
public/                   # Static assets, robots.txt, and sitemap.xml
```

## Contributing

Before opening a pull request, run:

```bash
npm run lint
npm run format:check
npm run typecheck
npm test
npm run build
```

Run `npm run db:test` as well whenever a change touches migrations,
authorization, Row Level Security, or database functions.

Git hooks run lint-staged checks before commits and the type-check and test
suite before pushes.
