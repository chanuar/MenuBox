import { createClient, type Session } from '@supabase/supabase-js';
import { supabaseEnvironment } from '../../../shared/config/supabase';
import type {
  ActiveMenu,
  AdminCycle,
  FoodOrder,
  OpeningDay,
  OrderItemPayload,
  Restaurant,
} from '../model/types';

export const foodConfigured = supabaseEnvironment.configured;
const foodClient = foodConfigured
  ? createClient(supabaseEnvironment.url, supabaseEnvironment.publishableKey)
  : null;

const ERROR_MESSAGES: Record<string, string> = {
  FOOD_NO_ACTIVE_CYCLE: 'No hay ningún pedido abierto esta semana.',
  FOOD_CYCLE_CLOSED: 'El pedido se ha cerrado mientras estabas editando.',
  FOOD_ORDER_NOT_FOUND: 'No hemos podido recuperar ese pedido en este dispositivo.',
  FOOD_FORBIDDEN: 'Tu cuenta no tiene permiso para administrar pedidos.',
  FOOD_OPEN_CYCLE_EXISTS: 'Ya hay un pedido semanal abierto.',
  FOOD_INVALID_ITEMS: 'Algún plato ya no está disponible. Revisa el pedido.',
  FOOD_INVALID_INPUT: 'Revisa los datos del pedido e inténtalo de nuevo.',
};

export class FoodApiError extends Error {
  constructor(
    public code: string,
    message: string,
    cause?: unknown,
  ) {
    super(message, { cause });
    this.name = 'FoodApiError';
  }
}

type RawMenuItem = {
  id: string;
  restaurant_id?: string;
  category?: string | null;
  name: string;
  description?: string | null;
  price_cents?: number;
  currency?: string | null;
  image_url?: string | null;
  available?: boolean;
};
type RawRestaurant = {
  id: string;
  name: string;
  description?: string | null;
  image_url?: string | null;
  source_url?: string | null;
  available_items?: number;
  opening_hours?: OpeningDay[];
};
type RawOrderItem = {
  id: string;
  menu_item_id?: string;
  item_name?: string;
  unit_price_cents?: number;
  quantity: number;
  note?: string | null;
  line_total_cents?: number;
};
type RawOrder = {
  id: string;
  cycle_id?: string;
  cycle_status?: string;
  display_name?: string;
  note?: string | null;
  created_at?: string;
  updated_at?: string;
  total_cents?: number;
  restaurant?: RawRestaurant | null;
  items?: RawOrderItem[];
};
type RawActiveMenu = {
  cycle: { id: string; status: string; opened_at?: string };
  restaurant: RawRestaurant | null;
  menu_items?: RawMenuItem[];
};
type RawAdminItem = {
  id: string;
  menu_item_id: string;
  item_name: string;
  unit_price_cents: number;
  currency?: string | null;
  quantity: number;
  note?: string | null;
};
type RawAdminOrder = {
  id: string;
  display_name?: string;
  note?: string | null;
  created_at?: string;
  updated_at?: string;
  total_cents?: number;
  items?: RawAdminItem[];
};
type RawCycle = {
  id?: string;
  status?: string;
  opened_at?: string;
  closed_at?: string | null;
  service_fee_cents?: number;
};
type RawAdminCycle = RawCycle & {
  cycle?: RawCycle;
  restaurant: RawRestaurant | null;
  subtotal_cents?: number;
  total_cents?: number;
  orders?: RawAdminOrder[];
};
type RawSubmitResult = { order_id: string; edit_token: string };

function errorCode(error: unknown) {
  const value = error as { message?: string; details?: string };
  const text = `${value?.message ?? ''} ${value?.details ?? ''}`;
  return Object.keys(ERROR_MESSAGES).find((code) => text.includes(code)) ?? 'FOOD_UNKNOWN';
}

function asFoodError(error: unknown) {
  if (error instanceof FoodApiError) return error;
  const code = errorCode(error);
  return new FoodApiError(
    code,
    ERROR_MESSAGES[code] ??
      'No hemos podido conectar con el servicio de pedidos. Inténtalo de nuevo.',
    error,
  );
}

