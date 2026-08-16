import { useEffect, useMemo, useState, type FormEvent, type KeyboardEvent } from 'react';
import { Link, useLoaderData, useRevalidator } from 'react-router';
import { foodAdminApi, foodAuth, foodConfigured, FoodApiError } from '../api/foodApi';
import FoodHeader from '../components/FoodHeader';
import { OpeningHours, OpeningHoursForm } from '../components/OpeningHours';
import { aggregateItems, parseServiceFee } from '../model/admin';
import { formatEuros, formatSpanishDate } from '../model/order';
import type { AdminCycle, AdminRouteData, OpeningDay, Restaurant } from '../model/types';

export async function loader(): Promise<AdminRouteData> {
  const session = await foodAuth.session();
  if (!session)
    return { session: null, authorized: undefined, catalog: [], current: null, history: [] };
  try {
    const authorized = Boolean(await foodAdminApi.access());
    if (!authorized) return { session, authorized: false, catalog: [], current: null, history: [] };
    const [catalog, current, history] = await Promise.all([
      foodAdminApi.catalog(),
      foodAdminApi.current(),
      foodAdminApi.history(),
    ]);
    return { session, authorized: true, catalog, current, history };
  } catch (error) {
    if (error instanceof FoodApiError && error.code === 'FOOD_FORBIDDEN')
      return { session, authorized: false, catalog: [], current: null, history: [] };
    throw error;
  }
}

function AdminSignIn({
  onSubmit,
  pending,
  error,
}: {
  onSubmit: (email: string, password: string) => void;
  pending: boolean;
  error: string;
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  return (
    <main id="main-content" className="food-admin-auth" tabIndex={-1}>
      <p className="food-kicker">Zona reservada</p>
      <h1>Administración</h1>
      <p>Accede con tu cuenta aprobada para abrir, revisar y cerrar el pedido semanal.</p>
      {!foodConfigured && (
        <div className="food-admin-notice" role="status">
          Falta configurar la conexión con Supabase. Añade las variables indicadas en{' '}
          <code>.env.example</code>.
        </div>
      )}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit(email, password);
        }}
      >
        <label className="food-field">
          <span>Correo electrónico</span>
          <input
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? 'food-sign-in-error' : undefined}
          />
        </label>
        <label className="food-field">
          <span>Contraseña</span>
          <input
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? 'food-sign-in-error' : undefined}
          />
        </label>
        {error && (
          <div id="food-sign-in-error" className="food-form-error" role="alert">
            {error}
          </div>
        )}
        <button
          className="food-button food-button--wide"
          type="submit"
          disabled={pending || !foodConfigured}
        >
          {pending ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
      <Link className="food-admin-auth__back" to="/">
        ← Volver al pedido
      </Link>
    </main>
  );
}

function CycleTotals({ cycle, serviceFeeCents }: { cycle: AdminCycle; serviceFeeCents?: number }) {
  const subtotal = cycle.subtotalCents;
  const fee = serviceFeeCents ?? cycle.serviceFeeCents;
  const total = subtotal + fee;
  return (
    <div className="food-cycle-totals" role="group" aria-label="Totales del pedido">
      <div>
        <span>Subtotal de pedidos</span>
        <strong>{formatEuros(subtotal)}</strong>
      </div>
      <div>
        <span>Gastos de servicio</span>
        <strong>{formatEuros(fee)}</strong>
      </div>
      <div className="food-cycle-totals__final">
        <span>Total</span>
        <strong>{formatEuros(total)}</strong>
      </div>
    </div>
  );
}

