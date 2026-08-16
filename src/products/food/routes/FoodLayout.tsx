import { Outlet, useNavigation, useRevalidator, useRouteError } from 'react-router';
import '../food.css';

export function Component() {
  const navigation = useNavigation();
  return (
    <>
      {navigation.state !== 'idle' && (
        <div className="route-loading" role="status" aria-live="polite">
          Cargando…
        </div>
      )}
      <Outlet />
    </>
  );
}

export function ErrorBoundary() {
  const error = useRouteError() as Error | undefined;
  const revalidator = useRevalidator();
  return (
    <main id="main-content" className="food-state food-state--centered" role="alert" tabIndex={-1}>
      <h1>No hemos podido cargar MenuBox</h1>
      <p>{error?.message ?? 'Ha ocurrido un error inesperado.'}</p>
      <button className="food-button" type="button" onClick={() => revalidator.revalidate()}>
        Volver a intentar
      </button>
    </main>
  );
}
