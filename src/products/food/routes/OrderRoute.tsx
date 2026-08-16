import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import type { FormEvent, MouseEvent } from 'react';
import { useLoaderData } from 'react-router';
import {
  FoodApiError,
  foodConfigured,
  getActiveMenu,
  getOrder,
  submitOrder,
  updateOrder,
} from '../api/foodApi';
import FoodHeader from '../components/FoodHeader';
import { OpeningHours } from '../components/OpeningHours';
import { forgetCredential, readLastCredential, saveCredential } from '../model/storage';
import {
  MAX_QUANTITY,
  cartCount,
  cartToPayload,
  cartTotal,
  formatEuros,
  formatSpanishDate,
  normalizeSearch,
  orderToCart,
  unavailableOrderItems,
  validateOrder,
} from '../model/order';
import { initialOrderWorkflow, orderWorkflowReducer } from '../model/orderState';
import type {
  Cart,
  CartEntry,
  Credential,
  FoodOrder,
  MenuItem,
  OrderRouteData,
  Restaurant,
} from '../model/types';

export async function loader(): Promise<OrderRouteData> {
  const menu = await getActiveMenu();
  const credential = readLastCredential();
  if (!credential || (menu && credential.cycleId !== menu.cycle.id))
    return { menu, credential: null, order: null };
  try {
    return { menu, credential, order: await getOrder(credential.orderId, credential.token) };
  } catch (error) {
    if (error instanceof FoodApiError && error.code === 'FOOD_ORDER_NOT_FOUND') {
      forgetCredential(credential);
      return { menu, credential: null, order: null };
    }
    throw error;
  }
}

function EmptyWeek({ configured = true }: { configured?: boolean }) {
  return (
    <main id="main-content" className="food-state food-state--centered" tabIndex={-1}>
      <div className="food-state__symbol" aria-hidden="true">
        ☼
      </div>
      <p className="food-kicker">Esta semana</p>
      <h1>No hay ningún pedido abierto</h1>
      <p>
        {configured
          ? 'Cuando el equipo elija restaurante, aquí aparecerá el menú para hacer tu pedido.'
          : 'La aplicación está lista. Falta conectar el proyecto de Supabase para empezar a recibir pedidos.'}
      </p>
    </main>
  );
}