async function rpc<T>(name: string, params: Record<string, unknown> = {}): Promise<T> {
  if (!foodClient)
    throw new FoodApiError(
      'FOOD_NOT_CONFIGURED',
      'El servicio de pedidos aún no está configurado.',
    );
  const { data, error } = await foodClient.rpc(name, params);
  if (error) throw asFoodError(error);
  return data as T;
}

function normalizeItem(item: RawMenuItem) {
  return {
    id: String(item.id),
    restaurantId: String(item.restaurant_id),
    category: item.category || 'Otros',
    name: String(item.name),
    description: item.description ?? '',
    priceCents: Number(item.price_cents),
    currency: item.currency ?? 'EUR',
    imageUrl: item.image_url ?? null,
    available: item.available ?? true,
  };
}

function normalizeRestaurant(restaurant: RawRestaurant | null): Restaurant | null {
  if (!restaurant) return null;
  return {
    id: String(restaurant.id),
    name: String(restaurant.name),
    description: restaurant.description ?? '',
    imageUrl: restaurant.image_url ?? null,
    sourceUrl: restaurant.source_url ?? null,
    availableItems: Number(restaurant.available_items ?? 0),
    openingHours: (restaurant.opening_hours ?? []) as OpeningDay[],
  };
}

function normalizeOrder(order: RawOrder | null): FoodOrder | null {
  if (!order) return null;
  return {
    id: String(order.id),
    cycleId: String(order.cycle_id),
    cycleStatus: String(order.cycle_status),
    displayName: String(order.display_name),
    note: order.note ?? '',
    createdAt: String(order.created_at),
    updatedAt: String(order.updated_at),
    totalCents: Number(order.total_cents ?? 0),
    restaurant: normalizeRestaurant(order.restaurant ?? null),
    items: (order.items ?? []).map((item) => ({
      id: String(item.id),
      menuItemId: String(item.menu_item_id),
      name: String(item.item_name),
      unitPriceCents: Number(item.unit_price_cents),
      quantity: Number(item.quantity),
      note: item.note ?? '',
      lineTotalCents: Number(item.line_total_cents),
    })),
  };
}

function requireOrder(order: RawOrder | null): FoodOrder {
  const normalized = normalizeOrder(order);
  if (!normalized)
    throw new FoodApiError('FOOD_ORDER_NOT_FOUND', ERROR_MESSAGES.FOOD_ORDER_NOT_FOUND!);
  return normalized;
}

export async function getActiveMenu(): Promise<ActiveMenu | null> {
  if (!foodConfigured) return null;
  const data = await rpc<RawActiveMenu | null>('food_active_menu');
  if (!data) return null;
  const restaurant = normalizeRestaurant(data.restaurant);
  if (!restaurant)
    throw new FoodApiError('FOOD_INVALID_RESPONSE', 'El restaurante activo no es válido.');
  return {
    cycle: {
      id: String(data.cycle.id),
      status: String(data.cycle.status),
      openedAt: String(data.cycle.opened_at),
    },
    restaurant,
    menuItems: (data.menu_items ?? []).map(normalizeItem),
  };
}

export async function getRestaurantOptions(): Promise<Restaurant[]> {
  if (!foodConfigured) return [];
  return ((await rpc<RawRestaurant[]>('food_restaurant_options')) ?? [])
    .map(normalizeRestaurant)
    .filter((item): item is Restaurant => item !== null);
}

export async function submitOrder(input: {
  cycleId: string;
  displayName: string;
  note: string;
  items: OrderItemPayload[];
}) {
  const data = await rpc<RawSubmitResult>('food_submit_order', {
    p_cycle_id: input.cycleId,
    p_display_name: input.displayName,
    p_note: input.note || null,
    p_items: input.items,
  });
  return { orderId: String(data.order_id), token: String(data.edit_token) };
}

export async function getOrder(orderId: string, token: string) {
  return requireOrder(
    await rpc<RawOrder | null>('food_get_order', { p_order_id: orderId, p_token: token }),
  );
}

export async function updateOrder(input: {
  orderId: string;
  token: string;
  displayName: string;
  note: string;
  items: OrderItemPayload[];
}) {
  return requireOrder(
    await rpc<RawOrder | null>('food_update_order', {
      p_order_id: input.orderId,
      p_token: input.token,
      p_display_name: input.displayName,
      p_note: input.note || null,
      p_items: input.items,
    }),
  );
}

