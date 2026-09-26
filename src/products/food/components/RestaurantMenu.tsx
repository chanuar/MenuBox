import { useEffect, useMemo, useRef, useState } from 'react';
import { getRestaurantMenu } from '../api/foodApi';
import { menuCategoryPriority, normalizeSearch } from '../model/order';
import type { MenuItem, Restaurant } from '../model/types';
import { ItemDetailModal, MenuItemCard } from './MenuItems';

export function RestaurantMenu({
  restaurant,
  onClose,
}: {
  restaurant: Restaurant;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const detailOpener = useRef<HTMLElement | null>(null);
  const [items, setItems] = useState<MenuItem[] | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('Todos');
  const [detail, setDetail] = useState<MenuItem | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const dialog = dialogRef.current!;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog.showModal();
    return () => {
      dialog.close();
      document.body.style.overflow = overflow;
      opener?.focus({ preventScroll: true });
    };
  }, []);

  useEffect(() => {
    let active = true;
    getRestaurantMenu(restaurant.id).then(
      (data) => {
        if (active) setItems(data);
      },
      () => {
        if (active) setError('No hemos podido cargar la carta. Puedes volver a intentarlo.');
      },
    );
    return () => {
      active = false;
    };
  }, [restaurant.id, attempt]);

  const ordered = useMemo(
    () =>
      [...(items ?? [])].sort(
        (a, b) => menuCategoryPriority(a.category) - menuCategoryPriority(b.category),
      ),
    [items],
  );
  const categories = ['Todos', ...new Set(ordered.map((item) => item.category))];
  const search = normalizeSearch(query.trim());
  const visible = ordered.filter(
    (item) =>
      (category === 'Todos' || item.category === category) &&
      (!search ||
        normalizeSearch(`${item.name} ${item.description} ${item.category}`).includes(search)),
  );

  return (
    <>
      <dialog
        ref={dialogRef}
        className="food-catalog-modal"
        aria-labelledby="restaurant-menu-title"
        onCancel={(event) => {
          event.preventDefault();
          onClose();
        }}
        onClick={(event) => {
          if (event.target === event.currentTarget) onClose();
        }}
      >
        <div className="food-catalog-modal__panel">
          <header className="food-catalog-modal__header">
            <div>
              <p className="food-kicker">Explora la carta</p>
              <h2 id="restaurant-menu-title">{restaurant.name}</h2>
            </div>
            <button
              type="button"
              className="food-button food-button--quiet"
              onClick={onClose}
              aria-label="Cerrar carta"
            >
              Cerrar <span aria-hidden="true">×</span>
            </button>
          </header>
          <p className="food-help">
            Carta de referencia. Los precios y la disponibilidad pueden cambiar en el restaurante.
          </p>
          {error ? (
            <div className="food-inline-empty">
              <p role="alert">{error}</p>
              <button
                type="button"
                className="food-button"
                onClick={() => {
                  setError('');
                  setAttempt((value) => value + 1);
                }}
              >
                Reintentar
              </button>
            </div>
          ) : items === null ? (
            <p className="food-catalog-loading" role="status">
              Preparando la carta…
            </p>
          ) : items.length === 0 ? (
            <p role="status" className="food-inline-empty">
              Este restaurante todavía no tiene platos disponibles.
            </p>
          ) : (
            <>
              <div className="food-filters">
                <label className="food-search">
                  <span className="sr-only">Buscar en esta carta</span>
                  <input
                    ref={searchRef}
                    type="search"
                    placeholder="Busca tu próximo favorito…"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                  />
                </label>
                <div
                  className="food-categories"
                  role="group"
                  aria-label="Filtrar carta por categoría"
                >
                  {categories.map((value) => (
                    <button
                      key={value}
                      type="button"
                      className={category === value ? 'is-active' : ''}
                      aria-pressed={category === value}
                      onClick={() => setCategory(value)}
                    >
                      {value}
                    </button>
                  ))}
                </div>
              </div>
              <p className="food-help" role="status">
                {visible.length} {visible.length === 1 ? 'plato encontrado' : 'platos encontrados'}
              </p>
              {visible.length ? (
                <div className="food-menu-sections">
                  {[...new Set(visible.map((item) => item.category))].map((value) => (
                    <section className="food-menu-category" key={value}>
                      <h3>{value}</h3>
                      <div className="food-menu-grid">
                        {visible
                          .filter((item) => item.category === value)
                          .map((item) => (
                            <MenuItemCard
                              key={item.id}
                              item={item}
                              onOpen={(item, event) => {
                                detailOpener.current = event.currentTarget;
                                setDetail(item);
                              }}
                            />
                          ))}
                      </div>
                    </section>
                  ))}
                </div>
              ) : (
                <div className="food-inline-empty">
                  <p>No hay platos con esos filtros.</p>
                  <button
                    type="button"
                    className="food-button food-button--quiet"
                    onClick={() => {
                      setQuery('');
                      setCategory('Todos');
                      searchRef.current?.focus();
                    }}
                  >
                    Limpiar filtros
                  </button>
                </div>
              )}
            </>
          )}
          {restaurant.sourceUrl && (
            <a
              className="food-option-card__link"
              href={restaurant.sourceUrl}
              target="_blank"
              rel="noreferrer"
            >
              Consultar en Uber Eats <span aria-hidden="true">↗</span>
              <span className="sr-only"> (se abre en una pestaña nueva)</span>
            </a>
          )}
        </div>
      </dialog>
      {detail && (
        <ItemDetailModal
          key={detail.id}
          item={detail}
          onClose={() => {
            setDetail(null);
            requestAnimationFrame(() => detailOpener.current?.focus({ preventScroll: true }));
          }}
        />
      )}
    </>
  );
}