function OrderGroups({ cycle, serviceFeeCents }: { cycle: AdminCycle; serviceFeeCents: number }) {
  const [mode, setMode] = useState<'people' | 'items'>('people');
  const aggregated = useMemo(() => aggregateItems(cycle.orders), [cycle.orders]);
  return (
    <section className="food-admin-orders">
      <div className="food-admin-orders__heading">
        <div>
          <p className="food-kicker">Pedidos recibidos</p>
          <h2>
            {cycle.orders.length} {cycle.orders.length === 1 ? 'persona' : 'personas'}
          </h2>
        </div>
        <div className="food-admin-toggle" role="group" aria-label="Agrupar pedidos">
          <button
            type="button"
            className={mode === 'people' ? 'is-active' : ''}
            onClick={() => setMode('people')}
            aria-pressed={mode === 'people'}
          >
            Por persona
          </button>
          <button
            type="button"
            className={mode === 'items' ? 'is-active' : ''}
            onClick={() => setMode('items')}
            aria-pressed={mode === 'items'}
          >
            Por plato
          </button>
        </div>
      </div>
      {!cycle.orders.length ? (
        <div className="food-inline-empty">Todavía no ha llegado ningún pedido.</div>
      ) : mode === 'people' ? (
        <div className="food-admin-order-list">
          {cycle.orders.map((order) => (
            <article key={order.id} className="food-admin-order">
              <div className="food-admin-order__person">
                <div className="food-avatar" aria-hidden="true">
                  {order.displayName.slice(0, 1).toLocaleUpperCase('es')}
                </div>
                <div>
                  <h3>{order.displayName}</h3>
                  <span>Actualizado {formatSpanishDate(order.updatedAt)}</span>
                </div>
                <strong>{formatEuros(order.totalCents)}</strong>
              </div>
              <div className="food-admin-order__items">
                {order.items.map((item) => (
                  <div key={item.id}>
                    <span>
                      <b>{item.quantity} ×</b> {item.name}
                      {item.note && <small>{item.note}</small>}
                    </span>
                    <strong>{formatEuros(item.unitPriceCents * item.quantity)}</strong>
                  </div>
                ))}
              </div>
              {order.note && (
                <p className="food-admin-order__note">
                  <strong>Nota general:</strong> {order.note}
                </p>
              )}
            </article>
          ))}
        </div>
      ) : (
        <div className="food-admin-item-list">
          {aggregated.map((item) => (
            <article key={item.name}>
              <span className="food-admin-item-list__quantity">{item.quantity}</span>
              <div>
                <h3>{item.name}</h3>
                {item.notes.map((note) => (
                  <small key={note}>{note}</small>
                ))}
              </div>
              <strong>{formatEuros(item.totalCents)}</strong>
            </article>
          ))}
        </div>
      )}
      <CycleTotals cycle={cycle} serviceFeeCents={serviceFeeCents} />
    </section>
  );
}

function OpenCycleCard({
  catalog,
  onOpen,
  pending,
}: {
  catalog: Restaurant[];
  onOpen: (id: string) => void;
  pending: boolean;
}) {
  const [restaurantId, setRestaurantId] = useState(catalog[0]?.id ?? '');
  const selected = catalog.some((restaurant) => restaurant.id === restaurantId)
    ? restaurantId
    : (catalog[0]?.id ?? '');
  return (
    <section className="food-admin-open-card">
      <div>
        <p className="food-kicker">Nueva semana</p>
        <h2>Abre un pedido</h2>
        <p>Elige uno de los restaurantes importados que tenga platos disponibles.</p>
      </div>
      {catalog.length ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            onOpen(selected);
          }}
        >
          <label className="food-field">
            <span>Restaurante</span>
            <select value={selected} onChange={(event) => setRestaurantId(event.target.value)}>
              {catalog.map((restaurant) => (
                <option value={restaurant.id} key={restaurant.id}>
                  {restaurant.name} · {restaurant.availableItems} platos
                </option>
              ))}
            </select>
          </label>
          <button className="food-button" type="submit" disabled={pending || !selected}>
            {pending ? 'Abriendo…' : 'Abrir pedido semanal'}
          </button>
        </form>
      ) : (
        <div className="food-inline-empty">
          No hay restaurantes disponibles con platos importados.
        </div>
      )}
    </section>
  );
}

