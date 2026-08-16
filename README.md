# MenuBox

Pedidos semanales de equipo, restaurantes, carta y administración.

## Desarrollo

```powershell
Copy-Item .env.example .env
npm ci
npm run dev
```

## Verificación

```powershell
npm run lint
npm run format:check
npm run typecheck
npm test
npm run build
```

Para los contratos SQL, inicia Docker y el stack local antes de ejecutar:

```powershell
npx supabase start
npm run db:test
```

`db:test` ejecuta explícitamente `supabase test db --local`. No uses
`supabase link`, `--linked`, `--db-url`, `db pull`, `db push` ni `db dump` en
este repositorio: la suite escribe datos de prueba y solo puede ejecutarse en
el stack local desechable.

## Despliegue

Cloudflare Workers sirve `dist` según `wrangler.jsonc`. Configura únicamente
`VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY`; nunca una service-role key.

Las migraciones y pruebas del esquema `food` pertenecen a este repositorio. El
scraper vive por separado y publica catálogos mediante su credencial de servicio.
