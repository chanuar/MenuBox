import { useEffect, useRef } from 'react';
import { Outlet, useLocation, useMatches } from 'react-router';
import FoodHeader from '../products/food/components/FoodHeader';

const SITE_URL = 'https://menubox.chanuar.com';

const META = {
  food: {
    title: 'MenuBox — El pedido de la semana',
    description:
      'Elige restaurante, comparte la carta y reúne el pedido semanal del equipo en un solo lugar.',
  },
  options: {
    title: 'Restaurantes — MenuBox',
    description:
      'Consulta los restaurantes disponibles, descubre su propuesta y abre su carta en Uber Eats.',
  },
  admin: {
    title: 'Administración — MenuBox',
    description: 'Administración segura del pedido semanal del equipo.',
  },
  roulette: {
    title: 'Ruleta — MenuBox',
    description: 'Gira la ruleta y elige al azar entre los restaurantes de MenuBox.',
  },
  notFound: {
    title: 'Página no encontrada — MenuBox',
    description: 'La página que buscas no existe.',
  },
} as const;

const CANONICAL_PATH = { food: '/', options: '/options' } as const;
type Page = keyof typeof META;

export function RouteEnvironment({ loading = false }: { loading?: boolean }) {
  const matches = useMatches();
  const location = useLocation();
  const page = [...matches]
    .reverse()
    .find((match) => (match.handle as { page?: Page } | undefined)?.page);
  const name = (page?.handle as { page: Page } | undefined)?.page ?? 'notFound';
  const meta = META[name];
  const canonicalPath =
    name in CANONICAL_PATH ? CANONICAL_PATH[name as keyof typeof CANONICAL_PATH] : null;
  const pageUrl = new URL(canonicalPath ?? location.pathname, SITE_URL).href;
  const previousPath = useRef(location.pathname);
  const loadingHadFocus = useRef(false);

  useEffect(() => {
    document.documentElement.lang = 'es';
    document.body.className = 'food-page';
    return () => {
      if (loading && loadingHadFocus.current)
        document.getElementById('main-content')?.focus({ preventScroll: true });
    };
  }, [loading]);

  useEffect(() => {
    const routeChanged = previousPath.current !== location.pathname;
    previousPath.current = location.pathname;
    if (routeChanged) document.getElementById('main-content')?.focus();
  }, [location.pathname]);

  return (
    <>
      <title>{meta.title}</title>
      <meta name="description" content={meta.description} />
      <meta name="theme-color" content="#f7f1e7" />
      <meta property="og:title" content={meta.title} />
      <meta property="og:description" content={meta.description} />
      <meta property="og:type" content="website" />
      <meta property="og:locale" content="es_ES" />
      <meta property="og:site_name" content="MenuBox" />
      <meta property="og:url" content={pageUrl} />
      <meta property="og:image" content={`${SITE_URL}/food-og.png`} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={meta.title} />
      <meta name="twitter:description" content={meta.description} />
      <meta name="twitter:image" content={`${SITE_URL}/food-og.png`} />
      {canonicalPath ? (
        <link rel="canonical" href={pageUrl} />
      ) : (
        <meta name="robots" content="noindex, nofollow" />
      )}
      <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
      {loading ? (
        <div
          className="food-shell"
          onFocusCapture={() => {
            loadingHadFocus.current = true;
          }}
        >
          <FoodHeader compact />
          <main id="main-content" className="food-state food-state--centered" tabIndex={-1}>
            <p className="food-kicker">La mesa del equipo</p>
            <h1>Un momento…</h1>
            <p role="status">Estamos cargando MenuBox.</p>
          </main>
        </div>
      ) : (
        <Outlet />
      )}
    </>
  );
}

export function HydrateFallback() {
  return <RouteEnvironment loading />;
}