function RestaurantHoursManager({
  catalog,
  onSave,
  pending,
}: {
  catalog: Restaurant[];
  onSave: (id: string, hours: OpeningDay[]) => void;
  pending: boolean;
}) {
  return (
    <section className="food-admin-restaurants" aria-labelledby="restaurant-hours-title">
      <div className="food-section-heading">
        <div>
          <p className="food-kicker">Disponibilidad</p>
          <h2 id="restaurant-hours-title">Horarios de restaurantes</h2>
        </div>
        <span>{catalog.length} restaurantes</span>
      </div>
      <p className="food-admin-restaurants__intro">
        Configura los días y tramos de apertura. Los cambios aparecen en el pedido y en la página de
        restaurantes.
      </p>
      <div className="food-admin-restaurant-list">
        {catalog.map((restaurant) => (
          <details className="food-admin-restaurant" key={restaurant.id}>
            <summary>
              <strong>{restaurant.name}</strong>
              <span>{restaurant.availableItems} platos</span>
            </summary>
            <div className="food-admin-restaurant__body">
              <OpeningHours openingHours={restaurant.openingHours} />
              <OpeningHoursForm restaurant={restaurant} onSave={onSave} pending={pending} />
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}

function History({ cycles }: { cycles: AdminCycle[] }) {
  return (
    <section className="food-admin-history">
      <div className="food-section-heading">
        <div>
          <p className="food-kicker">Archivo</p>
          <h2>Semanas anteriores</h2>
        </div>
        <span>{cycles.length} ciclos</span>
      </div>
      {!cycles.length ? (
        <div className="food-inline-empty">Aún no hay pedidos cerrados.</div>
      ) : (
        cycles.map((cycle) => (
          <details key={cycle.id} className="food-history-cycle">
            <summary>
              <span>
                <strong>{cycle.restaurant.name}</strong>
                <small>{formatSpanishDate(cycle.closedAt)}</small>
              </span>
              <span>
                {cycle.orders.length} pedidos · {formatEuros(cycle.totalCents)}
              </span>
            </summary>
            <div className="food-history-cycle__body">
              {cycle.orders.map((order) => (
                <div className="food-history-order" key={order.id}>
                  <div>
                    <strong>{order.displayName}</strong>
                    <span>
                      {order.items.map((item) => `${item.quantity} × ${item.name}`).join(' · ')}
                    </span>
                  </div>
                  <strong>{formatEuros(order.totalCents)}</strong>
                </div>
              ))}
              <CycleTotals cycle={cycle} />
            </div>
          </details>
        ))
      )}
    </section>
  );
}

export function Component() {
  const { session, authorized, catalog, current, history } = useLoaderData() as AdminRouteData;
  const { revalidate, state: revalidationState } = useRevalidator();
  const [tab, setTab] = useState<'current' | 'restaurants' | 'history'>('current');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [serviceFee, setServiceFee] = useState('0,00');
  const [serviceFeeError, setServiceFeeError] = useState('');
  const busy = pending || revalidationState !== 'idle';

  useEffect(() => foodAuth.onChange(() => revalidate()), [revalidate]);

  async function mutate(action: () => Promise<unknown>, success?: () => void) {
    setPending(true);
    setError('');
    try {
      await action();
      success?.();
      revalidate();
    } catch (mutationError) {
      setError(
        mutationError instanceof Error ? mutationError.message : 'Ha ocurrido un error inesperado.',
      );
    } finally {
      setPending(false);
    }
  }

  function handleTabKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    const tabs = [
      ...event.currentTarget.parentElement!.querySelectorAll<HTMLButtonElement>('[role="tab"]'),
    ];
    const index = tabs.indexOf(event.currentTarget);
    const nextIndex =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? tabs.length - 1
          : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
    event.preventDefault();
    const next = tabs[nextIndex]!;
    setTab(next.dataset.tab as typeof tab);
    next.focus();
  }

  async function closeCycle(event: FormEvent) {
    event.preventDefault();
    const fee = parseServiceFee(serviceFee);
    if (fee === null)
      return setServiceFeeError('Introduce un importe válido con un máximo de dos decimales.');
    if (
      !current ||
      !window.confirm(
        `Al cerrar el pedido nadie podrá enviarlo ni editarlo. Gastos de servicio: ${formatEuros(fee)}. ¿Quieres continuar?`,
      )
    )
      return;
    setServiceFeeError('');
    await mutate(
      () => foodAdminApi.closeCycle(current.id, fee),
      () => {
        setServiceFee('0,00');
        setTab('history');
      },
    );
  }

  if (!session)
    return (
      <div className="food-shell">
        <FoodHeader compact />
        <AdminSignIn
          pending={busy}
          error={error}
          onSubmit={(email, password) => mutate(() => foodAuth.signIn(email, password))}
        />
      </div>
    );
  if (authorized === false)
    return (
      <div className="food-shell">
        <FoodHeader compact />
        <main id="main-content" className="food-state food-state--centered" tabIndex={-1}>
          <div className="food-state__symbol food-state__symbol--error" aria-hidden="true">
            !
          </div>
          <p className="food-kicker">Acceso limitado</p>
          <h1>Esta cuenta no es administradora</h1>
          <p>
            {session.user.email} ha iniciado sesión correctamente, pero no está incluida en la lista
            de administradores de pedidos.
          </p>
          <button
            className="food-button food-button--quiet"
            type="button"
            onClick={() => mutate(() => foodAuth.signOut())}
          >
            Cerrar sesión
          </button>
        </main>
      </div>
    );

  return (
    <div className="food-shell food-shell--admin">
      <FoodHeader compact />
      <main id="main-content" className="food-admin" tabIndex={-1}>
        <header className="food-admin__header">
          <div>
            <p className="food-kicker">Panel de equipo</p>
            <h1>Pedido semanal</h1>
            <p>{session.user.email}</p>
          </div>
          <button
            className="food-button food-button--quiet"
            type="button"
            onClick={() => mutate(() => foodAuth.signOut())}
            disabled={busy}
          >
            Cerrar sesión
          </button>
        </header>
        <div className="food-admin-tabs" role="tablist" aria-label="Secciones de administración">
          {(['current', 'restaurants', 'history'] as const).map((value) => (
            <button
              id={`admin-tab-${value}`}
              data-tab={value}
              role="tab"
              type="button"
              key={value}
              aria-selected={tab === value}
              aria-controls="admin-panel"
              tabIndex={tab === value ? 0 : -1}
              className={tab === value ? 'is-active' : ''}
              onKeyDown={handleTabKeyDown}
              onClick={() => setTab(value)}
            >
              {value === 'current' ? (
                'Semana actual'
              ) : value === 'restaurants' ? (
                <>
                  Restaurantes <span>{catalog.length}</span>
                </>
              ) : (
                <>
                  Historial <span>{history.length}</span>
                </>
              )}
            </button>
          ))}
        </div>
        {error && (
          <div className="food-admin-error" role="alert">
            <span>{error}</span>
            <button type="button" onClick={() => revalidate()}>
              Reintentar
            </button>
          </div>
        )}
        {notice && (
          <div className="food-admin-notice" role="status">
            {notice}
          </div>
        )}
        <div id="admin-panel" role="tabpanel" aria-labelledby={`admin-tab-${tab}`} tabIndex={0}>
          {tab === 'history' ? (
            <History cycles={history} />
          ) : tab === 'restaurants' ? (
            <RestaurantHoursManager
              catalog={catalog}
              pending={busy}
              onSave={(id, hours) =>
                mutate(async () => {
                  const updated = await foodAdminApi.updateRestaurantHours(id, hours);
                  setNotice(`Horario de ${updated.name} guardado.`);
                })
              }
            />
          ) : current ? (
            <>
              <section className="food-admin-current">
                <div>
                  <p className="food-kicker">Pedido abierto</p>
                  <h2>{current.restaurant.name}</h2>
                  <p>Desde {formatSpanishDate(current.openedAt)}</p>
                  <OpeningHours
                    openingHours={
                      catalog.find((restaurant) => restaurant.id === current.restaurant.id)
                        ?.openingHours
                    }
                    compact
                  />
                </div>
                <form className="food-admin-current__close" onSubmit={closeCycle}>
                  <label>
                    <span>Gastos de servicio</span>
                    <span className="food-admin-money-input">
                      <span aria-hidden="true">€</span>
                      <input
                        inputMode="decimal"
                        value={serviceFee}
                        onChange={(event) => {
                          setServiceFee(event.target.value);
                          setServiceFeeError('');
                        }}
                        aria-invalid={Boolean(serviceFeeError)}
                        aria-describedby={serviceFeeError ? 'service-fee-error' : undefined}
                      />
                    </span>
                  </label>
                  <button className="food-button food-button--danger" type="submit" disabled={busy}>
                    {busy ? 'Cerrando…' : 'Cerrar pedido'}
                  </button>
                  {serviceFeeError && (
                    <small id="service-fee-error" role="alert">
                      {serviceFeeError}
                    </small>
                  )}
                </form>
              </section>
              <OrderGroups cycle={current} serviceFeeCents={parseServiceFee(serviceFee) ?? 0} />
            </>
          ) : (
            <OpenCycleCard
              catalog={catalog}
              pending={busy}
              onOpen={(id) => mutate(() => foodAdminApi.openCycle(id))}
            />
          )}
        </div>
      </main>
    </div>
  );
}
