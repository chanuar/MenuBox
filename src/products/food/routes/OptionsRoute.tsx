import { useState } from 'react';
import { Link, useLoaderData } from 'react-router';
import { getRestaurantOptions } from '../api/foodApi';
import FoodHeader from '../components/FoodHeader';
import FoodMark from '../components/FoodMark';
import { OpeningHours } from '../components/OpeningHours';
import type { Restaurant } from '../model/types';

function restaurantDescription(description: string) {
  return !description.trim() || /^usa tu cuenta de uber\b/i.test(description.trim())
    ? ''
    : description.trim();
}

export const loader = () => getRestaurantOptions();

function RestaurantImage({ restaurant }: { restaurant: Restaurant }) {
  const [failed, setFailed] = useState(false);

  if (!restaurant.imageUrl || failed) {
    return (
      <div
        className="food-option-card__image food-option-card__image--placeholder"
        aria-hidden="true"
      >
        <FoodMark />
      </div>
    );
  }

  return (
    <img
      className="food-option-card__image"
      src={restaurant.imageUrl}
      alt=""
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}

export function Component() {
  const restaurants = useLoaderData() as Restaurant[];

  return (
    <div className="food-shell">
      <FoodHeader />
      <main id="main-content" className="food-options" tabIndex={-1}>
        <header className="food-options__intro">
          <div>
            <p className="food-kicker">Las cartas del equipo</p>
            <h1>Un sitio para cada antojo.</h1>
          </div>
          <div className="food-options__aside">
            <p>Explora restaurantes, consulta sus horarios y encuentra la próxima mesa.</p>
            <Link className="food-button food-button--quiet" to="/roulette">
              Que decida la suerte <span aria-hidden="true">↗</span>
            </Link>
          </div>
        </header>

        {restaurants.length === 0 && (
          <section className="food-state food-state--inline">
            <FoodMark className="food-state__mark" />
            <h2>Todavía no hay restaurantes disponibles</h2>
            <p>Estamos preparando las próximas cartas para compartir mesa.</p>
            <Link className="food-button food-button--quiet" to="/">
              Ir a mi pedido
            </Link>
          </section>
        )}
        {restaurants.length > 0 && (
          <section className="food-options-grid" aria-labelledby="food-options-title">
            <h2 className="sr-only" id="food-options-title">
              {restaurants.length} restaurantes disponibles
            </h2>
            {restaurants.map((restaurant) => (
              <article className="food-option-card" key={restaurant.id}>
                <RestaurantImage restaurant={restaurant} />
                <div className="food-option-card__body">
                  <div>
                    <h3>{restaurant.name}</h3>
                    {restaurantDescription(restaurant.description) && (
                      <p className="food-option-card__description">
                        {restaurantDescription(restaurant.description)}
                      </p>
                    )}
                    <p className="food-option-card__count">
                      {restaurant.availableItems}{' '}
                      {restaurant.availableItems === 1 ? 'plato disponible' : 'platos disponibles'}
                    </p>
                    <OpeningHours openingHours={restaurant.openingHours} />
                  </div>
                  {restaurant.sourceUrl ? (
                    <a
                      className="food-option-card__link"
                      href={restaurant.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Ver carta en Uber Eats <span className="sr-only">de {restaurant.name}</span>{' '}
                      <span aria-hidden="true">↗</span>
                      <span className="sr-only"> (se abre en una pestaña nueva)</span>
                    </a>
                  ) : (
                    <p className="food-option-card__unavailable">Carta online no disponible</p>
                  )}
                </div>
              </article>
            ))}
          </section>
        )}
      </main>
    </div>
  );
}
