import { useEffect } from 'react';
import { Link, Outlet, useNavigation, useRevalidator } from 'react-router';
import FoodHeader from '../components/FoodHeader';
import FoodMark from '../components/FoodMark';
import '../food.css';

export function Component() {
  const navigation = useNavigation();
  return (
    <>
      {navigation.state !== 'idle' && (
        <div className="route-loading" role="status" aria-live="polite">
          <span className="sr-only">Cargando página…</span>
        </div>
      )}
      <Outlet />
    </>
  );
}

export function ErrorBoundary() {
  const revalidator = useRevalidator();
  useEffect(() => {
    document.getElementById('main-content')?.focus();
    return () => document.getElementById('main-content')?.focus({ preventScroll: true });
  }, []);
  return (
    <div className="food-shell">
      <FoodHeader compact />
      <main id="main-content" className="food-state food-state--centered" tabIndex={-1}>
        <div className="food-state__symbol">
          <FoodMark />
        </div>
        <p className="food-kicker">Una pausa en la cocina</p>
        <h1>No hemos podido cargar MenuBox</h1>
        <p role="alert">
          No se ha podido recuperar la información. Comprueba tu conexión y vuelve a cargar la
          página.
        </p>
        <div className="food-state__actions">
          <button
            className="food-button"
            type="button"
            disabled={revalidator.state !== 'idle'}
            onClick={() => revalidator.revalidate()}
          >
            {revalidator.state === 'idle' ? 'Volver a cargar' : 'Cargando…'}
          </button>
          <Link className="food-button food-button--quiet" to="/">
            Ir a mi pedido
          </Link>
        </div>
      </main>
    </div>
  );
}
