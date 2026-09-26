import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import type { FormEvent, MouseEvent } from 'react';
import { Link, useBlocker, useLoaderData } from 'react-router';
import { FoodApiError, getActiveMenu, getOrder, submitOrder, updateOrder } from '../api/foodApi';
import FoodHeader from '../components/FoodHeader';
import FoodMark from '../components/FoodMark';
import { MenuItemCard, ItemDetailModal, QuantityControl } from '../components/MenuItems';
import { OpeningHours } from '../components/OpeningHours';
import { forgetCredential, readLastCredential, saveCredential } from '../model/storage';
import {
  MAX_QUANTITY,
  cartCount,
  cartToPayload,
  cartTotal,
  formatEuros,
  formatSpanishDate,
  menuCategoryPriority,
  normalizeSearch,
  orderToCart,
  unavailableOrderItems,
  validateOrder,
} from '../model/order';
import { initialOrderWorkflow, orderWorkflowReducer } from '../model/orderState';
import type {
  Cart,
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
        <Link className="food-button" to="/demo">
          Probar un pedido de ejemplo
        </Link>
        <Link className="food-button food-button--quiet" to="/options">
          Explorar restaurantes
        </Link>
        <Link className="food-button food-button--quiet" to="/roulette">
          Dejarlo a la suerte
        </Link>
      </div>
      <section className="food-how-it-works" aria-labelledby="order-guide-title">
        <p className="food-kicker">Así funciona MenuBox</p>
        <h2 id="order-guide-title">Del menú al pedido, en tres pasos</h2>
        <ol>
          <li>
            <h3>Elige tus platos</h3>
            <p>
              Cuando se abre el pedido del equipo, explora la carta del restaurante y añade las
              cantidades que quieras.
            </p>
          </li>
          <li>
            <h3>Revisa y envía</h3>
            <p>
              Comprueba los platos y el total, escribe tu nombre y añade cualquier nota antes de
              enviar tu selección.
            </p>
          </li>
          <li>
            <h3>Vuelve cuando lo necesites</h3>
            <p>
              Tu confirmación queda accesible desde este navegador. Puedes modificar el pedido
              mientras siga abierto.
            </p>
          </li>
        </ol>
        <p className="food-how-it-works__credit">
          Un proyecto de <a href="https://chanuar.com">Carlos Chanuar</a>
          {' · '}
          <a href="https://github.com/chanuar/MenuBox">Ver código</a>
        </p>
      </section>
    </main>
  );
}

function OrderConfirmation({
  order,
  restaurant,
  editable,
  onEdit,
  onForget,
  warning = '',
  demo = false,
}: {
  order: FoodOrder;
  restaurant: Restaurant | null;
  editable: boolean;
  onEdit: () => void;
  onForget: () => void;
  warning?: string;
  demo?: boolean;
}) {
  const count = order.items.reduce((sum, item) => sum + item.quantity, 0);
  return (
    <main id="main-content" className="food-confirmation" tabIndex={-1}>
      {demo && <DemoNotice />}
      <div className="food-confirmation__status" aria-hidden="true">
        ✓
      </div>
      <p className="food-kicker">{demo ? 'Demostración completada' : 'Pedido guardado'}</p>
      <h1>Apuntado, {order.displayName}.</h1>
      <p className="food-confirmation__lead">
        {demo
          ? 'Así se vería tu confirmación. Este pedido es de ejemplo y no se ha enviado a ningún restaurante.'
          : order.cycleStatus === 'closed'
            ? `El pedido de ${restaurant?.name ?? 'esta semana'} ya está cerrado. Esta es tu confirmación.`
            : `Tu pedido para ${restaurant?.name ?? 'esta semana'} está guardado y puedes modificarlo mientras siga abierto.`}
      </p>
      <section className="food-receipt" aria-label="Resumen del pedido">
        <div className="food-receipt__heading">
          <p className="food-kicker">
            MenuBox · {demo ? 'Ticket de ejemplo' : 'La mesa del equipo'}
          </p>
          <h2>{restaurant?.name ?? 'Tu pedido'}</h2>
          <span className="food-receipt__stamp">
            {demo
              ? 'Solo una prueba'
              : order.cycleStatus === 'closed'
                ? 'Pedido cerrado'
                : 'Pedido recibido'}
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
          {demo ? 'Empezar de nuevo' : 'Olvidar en este dispositivo'}
        </button>
      </div>
      {warning && (
        <div className="food-form-error" role="status">
          {warning}
        </div>
      )}
      {!demo && (
        <p className="food-help">
          Si olvidas el pedido, seguirá enviado pero no podrás recuperarlo ni editarlo desde este
          dispositivo.
        </p>
      )}
    </main>
  );
}

