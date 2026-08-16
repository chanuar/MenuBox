import type { Cart, MenuItem, OrderItem, OrderItemPayload } from './types';

export const MAX_QUANTITY = 20;

export function formatEuros(cents: number, currency = 'EUR') {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency }).format(
    (Number(cents) || 0) / 100,
  );
}

export function formatSpanishDate(value: string | null | undefined) {
  if (!value) return '';
  return new Intl.DateTimeFormat('es-ES', { dateStyle: 'long', timeStyle: 'short' }).format(
    new Date(value),
  );
}

export function normalizeSearch(value: unknown) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('es');
}

export function cartTotal(cart: Cart, menuItems: Pick<MenuItem, 'id' | 'priceCents'>[]) {
  const byId = new Map(menuItems.map((item) => [item.id, item]));
  return Object.entries(cart).reduce(
    (total, [id, entry]) => total + (byId.get(id)?.priceCents ?? 0) * entry.quantity,
    0,
  );
}

export function cartCount(cart: Cart) {
  return Object.values(cart).reduce((total, entry) => total + entry.quantity, 0);
}

type OrderLike = {
  items?: Array<Pick<OrderItem, 'menuItemId' | 'quantity' | 'note'> & Partial<OrderItem>>;
};

export function orderToCart(
  order: OrderLike | null,
  menuItems: Pick<MenuItem, 'id'>[] | null = null,
): Cart {
  const availableIds = menuItems ? new Set(menuItems.map((item) => item.id)) : null;
  return Object.fromEntries(
    (order?.items ?? [])
      .filter((item) => !availableIds || availableIds.has(item.menuItemId))
      .map((item) => [item.menuItemId, { quantity: item.quantity, note: item.note ?? '' }]),
  );
}

export function unavailableOrderItems(order: OrderLike | null, menuItems: Pick<MenuItem, 'id'>[]) {
  const availableIds = new Set(menuItems.map((item) => item.id));
  return order?.items?.filter((item) => !availableIds.has(item.menuItemId)) ?? [];
}

export function cartToPayload(cart: Cart): OrderItemPayload[] {
  return Object.entries(cart)
    .filter(([, entry]) => entry.quantity > 0)
    .map(([menuItemId, entry]) => ({
      menu_item_id: menuItemId,
      quantity: entry.quantity,
      note: entry.note.trim() || null,
    }));
}

export function validateOrder({
  displayName,
  orderNote,
  cart,
}: {
  displayName: string;
  orderNote: string;
  cart: Cart;
}) {
  const name = displayName.trim();
  if (!name) return 'Escribe tu nombre para identificar el pedido.';
  if (name.length > 80) return 'El nombre no puede superar 80 caracteres.';
  if (orderNote.length > 500) return 'La nota general no puede superar 500 caracteres.';
  const entries = Object.values(cart);
  if (!entries.length || entries.every((entry) => entry.quantity < 1))
    return 'Añade al menos un plato al pedido.';
  if (entries.some((entry) => entry.quantity < 1 || entry.quantity > MAX_QUANTITY))
    return `Cada plato debe tener entre 1 y ${MAX_QUANTITY} unidades.`;
  if (entries.some((entry) => entry.note.length > 240))
    return 'Las notas de los platos no pueden superar 240 caracteres.';
  return null;
}
