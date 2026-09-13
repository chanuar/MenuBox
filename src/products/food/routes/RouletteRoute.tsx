import { useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { Link, useLoaderData } from 'react-router';
import { getRestaurantOptions } from '../api/foodApi';
import FoodHeader from '../components/FoodHeader';
import FoodMark from '../components/FoodMark';
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
  const selectionHeading = useRef<HTMLHeadingElement>(null);
  const winningRestaurant =
    mode === 'restaurant' ? allRestaurants.find(({ id }) => id === winner?.id) : undefined;
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
    const update = () => {
      setExcludedOptions((current) =>
        current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
      );
      resetSpin();
    };
    if (
      document.startViewTransition &&
      !window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      document.startViewTransition(() => flushSync(update));
    } else {
      update();
    }
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
            <FoodMark className="food-state__mark" />
            <h2>Todavía no hay restaurantes disponibles</h2>
            <p>Estamos preparando las próximas cartas. Pronto habrá más de dónde elegir.</p>
            <Link className="food-button food-button--quiet" to="/">
              Ir a mi pedido
            </Link>
          </section>
        ) : (
          <>
            <fieldset className="food-roulette__mode" disabled={pending !== null}>
              <legend className="sr-only">Qué quieres decidir</legend>
              <label>
                <input
                  className="sr-only"
                  ref={restaurantMode}
                  type="radio"
                  name="roulette-mode"
                  checked={mode === 'restaurant'}
                  onChange={() => changeMode('restaurant')}
                />
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  aria-hidden="true"
                >
                  <path d="M4 10v10h16V10M3 10l2-6h14l2 6M3 10a3 3 0 0 0 4.5 2.6A3 3 0 0 0 12 12a3 3 0 0 0 4.5.6A3 3 0 0 0 21 10M9 20v-5h6v5" />
                </svg>
                Restaurante
              </label>
              <label>
                <input
                  className="sr-only"
                  type="radio"
                  name="roulette-mode"
                  checked={mode === 'food'}
                  onChange={() => changeMode('food')}
                />
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  aria-hidden="true"
                >
                  <path d="M5 3v5a3 3 0 0 0 6 0V3M8 3v18M19 21V3c-4 2-4 7 0 9" />
                </svg>
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
            <div className="food-roulette__layout">
              <div className="food-roulette__stage">
                <button
                  className="food-button food-button--quiet food-roulette__change-selection"
                  type="button"
                  disabled={pending !== null}
                  aria-controls="roulette-restaurants"
                  onClick={() => selectionHeading.current?.focus()}
                >
                  Cambiar selección <span aria-hidden="true">↓</span>
                </button>
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
                        className={`food-roulette__number${options.length <= 8 ? ' food-roulette__number--named' : ''}`}
                        key={option.id}
                        style={{ transform: `rotate(${(index + 0.5) * slice}deg)` }}
                      >
                        <span>
                          <b>{index + 1}</b>
                          {options.length <= 8 && <small>{option.name}</small>}
                        </span>
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
                    <svg
                      width="26"
                      height="26"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M20 7v5h-5M20 12a8 8 0 1 0-2.3 5.7" />
                    </svg>
                    <span>Girar</span>
                  </button>
                </div>
                <div
                  className="food-roulette__result"
                  data-state={winner ? 'winner' : pending ? 'spinning' : 'idle'}
                  role="status"
                  aria-live="polite"
                  aria-atomic="true"
                >
                  {pending ? (
                    <p>Eligiendo {optionName}…</p>
                  ) : winner ? (
                    <>
                      {winningRestaurant?.imageUrl && (
                        <img
                          className="food-roulette__winner-image"
                          key={winningRestaurant.imageUrl}
                          src={winningRestaurant.imageUrl}
                          alt=""
                          onError={(event) => {
                            event.currentTarget.hidden = true;
                          }}
                        />
                      )}
                      <h2 className="food-roulette__winner-name">
                        ¡Hoy toca <strong>{winner.name}</strong>!
                      </h2>
                      {mode === 'food' ? (
                        <button
                          className="food-button"
                          type="button"
                          onClick={() => filterRestaurants(winner.id)}
                        >
                          Elegir restaurante de {winner.name}
                        </button>
                      ) : winner.sourceUrl ? (
                        <a
                          className="food-button"
                          href={winner.sourceUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Ver carta en Uber Eats{' '}
                          <span className="sr-only">(se abre en una pestaña nueva)</span> ↗
                        </a>
                      ) : (
                        <p>Carta online no disponible</p>
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
                <button
                  className={`food-button food-roulette__spin${winner ? ' food-button--quiet' : ''}`}
                  type="button"
                  disabled={spinDisabled}
                  onClick={spin}
                >
                  {pending ? 'Girando…' : winner ? 'Volver a girar' : 'Girar ruleta'}
                </button>
              </div>
              <section className="food-roulette__selection" aria-labelledby="roulette-restaurants">
                <div className="food-roulette__selection-heading">
                  <div>
                    <h2 id="roulette-restaurants" ref={selectionHeading} tabIndex={-1}>
                      {mode === 'food' ? 'Tipos de comida' : 'Restaurantes'}
                    </h2>
                  </div>
                  <span
                    className="food-roulette__count"
                    aria-label={`${options.length} de ${allOptions.length} seleccionados`}
                  >
                    {options.length}
                    <span> / {allOptions.length}</span>
                  </span>
                </div>
                <p className="food-roulette__selection-hint">
                  Marca los que te apetecen. La suerte elige el resto.
                </p>
                {mode === 'food' && allOptions.length === 0 && (
                  <p>Vuelve a «Restaurante» y marca alguna opción para ver sus tipos de comida.</p>
                )}
                <ul className="food-roulette__legend">
                  {allOptions.map((option) => {
                    const index = options.indexOf(option);
                    return (
                      <li key={option.id}>
                        <label className="food-roulette__option">
                          <input
                            className="sr-only"
                            type="checkbox"
                            checked={index !== -1}
                            disabled={pending !== null}
                            onChange={() => toggleOption(option.id)}
                          />
                          <span
                            className="food-roulette__badge"
                            style={{
                              backgroundColor:
                                index === -1 ? undefined : COLORS[index % COLORS.length],
                            }}
                            aria-hidden="true"
                          >
                            {index === -1 ? '–' : index + 1}
                          </span>
                          <span className="food-roulette__option-name">{option.name}</span>
                          <span className="food-roulette__check" aria-hidden="true">
                            <svg
                              width="14"
                              height="14"
                              viewBox="0 0 16 16"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <path d="m3 8 3 3 7-7" />
                            </svg>
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </section>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
