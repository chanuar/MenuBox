import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import type { FormEvent, MouseEvent } from 'react';
import { Link, useBlocker, useLoaderData } from 'react-router';
import { FoodApiError, getActiveMenu, getOrder, submitOrder, updateOrder } from '../api/foodApi';
import FoodHeader from '../components/FoodHeader';
import FoodMark from '../components/FoodMark';
import { OpeningHours } from '../components/OpeningHours';
import { forgetCredential, readLastCredential, saveCredential } from '../model/storage';
import {
  MAX_QUANTITY,
  cartCount,
  cartToPayload,
  cartTotal,
  formatEuros,
  formatSpanishDate,
  isBeverage,
  menuCategoryPriority,
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

type OrderDraft = {
  cycleId: string;
  orderId: string | null;
  displayName: string;
  orderNote: string;
  cart: Cart;
  dirty: boolean;
};

// ponytail: keep one active cycle in this tab; add durable drafts if cross-device recovery is needed.
let orderDraft: OrderDraft | null = null;
let memoryCredential: Credential | null = null;

function warnBeforeUnload(event: BeforeUnloadEvent) {
  if (!orderDraft?.dirty) return;
  event.preventDefault();
  event.returnValue = '';
}

function storeDraft(draft: OrderDraft | null) {
  orderDraft = draft;
  window.removeEventListener('beforeunload', warnBeforeUnload);
  if (draft?.dirty) window.addEventListener('beforeunload', warnBeforeUnload);
}

function focusSurface(id = 'main-content') {
  window.requestAnimationFrame(() => document.getElementById(id)?.focus());
}

export async function loader(): Promise<OrderRouteData> {
  const menu = await getActiveMenu();
  if (orderDraft?.cycleId !== menu?.cycle.id) storeDraft(null);
  if (menu && memoryCredential?.cycleId !== menu.cycle.id) memoryCredential = null;
  const candidate = memoryCredential ?? readLastCredential();
  const credential = menu && candidate?.cycleId !== menu.cycle.id ? null : candidate;
  if (orderDraft && orderDraft.orderId !== (credential?.orderId ?? null)) storeDraft(null);
  if (!credential) return { menu, credential: null, order: null };
  try {
    const order = await getOrder(credential.orderId, credential.token);
    if (order.cycleStatus === 'closed') storeDraft(null);
    return { menu, credential, order };
  } catch (error) {
    if (error instanceof FoodApiError && error.code === 'FOOD_ORDER_NOT_FOUND') {
      forgetCredential(credential);
      memoryCredential = null;
      storeDraft(null);
      return { menu, credential: null, order: null };
    }
    throw error;
  }
}

function EmptyWeek() {
  return (
    <main id="main-content" className="food-state food-state--centered" tabIndex={-1}>
      <div className="food-state__symbol" aria-hidden="true">
        <FoodMark />
      </div>
      <p className="food-kicker">Esta semana</p>
      <h1>Estamos preparando la próxima mesa</h1>
      <p>No hay ningún pedido abierto. Mientras el equipo elige, encuentra tu próximo favorito.</p>
      <div className="food-state__actions">
        <Link className="food-button" to="/options">
          Explorar restaurantes
        </Link>
        <Link className="food-button food-button--quiet" to="/roulette">
          Dejarlo a la suerte
        </Link>
      </div>
    </main>
  );
}

function MenuItemImage({
  item,
  className,
  onError,
}: {
  item: MenuItem;
  className: string;
  onError: () => void;
}) {
  return (
    <img
      className={`${className}${isBeverage(item.category) ? ' food-item-image--beverage' : ''}`}
      src={item.imageUrl ?? undefined}
      alt=""
      loading="lazy"
      onError={onError}
    />
  );
}

function QuantityControl({
  item,
  quantity,
  onQuantity,
}: {
  item: MenuItem;
  quantity: number;
  onQuantity: (itemId: string, quantity: number) => void;
}) {
  const addButtonRef = useRef<HTMLButtonElement>(null);
  return (
    <div className="food-quantity" role="group" aria-label={`Cantidad de ${item.name}`}>
      {quantity > 0 && (
        <>
          <button
            type="button"
            onClick={() => {
              onQuantity(item.id, quantity - 1);
              if (quantity === 1) window.requestAnimationFrame(() => addButtonRef.current?.focus());
            }}
            aria-label={`Quitar una unidad de ${item.name}`}
          >
            −
          </button>
          <span className="food-quantity__value">{quantity}</span>
        </>
      )}
      <button
        ref={addButtonRef}
        className={quantity ? undefined : 'food-add-button'}
        type="button"
        onClick={() => onQuantity(item.id, quantity + 1)}
        disabled={quantity >= MAX_QUANTITY}
        aria-label={`Añadir una unidad de ${item.name}`}
      >
        {quantity ? '+' : 'Añadir +'}
      </button>
    </div>
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
  onOpen: (item: MenuItem, event: MouseEvent<HTMLElement>) => void;
}) {
  const quantity = entry?.quantity ?? 0;
  const [imageFailed, setImageFailed] = useState(false);
  const [noteInitiallyOpen] = useState(Boolean(entry?.note));
  const showImage = Boolean(item.imageUrl) && !isBeverage(item.category) && !imageFailed;
  return (
    <article
      className={`food-menu-card${showImage ? '' : ' food-menu-card--text'}${quantity ? ' food-menu-card--selected' : ''}`}
      aria-labelledby={`food-menu-item-${item.id}`}
    >
      {showImage && (
        <button
          className="food-menu-card__image-button"
          type="button"
          onClick={(event) => onOpen(item, event)}
          aria-label={`Ver foto y detalles de ${item.name}`}
        >
          <MenuItemImage
            item={item}
            className="food-menu-card__image"
            onError={() => setImageFailed(true)}
          />
        </button>
      )}
      <div className="food-menu-card__body">
        <div className="food-menu-card__heading">
          <h4 id={`food-menu-item-${item.id}`}>{item.name}</h4>
          <strong>{formatEuros(item.priceCents, item.currency)}</strong>
        </div>
        {item.description && <p className="food-menu-card__description">{item.description}</p>}
        <button
          id={`food-menu-details-${item.id}`}
          className="food-menu-card__details"
          type="button"
          aria-label={`Ver detalles de ${item.name}`}
          onClick={(event) => onOpen(item, event)}
        >
          Ver detalles
        </button>
        <QuantityControl item={item} quantity={quantity} onQuantity={onQuantity} />
        {quantity > 0 && (
          <details className="food-note-details" open={noteInitiallyOpen}>
            <summary>
              Nota para el plato <span className="sr-only">{item.name}</span>
            </summary>
            <label className="food-field food-field--item-note">
              <span>
                Nota para {item.name} <small>{entry?.note.length ?? 0}/240</small>
              </span>
              <input
                value={entry?.note ?? ''}
                maxLength={240}
                onChange={(event) => onNote(item.id, event.target.value)}
                placeholder="Sin cebolla, salsa aparte…"
              />
            </label>
          </details>
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
  const [imageFailed, setImageFailed] = useState(false);
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
        {item.imageUrl && !imageFailed && (
          <div className="food-item-modal__media">
            <MenuItemImage
              item={item}
              className="food-item-modal__image"
              onError={() => setImageFailed(true)}
            />
          </div>
        )}
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
            <QuantityControl item={item} quantity={quantity} onQuantity={onQuantity} />
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
  const count = order.items.reduce((sum, item) => sum + item.quantity, 0);
  return (
    <main id="main-content" className="food-confirmation" tabIndex={-1}>
      <div className="food-confirmation__status" aria-hidden="true">
        ✓
      </div>
      <p className="food-kicker">Pedido guardado</p>
      <h1>Apuntado, {order.displayName}.</h1>
      <p className="food-confirmation__lead">
        {order.cycleStatus === 'closed'
          ? `El pedido de ${restaurant?.name ?? 'esta semana'} ya está cerrado. Esta es tu confirmación.`
          : `Tu pedido para ${restaurant?.name ?? 'esta semana'} está guardado y puedes modificarlo mientras siga abierto.`}
      </p>
      <section className="food-receipt" aria-label="Resumen del pedido">
        <div className="food-receipt__heading">
          <p className="food-kicker">MenuBox · La mesa del equipo</p>
          <h2>{restaurant?.name ?? 'Tu pedido'}</h2>
          <span className="food-receipt__stamp">
            {order.cycleStatus === 'closed' ? 'Pedido cerrado' : 'Pedido recibido'}
          </span>
        </div>
        <div className="food-receipt__meta">
          <span>{formatSpanishDate(order.updatedAt)}</span>
          <span>
            {count} {count === 1 ? 'unidad' : 'unidades'}
          </span>
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
        <p className="food-receipt__footer">Una decisión menos. Buen provecho.</p>
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
  const [resumedDraft] = useState(() =>
    orderDraft?.cycleId === initialData.menu?.cycle.id &&
    initialData.order?.cycleStatus !== 'closed'
      ? orderDraft
      : null,
  );
  const [workflow, dispatch] = useReducer(orderWorkflowReducer, initialData, (data) => ({
    ...initialOrderWorkflow(data),
    ...(resumedDraft ? { editing: true } : {}),
  }));
  const { active, savedOrder, credential, editing } = workflow;
  const [displayName, setDisplayName] = useState(
    resumedDraft?.displayName ?? initialData.order?.displayName ?? '',
  );
  const [orderNote, setOrderNote] = useState(
    resumedDraft?.orderNote ?? initialData.order?.note ?? '',
  );
  const [noteInitiallyOpen] = useState(Boolean(orderNote));
  const [cart, setCart] = useState<Cart>(() =>
    resumedDraft
      ? Object.fromEntries(
          Object.entries(resumedDraft.cart).filter(([id]) =>
            initialData.menu?.menuItems.some((item) => item.id === id),
          ),
        )
      : orderToCart(initialData.order, initialData.menu?.menuItems ?? null),
  );
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('Todos');
  const [pending, setPending] = useState(false);
  const blocker = useBlocker(pending);
  const [message, setMessage] = useState(() =>
    resumedDraft &&
    Object.keys(resumedDraft.cart).some(
      (id) => !initialData.menu?.menuItems.some((item) => item.id === id),
    )
      ? 'Algunos platos de tu selección ya no están disponibles. Revisa tu pedido antes de enviarlo.'
      : '',
  );
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
  const searchRef = useRef<HTMLInputElement>(null);
  const [invalidField, setInvalidField] = useState('');

  useEffect(() => {
    if (blocker.state === 'blocked') blocker.reset();
  }, [blocker]);

  useEffect(() => {
    if (!active || !editing) {
      storeDraft(null);
      return;
    }
    const savedCart = orderToCart(savedOrder, active.menuItems);
    const dirty =
      displayName !== (savedOrder?.displayName ?? '') ||
      orderNote !== (savedOrder?.note ?? '') ||
      Object.keys(cart).length !== Object.keys(savedCart).length ||
      Object.entries(cart).some(
        ([id, entry]) =>
          entry.quantity !== savedCart[id]?.quantity || entry.note !== savedCart[id]?.note,
      );
    storeDraft({
      cycleId: active.cycle.id,
      orderId: credential?.orderId ?? null,
      displayName,
      orderNote,
      cart,
      dirty: dirty || pending,
    });
  }, [active, credential, editing, savedOrder, displayName, orderNote, cart, pending]);

  function openItemDetails(item: MenuItem, event: MouseEvent<HTMLElement>) {
    detailOpenerRef.current = event.currentTarget;
    setSelectedItem(item);
  }

  function closeItemDetails() {
    const itemId = selectedItem?.id;
    setSelectedItem(null);
    window.requestAnimationFrame(() => {
      const opener = detailOpenerRef.current;
      const target = opener?.isConnected
        ? opener
        : (document.getElementById(`food-menu-details-${itemId}`) ??
          document.getElementById('main-content'));
      target?.focus();
    });
  }

  const menuItems = useMemo(
    () =>
      [...(active?.menuItems ?? [])].sort(
        (a, b) => menuCategoryPriority(a.category) - menuCategoryPriority(b.category),
      ),
    [active],
  );

  const categories = useMemo(() => {
    const values = new Set(menuItems.map((item) => item.category));
    return ['Todos', ...values];
  }, [menuItems]);

  const visibleItems = useMemo(() => {
    const q = normalizeSearch(query.trim());
    return menuItems.filter(
      (item) =>
        (category === 'Todos' || item.category === category) &&
        (!q || normalizeSearch(`${item.name} ${item.description} ${item.category}`).includes(q)),
    );
  }, [menuItems, category, query]);

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
        memoryCredential = nextCredential;
        if (orderDraft?.cycleId === active.cycle.id)
          storeDraft({ ...orderDraft, orderId: created.orderId });
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
      memoryCredential = nextCredential;
      storeDraft(null);
      setDisplayName(order.displayName);
      setOrderNote(order.note);
      setCart(orderToCart(order, active.menuItems));
      setUnavailableItems([]);
      focusSurface();
      window.scrollTo({ top: 0, behavior: 'instant' });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No hemos podido guardar el pedido.');
      if (error instanceof FoodApiError && error.code === 'FOOD_CYCLE_CLOSED' && credential) {
        try {
          const order = await getOrder(credential.orderId, credential.token);
          dispatch({ type: 'closed', order });
        } catch {
          dispatch({ type: 'closed', order: null });
        }
        focusSurface();
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
    memoryCredential = null;
    storeDraft(null);
    setUnavailableItems([]);
    setDeviceWarning('');
    setDisplayName('');
    setOrderNote('');
    setCart({});
    dispatch({ type: 'forget' });
    focusSurface();
  }

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
            focusSurface('food-order-title');
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
  if (!active)
    return (
      <div className="food-shell">
        <FoodHeader />
        <EmptyWeek />
      </div>
    );

  const count = cartCount(cart);
  const total = cartTotal(cart, active.menuItems);

  return (
    <div className={`food-shell${count ? ' food-shell--with-cart-bar' : ''}`}>
      <FoodHeader />
      <main id="main-content" tabIndex={-1}>
        <section
          className={`food-hero${active.restaurant.imageUrl ? ' food-hero--photo' : ''}`}
          aria-labelledby="food-restaurant-title"
        >
          <div className="food-hero__content">
            <p className="food-kicker">Esta semana · Pedido abierto</p>
            <h1 id="food-restaurant-title">{active.restaurant.name}</h1>
            <p>La mesa del equipo empieza aquí. Elige algo rico, nosotros lo apuntamos.</p>
            <span>Pedido abierto desde {formatSpanishDate(active.cycle.openedAt)}</span>
            <OpeningHours openingHours={active.restaurant.openingHours} />
            <div className="food-hero__actions">
              {active.menuItems.length > 0 && (
                <a
                  className="food-button"
                  href="#menu-title"
                  onClick={(event) => {
                    event.preventDefault();
                    focusSurface('menu-title');
                  }}
                >
                  Elegir platos <span aria-hidden="true">↓</span>
                </a>
              )}
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
          </div>
          {active.restaurant.imageUrl && (
            <div className="food-hero__media">
              <img
                src={active.restaurant.imageUrl}
                alt=""
                fetchPriority="high"
                onError={(event) => {
                  event.currentTarget.hidden = true;
                }}
              />
            </div>
          )}
        </section>

        {active.menuItems.length === 0 ? (
          <section className="food-state food-state--inline">
            <h2>El menú todavía está vacío</h2>
            <p>
              Vuelve en un rato: el restaurante está seleccionado, pero aún no hay platos
              disponibles.
            </p>
            <Link className="food-button food-button--quiet" to="/options">
              Explorar restaurantes
            </Link>
          </section>
        ) : (
          <fieldset
            className="food-order-layout food-order-fields"
            disabled={pending}
            aria-label="Preparar pedido"
          >
            <section className="food-menu" aria-labelledby="menu-title">
              <div className="food-section-heading">
                <div>
                  <p className="food-kicker">La carta de esta semana</p>
                  <h2 id="menu-title" tabIndex={-1}>
                    ¿Qué te apetece?
                  </h2>
                </div>
                <span>{active.menuItems.length} platos</span>
              </div>
              <div className="food-filters">
                <label className="food-search">
                  <span className="sr-only">Buscar en la carta</span>
                  <input
                    ref={searchRef}
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
                <div className="food-menu-sections">
                  {[...new Set(visibleItems.map((item) => item.category))].map((value, index) => (
                    <section
                      className="food-menu-category"
                      key={value}
                      aria-labelledby={`food-category-${index}`}
                    >
                      <h3 id={`food-category-${index}`}>{value}</h3>
                      <div className="food-menu-grid">
                        {visibleItems
                          .filter((item) => item.category === value)
                          .map((item) => (
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
                    </section>
                  ))}
                </div>
              ) : (
                <div className="food-inline-empty">
                  <p>
                    No hay platos que coincidan. Recupera la carta completa para seguir eligiendo.
                  </p>
                  <button
                    className="food-button food-button--quiet"
                    type="button"
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
            </section>

            <aside id="food-order-summary" className="food-cart" aria-labelledby="food-order-title">
              <div className="food-cart__top">
                <p className="food-kicker">MenuBox · Tu ticket</p>
                <span role="status" aria-live="polite">
                  {count} {count === 1 ? 'unidad' : 'unidades'}
                </span>
              </div>
              <h2 id="food-order-title" tabIndex={-1}>
                Tu pedido
              </h2>
              {count ? (
                <div className="food-cart__lines">
                  {Object.entries(cart).map(([id, entry]) => {
                    const item = active.menuItems.find((candidate) => candidate.id === id);
                    return item ? (
                      <div className="food-cart__line" key={id}>
                        <span className="food-cart__line-content">
                          {item.name}
                          {entry.note && <small>{entry.note}</small>}
                        </span>
                        <strong>{formatEuros(item.priceCents * entry.quantity)}</strong>
                        <div className="food-cart__line-quantity">
                          <QuantityControl
                            item={item}
                            quantity={entry.quantity}
                            onQuantity={(itemId, quantity) => {
                              setQuantity(itemId, quantity);
                              if (!quantity) focusSurface('food-order-title');
                            }}
                          />
                        </div>
                      </div>
                    ) : null;
                  })}
                </div>
              ) : (
                <p className="food-cart__empty">
                  Tu hueco en la mesa está listo. Elige algo rico de la carta.
                </p>
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
                <details className="food-note-details" open={noteInitiallyOpen}>
                  <summary>
                    Añadir una nota general <span className="food-help">(opcional)</span>
                  </summary>
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
                      aria-describedby={
                        invalidField === 'orderNote' ? 'food-order-error' : undefined
                      }
                    />
                  </label>
                </details>
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
                {pending && (
                  <p className="food-help" role="status">
                    Guardando tu pedido, un momento…
                  </p>
                )}
              </form>
              {deviceWarning && (
                <div className="food-form-error" role="status">
                  {deviceWarning}
                </div>
              )}
              <p className="food-help">
                Tu selección se conserva al explorar esta pestaña. Envíala para que llegue al
                equipo; podrás editarla mientras el pedido siga abierto.
              </p>
            </aside>
          </fieldset>
        )}
      </main>
      {count > 0 && (
        <a
          className="food-cart-bar"
          href="#food-order-summary"
          onClick={(event) => {
            event.preventDefault();
            focusSurface('food-order-title');
          }}
        >
          <span>
            <strong>
              {count} {count === 1 ? 'unidad' : 'unidades'} · {formatEuros(total)}
            </strong>
            <span>
              Revisar pedido <span aria-hidden="true">↑</span>
            </span>
          </span>
        </a>
      )}
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
  const data = useLoaderData() as OrderRouteData;
  return (
    <FoodApp
      key={`${data.menu?.cycle.id ?? data.order?.cycleId ?? 'empty'}:${data.credential?.orderId ?? 'new'}:${data.order?.cycleStatus ?? 'open'}`}
      initialData={data}
    />
  );
}