function DemoNotice() {
  return (
    <aside className="food-demo-notice" aria-label="Pedido de demostración">
      <span>
        <strong>Estás probando MenuBox</strong> · Carta y precios de ejemplo. Nada se envía.
      </span>
      <Link to="/">
        Salir de la demo <span aria-hidden="true">↗</span>
      </Link>
    </aside>
  );
}

export function FoodApp({
  initialData,
  demo = false,
}: {
  initialData: OrderRouteData;
  demo?: boolean;
}) {
  const [resumedDraft] = useState(() =>
    !demo &&
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
  const [cartFeedback, setCartFeedback] = useState('');

  useEffect(() => {
    if (!cartFeedback) return;
    const timeout = window.setTimeout(() => setCartFeedback(''), 2600);
    return () => window.clearTimeout(timeout);
  }, [cartFeedback]);

  useEffect(() => {
    if (blocker.state === 'blocked') blocker.reset();
  }, [blocker]);

  useEffect(() => {
    if (demo) return;
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
  }, [active, credential, editing, savedOrder, displayName, orderNote, cart, pending, demo]);

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
    const item = active?.menuItems.find((item) => item.id === itemId);
    if (item)
      setCartFeedback(
        nextQuantity > 0
          ? `${item.name}: ${Math.min(nextQuantity, MAX_QUANTITY)} en tu pedido`
          : `${item.name} eliminado del pedido`,
      );
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
      if (demo) {
        const now = new Date().toISOString();
        const orderItems = items.map((entry) => {
          const item = active.menuItems.find((item) => item.id === entry.menu_item_id)!;
          return {
            id: item.id,
            menuItemId: item.id,
            name: item.name,
            unitPriceCents: item.priceCents,
            quantity: entry.quantity,
            note: entry.note ?? '',
            lineTotalCents: item.priceCents * entry.quantity,
          };
        });
        const order: FoodOrder = {
          id: 'demo-order',
          cycleId: active.cycle.id,
          cycleStatus: 'open',
          displayName: displayName.trim(),
          note: orderNote.trim(),
          createdAt: savedOrder?.createdAt ?? now,
          updatedAt: now,
          totalCents: orderItems.reduce((sum, item) => sum + item.lineTotalCents, 0),
          restaurant: active.restaurant,
          items: orderItems,
        };
        dispatch({
          type: 'saved',
          order,
          credential: { cycleId: active.cycle.id, orderId: order.id, token: 'demo-only' },
        });
        focusSurface();
        window.scrollTo({ top: 0, behavior: 'instant' });
        return;
      }
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
    if (demo) {
      setDisplayName('');
      setOrderNote('');
      setCart({});
      setQuery('');
      setCategory('Todos');
      setCartFeedback('');
      dispatch({ type: 'forget' });
      focusSurface();
      return;
    }
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
          demo={demo}
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
        {demo && <DemoNotice />}
        <section
          className={`food-hero${active.restaurant.imageUrl ? ' food-hero--photo' : ''}`}
          aria-labelledby="food-restaurant-title"
        >
          <div className="food-hero__content">
            <p className="food-kicker">
              {demo ? 'Tu primera mesa · Demostración' : 'Esta semana · Pedido abierto'}
            </p>
            <h1 id="food-restaurant-title">{active.restaurant.name}</h1>
            <p>
              {demo
                ? 'Elige, combina y prueba. Prepara tu pedido de ejemplo y descubre cómo queda el ticket del equipo.'
                : 'La mesa del equipo empieza aquí. Elige algo rico, nosotros lo apuntamos.'}
            </p>
            {!demo && (
              <>
                <span>Pedido abierto desde {formatSpanishDate(active.cycle.openedAt)}</span>
                <OpeningHours openingHours={active.restaurant.openingHours} />
              </>
            )}
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
                  {pending
                    ? 'Guardando…'
                    : demo
                      ? 'Confirmar pedido de ejemplo'
                      : credential
                        ? 'Guardar cambios'
                        : 'Enviar pedido'}
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
                {demo
                  ? 'Esta prueba vive solo en esta pantalla. Puedes confirmar y editar sin enviar nada.'
                  : 'Tu selección se conserva al explorar esta pestaña. Envíala para que llegue al equipo; podrás editarla mientras el pedido siga abierto.'}
              </p>
            </aside>
          </fieldset>
        )}
      </main>
      <p className="food-cart-feedback" role="status" aria-live="polite" aria-atomic="true">
        {cartFeedback}
      </p>
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