function normalizeAdminCycle(cycle: RawAdminCycle | null): AdminCycle | null {
  if (!cycle) return null;
  const restaurant = normalizeRestaurant(cycle.restaurant);
  if (!restaurant)
    throw new FoodApiError('FOOD_INVALID_RESPONSE', 'El ciclo no contiene un restaurante válido.');
  const orders = (cycle.orders ?? []).map((order) => ({
    id: String(order.id),
    displayName: String(order.display_name ?? ''),
    note: order.note ?? '',
    createdAt: order.created_at ?? '',
    updatedAt: order.updated_at ?? '',
    totalCents: Number(order.total_cents ?? 0),
    items: (order.items ?? []).map((item) => ({
      id: String(item.id),
      menuItemId: String(item.menu_item_id),
      name: String(item.item_name),
      unitPriceCents: Number(item.unit_price_cents),
      currency: item.currency ?? 'EUR',
      quantity: Number(item.quantity),
      note: item.note ?? '',
    })),
  }));
  const subtotalCents = Number(
    cycle.subtotal_cents ??
      orders.reduce((total: number, order: { totalCents: number }) => total + order.totalCents, 0),
  );
  const serviceFeeCents = Number(cycle.service_fee_cents ?? cycle.cycle?.service_fee_cents ?? 0);
  return {
    id: String(cycle.id ?? cycle.cycle?.id),
    status: String(cycle.status ?? cycle.cycle?.status),
    openedAt: cycle.opened_at ?? cycle.cycle?.opened_at ?? '',
    closedAt: cycle.closed_at ?? cycle.cycle?.closed_at ?? null,
    restaurant,
    subtotalCents,
    serviceFeeCents,
    totalCents: Number(cycle.total_cents ?? subtotalCents + serviceFeeCents),
    orders,
  };
}

export const foodAuth = {
  async session(): Promise<Session | null> {
    if (!foodClient) return null;
    const { data, error } = await foodClient.auth.getSession();
    if (error) throw asFoodError(error);
    return data.session;
  },
  onChange(callback: (session: Session | null) => void) {
    if (!foodClient) return () => {};
    const { data } = foodClient.auth.onAuthStateChange((_event, session) => callback(session));
    return () => data.subscription.unsubscribe();
  },
  async signIn(email: string, password: string) {
    if (!foodClient)
      throw new FoodApiError(
        'FOOD_NOT_CONFIGURED',
        'El servicio de pedidos aún no está configurado.',
      );
    const { data, error } = await foodClient.auth.signInWithPassword({ email, password });
    if (error)
      throw new FoodApiError(
        'FOOD_AUTH_FAILED',
        'El correo o la contraseña no son correctos.',
        error,
      );
    return data.session;
  },
  async signOut() {
    if (!foodClient) return;
    const { error } = await foodClient.auth.signOut();
    if (error) throw asFoodError(error);
  },
};

export const foodAdminApi = {
  access: () => rpc<boolean>('food_admin_access'),
  catalog: async () =>
    ((await rpc<RawRestaurant[]>('food_admin_catalog')) ?? [])
      .map(normalizeRestaurant)
      .filter((item): item is Restaurant => item !== null),
  current: async () => normalizeAdminCycle(await rpc<RawAdminCycle | null>('food_admin_current')),
  history: async () =>
    ((await rpc<RawAdminCycle[]>('food_admin_history')) ?? [])
      .map(normalizeAdminCycle)
      .filter((cycle): cycle is AdminCycle => cycle !== null),
  openCycle: (restaurantId: string) =>
    rpc('food_admin_open_cycle', { p_restaurant_id: restaurantId }),
  async updateRestaurantHours(restaurantId: string, openingHours: OpeningDay[]) {
    const restaurant = normalizeRestaurant(
      await rpc<RawRestaurant>('food_admin_update_restaurant_hours', {
        p_restaurant_id: restaurantId,
        p_opening_hours: openingHours,
      }),
    );
    if (!restaurant)
      throw new FoodApiError('FOOD_INVALID_RESPONSE', 'El restaurante actualizado no es válido.');
    return restaurant;
  },
  closeCycle: (cycleId: string, serviceFeeCents: number) =>
    rpc('food_admin_close_cycle', { p_cycle_id: cycleId, p_service_fee_cents: serviceFeeCents }),
};
