import { useEffect, useRef, useState } from 'react';
import { Link, useLoaderData } from 'react-router';
import { foodConfigured, getRestaurantOptions } from '../api/foodApi';
import FoodHeader from '../components/FoodHeader';
import { getFoodTypes } from '../model/foodTypes';
import type { Restaurant } from '../model/types';

export const loader = () => getRestaurantOptions();

const COLORS = ['#b8422c', '#41614b', '#77528b', '#276779', '#815924'];
type RouletteOption = Pick<Restaurant, 'id' | 'name'> & { sourceUrl?: string | null };

export function Component() {
  const allRestaurants = useLoaderData() as Restaurant[];
  const [mode, setMode] = useState<'restaurant' | 'food'>('restaurant');
  const [excluded, setExcluded] = useState<string[]>([]);
  const [excludedTypes, setExcludedTypes] = useState<string[]>([]);
  const [foodFilter, setFoodFilter] = useState<string | null>(null);
  const foodTypes = getFoodTypes(allRestaurants);
  const filteredType = foodTypes.find(({ id }) => id === foodFilter);
  const allOptions =
    mode === 'food'
      ? foodTypes.filter(({ restaurants }) => restaurants.some(({ id }) => !excluded.includes(id)))
      : (filteredType?.restaurants ?? allRestaurants);
  const excludedOptions = mode === 'food' ? excludedTypes : excluded;
  const options = allOptions.filter(({ id }) => !excludedOptions.includes(id));
  const optionName = mode === 'food' ? 'tipo de comida' : 'restaurante';
  const optionsName = mode === 'food' ? 'tipos de comida' : 'restaurantes';
  const [rotation, setRotation] = useState(0);
  const [pending, setPending] = useState<RouletteOption | null>(null);
  const [winner, setWinner] = useState<RouletteOption | null>(null);
  const restaurantMode = useRef<HTMLInputElement>(null);
  const slice = options.length ? 360 / options.length : 0;
  const spinDisabled = pending !== null || options.length === 0;

  useEffect(() => {
    if (!pending) return;
    const timer = window.setTimeout(() => {
      setWinner(pending);
      setPending(null);
    }, 4200);
    return () => window.clearTimeout(timer);
  }, [pending]);

  function resetSpin() {
    setWinner(null);
    setRotation(0);
  }

  function changeMode(next: typeof mode) {
    if (pending) return;
    setMode(next);
    setFoodFilter(null);
    resetSpin();
  }

  function filterRestaurants(typeId: string | null) {
    if (pending) return;
    setMode('restaurant');
    setFoodFilter(typeId);
    resetSpin();
    restaurantMode.current?.focus();
  }

  function toggleOption(id: string) {
    if (pending) return;
    const setExcludedOptions = mode === 'food' ? setExcludedTypes : setExcluded;
    setExcludedOptions((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
    resetSpin();
  }

  function spin() {
    if (spinDisabled) return;
    const index = Math.floor(Math.random() * options.length);
    const selected = options[index];
    if (!selected) return;
    const target = 360 - (index + 0.5) * slice;
    setRotation((current) => current + 1800 + ((target - (current % 360) + 360) % 360));
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || options.length === 1) {
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
          <h1>{mode === 'food' ? '¿Qué comemos hoy?' : '¿Dónde comemos hoy?'}</h1>
          <p>
            Gira la ruleta: los {optionsName} seleccionados tienen la misma probabilidad de salir.
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
            <fieldset className="food-roulette__mode" disabled={pending !== null}>
              <legend className="sr-only">Qué quieres decidir</legend>
              <label>
                <input
                  ref={restaurantMode}
                  type="radio"
                  name="roulette-mode"
                  checked={mode === 'restaurant'}
                  onChange={() => changeMode('restaurant')}
                />
                Restaurante
              </label>
              <label>
                <input
                  type="radio"
                  name="roulette-mode"
                  checked={mode === 'food'}
                  onChange={() => changeMode('food')}
                />
                Tipo de comida
              </label>
            </fieldset>
            {filteredType && (
              <div className="food-roulette__filter">
                <p>
                  Restaurantes de <strong>{filteredType.name}</strong>
                </p>
                <button
                  className="food-button food-button--quiet"
                  type="button"
                  disabled={pending !== null}
                  onClick={() => filterRestaurants(null)}
                >
                  Ver todos los restaurantes
                </button>
              </div>
            )}
            <div className="food-roulette__wheel-wrap">
              <div className="food-roulette__pointer" aria-hidden="true" />
              <div
                className="food-roulette__wheel"
                aria-hidden="true"
                style={{
                  transform: `rotate(${rotation}deg)`,
                  transition: pending ? undefined : 'none',
                  background: options.length
                    ? `conic-gradient(${options.map((_, index) => `${COLORS[index % COLORS.length]} ${index * slice}deg ${(index + 1) * slice}deg`).join(', ')})`
                    : 'var(--food-line)',
                }}
              >
                {options.map((option, index) => (
                  <span
                    className="food-roulette__number"
                    key={option.id}
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
                <p>Eligiendo {optionName}…</p>
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
                  {options.length === 0
                    ? `Selecciona al menos un ${optionName} para girar.`
                    : options.length === 1
                      ? `Solo hay un ${optionName} disponible.`
                      : `${options.length} ${optionsName}. Una decisión menos.`}
                </p>
              )}
            </div>
            {mode === 'food' && winner && (
              <button
                className="food-button food-button--quiet"
                type="button"
                onClick={() => filterRestaurants(winner.id)}
              >
                Elegir restaurante de {winner.name}
              </button>
            )}
            <section aria-labelledby="roulette-restaurants">
              <h2 id="roulette-restaurants">
                {mode === 'food' ? 'Tipos de comida' : 'Restaurantes'} en la ruleta
              </h2>
              <p>
                Desmarca los {optionsName} que quieras quitar. Puedes volver a marcarlos cuando
                quieras.
              </p>
              {mode === 'food' && allOptions.length === 0 && (
                <p>Vuelve a «Restaurante» y marca alguna opción para ver sus tipos de comida.</p>
              )}
              <ul className="food-roulette__legend">
                {allOptions.map((option) => {
                  const index = options.indexOf(option);
                  return (
                    <li key={option.id}>
                      <label>
                        <input
                          type="checkbox"
                          checked={index !== -1}
                          disabled={pending !== null}
                          onChange={() => toggleOption(option.id)}
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
                        {option.name}
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
