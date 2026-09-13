import { useEffect, useState } from 'react';
import { Link, useLoaderData } from 'react-router';
import { foodConfigured, getRestaurantOptions } from '../api/foodApi';
import FoodHeader from '../components/FoodHeader';
import type { Restaurant } from '../model/types';

export const loader = () => getRestaurantOptions();

const COLORS = ['#b8422c', '#41614b', '#77528b', '#276779', '#815924'];

export function Component() {
  const allRestaurants = useLoaderData() as Restaurant[];
  const [excluded, setExcluded] = useState<string[]>([]);
  const restaurants = allRestaurants.filter((restaurant) => !excluded.includes(restaurant.id));
  const [rotation, setRotation] = useState(0);
  const [pending, setPending] = useState<Restaurant | null>(null);
  const [winner, setWinner] = useState<Restaurant | null>(null);
  const slice = restaurants.length ? 360 / restaurants.length : 0;
  const spinDisabled = pending !== null || restaurants.length === 0;

  useEffect(() => {
    if (!pending) return;
    const timer = window.setTimeout(() => {
      setWinner(pending);
      setPending(null);
    }, 4200);
    return () => window.clearTimeout(timer);
  }, [pending]);

  function toggleRestaurant(id: string) {
    if (pending) return;
    setExcluded((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
    setWinner(null);
    setRotation(0);
  }

  function spin() {
    if (pending || restaurants.length === 0) return;
    const index = Math.floor(Math.random() * restaurants.length);
    const selected = restaurants[index];
    if (!selected) return;
    const target = 360 - (index + 0.5) * slice;
    setRotation((current) => current + 1800 + ((target - (current % 360) + 360) % 360));
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || restaurants.length === 1) {
      setWinner(selected);
    } else {
      setWinner(null);
      setPending(selected);
    }
  }

  return (
    <div className="food-shell">
      <FoodHeader />
      <main id="main-content" className="food-options food-roulette" tabIndex={-1}>
        <header className="food-options__intro">
          <p className="food-kicker">Que decida la suerte</p>
          <h1>¿Dónde comemos hoy?</h1>
          <p>
            Gira la ruleta: los restaurantes seleccionados tienen la misma probabilidad de salir.
          </p>
        </header>
        {allRestaurants.length === 0 ? (
          <section className="food-state food-state--inline">
            <h2>Todavía no hay restaurantes disponibles</h2>
            <p>
              {foodConfigured
                ? 'Cuando se importe la primera carta, podrás girar la ruleta.'
                : 'Falta conectar el proyecto de Supabase para mostrar las opciones.'}
            </p>
            <Link to="/options">Ver restaurantes</Link>
          </section>
        ) : (
          <>
            <div className="food-roulette__wheel-wrap">
              <div className="food-roulette__pointer" aria-hidden="true" />
              <div
                className="food-roulette__wheel"
                aria-hidden="true"
                style={{
                  transform: `rotate(${rotation}deg)`,
                  transition: pending ? undefined : 'none',
                  background: restaurants.length
                    ? `conic-gradient(${restaurants.map((_, index) => `${COLORS[index % COLORS.length]} ${index * slice}deg ${(index + 1) * slice}deg`).join(', ')})`
                    : 'var(--food-line)',
                }}
              >
                {restaurants.map((restaurant, index) => (
                  <span
                    className="food-roulette__number"
                    key={restaurant.id}
                    style={{ transform: `rotate(${(index + 0.5) * slice}deg)` }}
                  >
                    <span>{index + 1}</span>
                  </span>
                ))}
              </div>
              <button
                className="food-roulette__hub"
                type="button"
                aria-label="Girar ruleta desde el centro"
                disabled={spinDisabled}
                onClick={spin}
              >
                M
              </button>
            </div>
            <button className="food-button" type="button" disabled={spinDisabled} onClick={spin}>
              {pending ? 'Girando…' : winner ? 'Volver a girar' : 'Girar ruleta'}
            </button>
            <div
              className="food-roulette__result"
              role="status"
              aria-live="polite"
              aria-atomic="true"
            >
              {pending ? (
                <p>Eligiendo restaurante…</p>
              ) : winner ? (
                <>
                  <p>
                    ¡Hoy toca <strong>{winner.name}</strong>!
                  </p>
                  {winner.sourceUrl && (
                    <a href={winner.sourceUrl} target="_blank" rel="noreferrer">
                      Ver carta en Uber Eats{' '}
                      <span className="sr-only">(se abre en una pestaña nueva)</span> ↗
                    </a>
                  )}
                </>
              ) : (
                <p>
                  {restaurants.length === 0
                    ? 'Selecciona al menos un restaurante para girar.'
                    : restaurants.length === 1
                      ? 'Solo hay un restaurante disponible.'
                      : `${restaurants.length} restaurantes. Una decisión menos.`}
                </p>
              )}
            </div>
            <section aria-labelledby="roulette-restaurants">
              <h2 id="roulette-restaurants">Restaurantes en la ruleta</h2>
              <p>
                Desmarca los restaurantes que quieras quitar. Puedes volver a marcarlos cuando
                quieras.
              </p>
              <ul className="food-roulette__legend">
                {allRestaurants.map((restaurant) => {
                  const index = restaurants.indexOf(restaurant);
                  return (
                    <li key={restaurant.id}>
                      <label>
                        <input
                          type="checkbox"
                          checked={index !== -1}
                          disabled={pending !== null}
                          onChange={() => toggleRestaurant(restaurant.id)}
                        />
                        <span
                          style={{
                            backgroundColor:
                              index === -1 ? 'var(--food-muted)' : COLORS[index % COLORS.length],
                          }}
                          aria-hidden="true"
                        >
                          {index === -1 ? '–' : index + 1}
                        </span>
                        {restaurant.name}
                      </label>
                    </li>
                  );
                })}
              </ul>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
