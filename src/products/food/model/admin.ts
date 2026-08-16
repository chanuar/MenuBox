import type { AdminOrder } from './types';

export function parseServiceFee(value: unknown) {
  const normalized = String(value ?? '')
    .trim()
    .replace(/\s/g, '')
    .replace(',', '.');
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) return null;
  const cents = Math.round(Number(normalized) * 100);
  return Number.isSafeInteger(cents) && cents >= 0 && cents <= 1_000_000 ? cents : null;
}

export function aggregateItems(orders: AdminOrder[]) {
  const items = new Map<
    string,
    { name: string; quantity: number; totalCents: number; notes: string[] }
  >();
  for (const order of orders) {
    for (const item of order.items) {
      const current = items.get(item.menuItemId) ?? {
        name: item.name,
        quantity: 0,
        totalCents: 0,
        notes: [],
      };
      current.quantity += item.quantity;
      current.totalCents += item.unitPriceCents * item.quantity;
      if (item.note) current.notes.push(`${order.displayName}: ${item.note}`);
      items.set(item.menuItemId, current);
    }
  }
  return [...items.values()].sort(
    (a, b) => b.quantity - a.quantity || a.name.localeCompare(b.name, 'es'),
  );
}