function MenuItemImage({ item, className }: { item: MenuItem; className: string }) {
  const [failed, setFailed] = useState(false);
  if (!item.imageUrl || failed) {
    return (
      <div className={`${className} food-item-image--placeholder`} aria-hidden="true">
        <span>{item.category?.slice(0, 1) || item.name.slice(0, 1)}</span>
      </div>
    );
  }
  return (
    <img
      className={className}
      src={item.imageUrl}
      alt=""
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}

function MenuItemCard({
  item,
  entry,
  onQuantity,
  onNote,
  onOpen,
}: {
  item: MenuItem;
  entry?: CartEntry;
  onQuantity: (itemId: string, quantity: number) => void;
  onNote: (itemId: string, note: string) => void;
  onOpen: (item: MenuItem, event?: MouseEvent<HTMLElement>) => void;
}) {
  const quantity = entry?.quantity ?? 0;
  return (
    <article
      className={`food-menu-card${quantity ? ' food-menu-card--selected' : ''}`}
      aria-labelledby={`food-menu-item-${item.id}`}
    >
      <div className="food-menu-card__image-button" onClick={() => onOpen(item)} aria-hidden="true">
        <MenuItemImage item={item} className="food-menu-card__image" />
      </div>
      <div className="food-menu-card__body">
        <p className="food-menu-card__category">{item.category}</p>
        <div className="food-menu-card__heading">
          <h3 id={`food-menu-item-${item.id}`}>{item.name}</h3>
          <strong>{formatEuros(item.priceCents, item.currency)}</strong>
        </div>
        {item.description && <p className="food-menu-card__description">{item.description}</p>}
        <button
          className="food-menu-card__details"
          type="button"
          onClick={(event) => onOpen(item, event)}
        >
          Ver detalles
        </button>
        <div className="food-quantity" role="group" aria-label={`Cantidad de ${item.name}`}>
          <button
            type="button"
            onClick={() => onQuantity(item.id, quantity - 1)}
            disabled={!quantity}
            aria-label={`Quitar una unidad de ${item.name}`}
          >
            −
          </button>
          <span className="food-quantity__value">{quantity}</span>
          <button
            type="button"
            onClick={() => onQuantity(item.id, quantity + 1)}
            disabled={quantity >= MAX_QUANTITY}
            aria-label={`Añadir una unidad de ${item.name}`}
          >
            +
          </button>
        </div>
        {quantity > 0 && (
          <label className="food-field food-field--item-note">
            <span>
              Nota para este plato <small>{entry?.note.length ?? 0}/240</small>
            </span>
            <input
              value={entry?.note ?? ''}
              maxLength={240}
              onChange={(event) => onNote(item.id, event.target.value)}
              placeholder="Sin cebolla, salsa aparte…"
            />
          </label>
        )}
      </div>
    </article>
  );
}

function ItemDetailModal({
  item,
  entry,
  onQuantity,
  onClose,
}: {
  item: MenuItem;
  entry?: CartEntry;
  onQuantity: (itemId: string, quantity: number) => void;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const quantity = entry?.quantity ?? 0;

  useEffect(() => {
    const dialog = dialogRef.current!;
    dialog.showModal();
    closeButtonRef.current?.focus();
    return () => dialog.close();
  }, []);

  function close() {
    dialogRef.current?.close();
    onClose();
  }

  return (
    <dialog
      ref={dialogRef}
      className="food-item-modal"
      aria-labelledby={`food-item-title-${item.id}`}
      aria-describedby={`food-item-description-${item.id}`}
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <section className="food-item-modal__panel">
        <button
          ref={closeButtonRef}
          className="food-item-modal__close"
          type="button"
          onClick={close}
          aria-label="Cerrar detalles"
        >
          <span aria-hidden="true">×</span>
        </button>
        <div className="food-item-modal__media">
          <MenuItemImage item={item} className="food-item-modal__image" />
        </div>
        <div className="food-item-modal__content">
          <p className="food-menu-card__category">{item.category}</p>
          <h2 id={`food-item-title-${item.id}`}>{item.name}</h2>
          <strong className="food-item-modal__price">
            {formatEuros(item.priceCents, item.currency)}
          </strong>
          <p id={`food-item-description-${item.id}`} className="food-item-modal__description">
            {item.description || 'Este plato no tiene descripción disponible.'}
          </p>
          <div className="food-item-modal__actions">
            <span>{quantity ? `${quantity} en tu pedido` : 'Añádelo a tu pedido'}</span>
            <div className="food-quantity" role="group" aria-label={`Cantidad de ${item.name}`}>
              <button
                type="button"
                onClick={() => onQuantity(item.id, quantity - 1)}
                disabled={!quantity}
                aria-label={`Quitar una unidad de ${item.name}`}
              >
                −
              </button>
              <span className="food-quantity__value">{quantity}</span>
              <button
                type="button"
                onClick={() => onQuantity(item.id, quantity + 1)}
                disabled={quantity >= MAX_QUANTITY}
                aria-label={`Añadir una unidad de ${item.name}`}
              >
                +
              </button>
            </div>
          </div>
        </div>
      </section>
    </dialog>
  );
}

function OrderConfirmation({
  order,
  restaurant,
  editable,
  onEdit,
  onForget,
  warning = '',
}: {
  order: FoodOrder;
  restaurant: Restaurant | null;
  editable: boolean;
  onEdit: () => void;
  onForget: () => void;
  warning?: string;
}) {
  return (
    <main id="main-content" className="food-confirmation" tabIndex={-1}>
      <div className="food-confirmation__status" aria-hidden="true">
        ✓
      </div>
      <p className="food-kicker">Pedido guardado</p>
      <h1>Todo listo, {order.displayName}</h1>
      <p className="food-confirmation__lead">
        {order.cycleStatus === 'closed'
          ? `El pedido de ${restaurant?.name ?? 'esta semana'} ya está cerrado. Esta es tu confirmación.`
          : `Tu pedido para ${restaurant?.name ?? 'esta semana'} está guardado y puedes modificarlo mientras siga abierto.`}
      </p>
      <section className="food-receipt" aria-label="Resumen del pedido">
        <div className="food-receipt__meta">
          <span>{formatSpanishDate(order.updatedAt)}</span>
          <span>{order.items.reduce((sum, item) => sum + item.quantity, 0)} unidades</span>
        </div>
        {order.items.map((item) => (
          <div className="food-receipt__line" key={item.id ?? item.menuItemId}>
            <span>
              <strong>{item.quantity} ×</strong> {item.name}
              {item.note && <small>{item.note}</small>}
            </span>
            <strong>
              {formatEuros(item.lineTotalCents ?? item.unitPriceCents * item.quantity)}
            </strong>
          </div>
        ))}
        {order.note && (
          <div className="food-receipt__note">
            <strong>Nota general</strong>
            <p>{order.note}</p>
          </div>
        )}
        <div className="food-receipt__total">
          <span>Total</span>
          <strong>{formatEuros(order.totalCents)}</strong>
        </div>
      </section>
      <div className="food-confirmation__actions">
        {editable && (
          <button className="food-button" type="button" onClick={onEdit}>
            Editar pedido
          </button>
        )}
        <button className="food-button food-button--quiet" type="button" onClick={onForget}>
          Olvidar en este dispositivo
        </button>
      </div>
      {warning && (
        <div className="food-form-error" role="status">
          {warning}
        </div>
      )}
      <p className="food-help">
        Si olvidas el pedido, seguirá enviado pero no podrás recuperarlo ni editarlo desde este
        dispositivo.
      </p>
    </main>
  );
}

function FoodApp({ initialData }: { initialData: OrderRouteData }) {
  const [workflow, dispatch] = useReducer(orderWorkflowReducer, initialData, initialOrderWorkflow);
  const { active, savedOrder, credential, editing } = workflow;
  const [displayName, setDisplayName] = useState(initialData.order?.displayName ?? '');
  const [orderNote, setOrderNote] = useState(initialData.order?.note ?? '');
  const [cart, setCart] = useState<Cart>(() =>
    orderToCart(initialData.order, initialData.menu?.menuItems ?? null),
  );
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('Todos');
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');
  const [unavailableItems, setUnavailableItems] = useState(() =>
    initialData.order && initialData.menu
      ? unavailableOrderItems(initialData.order, initialData.menu.menuItems)
      : [],
  );
  const [deviceWarning, setDeviceWarning] = useState('');
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const detailOpenerRef = useRef<HTMLElement | null>(null);
  const formErrorRef = useRef<HTMLDivElement>(null);
  const displayNameRef = useRef<HTMLInputElement>(null);
  const orderNoteRef = useRef<HTMLTextAreaElement>(null);
  const [invalidField, setInvalidField] = useState('');

  function openItemDetails(item: MenuItem, event?: MouseEvent<HTMLElement>) {
    detailOpenerRef.current = event?.currentTarget ?? null;
    setSelectedItem(item);
  }

  function closeItemDetails() {
    setSelectedItem(null);
    window.requestAnimationFrame(() => detailOpenerRef.current?.focus());
  }

  const categories = useMemo(() => {
    const values = new Set((active?.menuItems ?? []).map((item) => item.category));
    return ['Todos', ...values];
  }, [active]);

  const visibleItems = useMemo(() => {
    const q = normalizeSearch(query.trim());
    return (active?.menuItems ?? []).filter(
      (item) =>
        (category === 'Todos' || item.category === category) &&
        (!q || normalizeSearch(`${item.name} ${item.description} ${item.category}`).includes(q)),
    );
  }, [active, category, query]);

  function setQuantity(itemId: string, nextQuantity: number) {
    setCart((current) => {
      const next = { ...current };
      if (nextQuantity <= 0) delete next[itemId];
      else
        next[itemId] = {
          quantity: Math.min(nextQuantity, MAX_QUANTITY),
          note: current[itemId]?.note ?? '',
        };
      return next;
    });
  }

  function setItemNote(itemId: string, note: string) {
    setCart((current) => ({
      ...current,
      [itemId]: { quantity: current[itemId]?.quantity ?? 1, note },
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || !active) return;
    const validationMessage = validateOrder({ displayName, orderNote, cart });
    if (validationMessage) {
      setMessage(validationMessage);
      const nextInvalidField =
        !displayName.trim() || displayName.trim().length > 80
          ? 'displayName'
          : orderNote.length > 500
            ? 'orderNote'
            : 'cart';
      setInvalidField(nextInvalidField);
      window.requestAnimationFrame(() => {
        if (nextInvalidField === 'displayName') displayNameRef.current?.focus();
        else if (nextInvalidField === 'orderNote') orderNoteRef.current?.focus();
        else formErrorRef.current?.focus();
      });
      return;
    }
    setPending(true);
    setMessage('');
    setInvalidField('');
    try {
      const items = cartToPayload(cart);
      let nextCredential: Credential | null = credential;
      let order: FoodOrder;
      if (credential) {
        order = await updateOrder({
          orderId: credential.orderId,
          token: credential.token,
          displayName: displayName.trim(),
          note: orderNote.trim(),
          items,
        });
        try {
          saveCredential(credential);
          setDeviceWarning('');
        } catch {
          setDeviceWarning(
            'El pedido está guardado, pero este navegador no permite conservar el acceso. Mantén esta pestaña abierta si necesitas editarlo.',
          );
        }
      } else {
        const created = await submitOrder({
          cycleId: active.cycle.id,
          displayName: displayName.trim(),
          note: orderNote.trim(),
          items,
        });
        nextCredential = {
          cycleId: active.cycle.id,
          orderId: created.orderId,
          token: created.token,
        };
        // The server has committed at this point. Record that fact before any
        // fallible local-storage or confirmation request so a retry updates the
        // existing order instead of creating a duplicate.
        dispatch({ type: 'credential-recorded', credential: nextCredential });
        try {
          saveCredential(nextCredential);
          setDeviceWarning('');
        } catch {
          setDeviceWarning(
            'El pedido está guardado, pero este navegador no permite conservar el acceso. Mantén esta pestaña abierta si necesitas editarlo.',
          );
        }
        try {
          order = await getOrder(created.orderId, created.token);
        } catch {
          setMessage(
            'El pedido se ha guardado, pero no pudimos cargar la confirmación. Pulsa “Guardar cambios” para recuperarla sin crear otro pedido.',
          );
          return;
        }
      }
      if (!nextCredential)
        throw new FoodApiError(
          'FOOD_INVALID_RESPONSE',
          'No hemos podido recuperar el acceso al pedido.',
        );
      dispatch({ type: 'saved', credential: nextCredential, order });
      setUnavailableItems([]);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No hemos podido guardar el pedido.');
      if (error instanceof FoodApiError && error.code === 'FOOD_CYCLE_CLOSED' && credential) {
        try {
          const order = await getOrder(credential.orderId, credential.token);
          dispatch({ type: 'closed', order });
        } catch {
          dispatch({ type: 'closed', order: null });
        }
      }
    } finally {
      setPending(false);
    }
  }

  function handleForget() {
    if (
      !window.confirm(
        'El pedido seguirá enviado, pero perderás el acceso para editarlo. ¿Quieres olvidarlo en este dispositivo?',
      )
    )
      return;
    forgetCredential(credential);
    setUnavailableItems([]);
    setDeviceWarning('');
    setDisplayName('');
    setOrderNote('');
    setCart({});
    dispatch({ type: 'forget' });
  }

  if (!active)
    return (
      <div className="food-shell">
        <FoodHeader />
        <EmptyWeek configured={foodConfigured} />
      </div>
    );
  if (savedOrder && !editing) {
    return (
      <div className="food-shell">
        <FoodHeader />
        <OrderConfirmation
          order={savedOrder}
          restaurant={active?.restaurant ?? savedOrder.restaurant}
          editable={savedOrder.cycleStatus === 'open' && active?.cycle.id === savedOrder.cycleId}
          onEdit={() => {
            dispatch({ type: 'edit' });
            if (unavailableItems.length) {
              const names = unavailableItems.map((item) => item.name).join(', ');
              setMessage(
                `${names} ya no ${unavailableItems.length === 1 ? 'está disponible y se quitará' : 'están disponibles y se quitarán'} al guardar los cambios.`,
              );
            }
          }}
          onForget={handleForget}
          warning={deviceWarning}
        />
      </div>
    );
  }

  const count = cartCount(cart);
  const total = cartTotal(cart, active.menuItems);

  return (
    <div className="food-shell">
      <FoodHeader />
      <main id="main-content" tabIndex={-1}>
        <section
          className={`food-hero${active.restaurant.imageUrl ? ' food-hero--photo' : ''}`}
          aria-labelledby="food-restaurant-title"
        >
          {active.restaurant.imageUrl && <img src={active.restaurant.imageUrl} alt="" />}
          <div className="food-hero__shade" />
          <div className="food-hero__content">
            <p className="food-kicker">Pedido abierto</p>
            <h1 id="food-restaurant-title">{active.restaurant.name}</h1>
            {active.restaurant.description && <p>{active.restaurant.description}</p>}
            <span>Abierto desde {formatSpanishDate(active.cycle.openedAt)}</span>
            <OpeningHours openingHours={active.restaurant.openingHours} compact />
            {active.restaurant.sourceUrl && (
              <a
                className="food-hero__source"
                href={active.restaurant.sourceUrl}
                target="_blank"
                rel="noreferrer"
              >
                Ver en Uber Eats <span aria-hidden="true">↗</span>
                <span className="sr-only"> (se abre en una pestaña nueva)</span>
              </a>
            )}
          </div>
        </section>

        {active.menuItems.length === 0 ? (
          <section className="food-state food-state--inline">
            <h2>El menú todavía está vacío</h2>
            <p>
              Vuelve en un rato: el restaurante está seleccionado, pero aún no hay platos
              disponibles.
            </p>
          </section>
        ) : (
          <div className="food-order-layout">
            <section className="food-menu" aria-labelledby="menu-title">
              <div className="food-section-heading">
                <div>
                  <p className="food-kicker">Elige lo que te apetezca</p>
                  <h2 id="menu-title">Carta</h2>
                </div>
                <span>{active.menuItems.length} platos</span>
              </div>
              <div className="food-filters">
                <label className="food-search">
                  <span className="sr-only">Buscar en la carta</span>
                  <input
                    type="search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Buscar un plato…"
                  />
                </label>
                <div className="food-categories" role="group" aria-label="Filtrar por categoría">
                  {categories.map((value) => (
                    <button
                      type="button"
                      key={value}
                      className={category === value ? 'is-active' : ''}
                      aria-pressed={category === value}
                      onClick={() => setCategory(value)}
                    >
                      {value}
                    </button>
                  ))}
                </div>
              </div>
              <p className="sr-only" role="status" aria-live="polite">
                {visibleItems.length}{' '}
                {visibleItems.length === 1 ? 'plato encontrado' : 'platos encontrados'}
              </p>
              {visibleItems.length ? (
                <div className="food-menu-grid">
                  {visibleItems.map((item) => (
                    <MenuItemCard
                      key={item.id}
                      item={item}
                      entry={cart[item.id]}
                      onQuantity={setQuantity}
                      onNote={setItemNote}
                      onOpen={openItemDetails}
                    />
                  ))}
                </div>
              ) : (
                <div className="food-inline-empty">
                  No hay platos que coincidan. Prueba otra búsqueda o categoría.
                </div>
              )}
            </section>

            <aside className="food-cart" aria-label="Tu pedido">
              <div className="food-cart__top">
                <p className="food-kicker">Tu selección</p>
                <span role="status" aria-live="polite">
                  {count} {count === 1 ? 'unidad' : 'unidades'}
                </span>
              </div>
              <h2>Tu pedido</h2>
              {count ? (
                <div className="food-cart__lines">
                  {Object.entries(cart).map(([id, entry]) => {
                    const item = active.menuItems.find((candidate) => candidate.id === id);
                    return item ? (
                      <div key={id}>
                        <span>
                          {entry.quantity} × {item.name}
                        </span>
                        <strong>{formatEuros(item.priceCents * entry.quantity)}</strong>
                      </div>
                    ) : null;
                  })}
                </div>
              ) : (
                <p className="food-cart__empty">Añade algún plato de la carta para empezar.</p>
              )}
              <div className="food-cart__total">
                <span>Total</span>
                <strong>{formatEuros(total)}</strong>
              </div>
              <form onSubmit={handleSubmit} noValidate>
                <label className="food-field">
                  <span>
                    Tu nombre <small>{displayName.length}/80</small>
                  </span>
                  <input
                    ref={displayNameRef}
                    required
                    autoComplete="name"
                    maxLength={80}
                    value={displayName}
                    onChange={(event) => {
                      setDisplayName(event.target.value);
                      if (invalidField === 'displayName') setInvalidField('');
                    }}
                    placeholder="Cómo te reconocerá el equipo"
                    aria-invalid={invalidField === 'displayName'}
                    aria-describedby={
                      invalidField === 'displayName' ? 'food-order-error' : undefined
                    }
                  />
                </label>
                <label className="food-field">
                  <span>
                    Nota general <small>{orderNote.length}/500 · opcional</small>
                  </span>
                  <textarea
                    ref={orderNoteRef}
                    maxLength={500}
                    value={orderNote}
                    onChange={(event) => {
                      setOrderNote(event.target.value);
                      if (invalidField === 'orderNote') setInvalidField('');
                    }}
                    placeholder="Algo que debamos saber sobre todo el pedido…"
                    aria-invalid={invalidField === 'orderNote'}
                    aria-describedby={invalidField === 'orderNote' ? 'food-order-error' : undefined}
                  />
                </label>
                {message && (
                  <div
                    ref={formErrorRef}
                    id="food-order-error"
                    className="food-form-error"
                    role="alert"
                    tabIndex={-1}
                  >
                    {message}
                  </div>
                )}
                <button
                  className="food-button food-button--wide"
                  type="submit"
                  disabled={pending || !count}
                >
                  {pending ? 'Guardando…' : credential ? 'Guardar cambios' : 'Enviar pedido'}
                </button>
              </form>
              {deviceWarning && (
                <div className="food-form-error" role="status">
                  {deviceWarning}
                </div>
              )}
              <p className="food-help">
                Podrás editarlo desde este dispositivo mientras el pedido siga abierto.
              </p>
            </aside>
          </div>
        )}
      </main>
      {selectedItem && (
        <ItemDetailModal
          item={selectedItem}
          entry={cart[selectedItem.id]}
          onQuantity={setQuantity}
          onClose={closeItemDetails}
        />
      )}
    </div>
  );
}

export function Component() {
  return <FoodApp initialData={useLoaderData() as OrderRouteData} />;
}
