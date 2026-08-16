import { describe, expect, it } from 'vitest';
import {
  cartToPayload,
  cartTotal,
  formatEuros,
  normalizeSearch,
  orderToCart,
  unavailableOrderItems,
  validateOrder,
} from './order';

describe('food order utilities', () => {
  it('formats integer cents as Spanish euros', () => {
    expect(formatEuros(1295)).toMatch(/12,95\s?€/);
  });

  it('searches without accents or case', () => {
    expect(normalizeSearch('Tortillá ESPAÑOLA')).toBe('tortilla espanola');
  });

  it('calculates totals only from trusted menu prices', () => {
    const cart = { a: { quantity: 2, note: '' }, missing: { quantity: 9, note: '' } };
    expect(cartTotal(cart, [{ id: 'a', priceCents: 725 }])).toBe(1450);
  });

  it('validates the required name, item, quantities, and bounded notes', () => {
    expect(validateOrder({ displayName: '', orderNote: '', cart: {} })).toMatch(/nombre/);
    expect(validateOrder({ displayName: 'Ana', orderNote: '', cart: {} })).toMatch(/plato/);
    expect(
      validateOrder({ displayName: 'Ana', orderNote: '', cart: { a: { quantity: 21, note: '' } } }),
    ).toMatch(/entre 1 y 20/);
    expect(
      validateOrder({ displayName: 'Ana', orderNote: '', cart: { a: { quantity: 1, note: '' } } }),
    ).toBeNull();
  });

  it('round-trips order items into a replacement payload', () => {
    const cart = orderToCart({ items: [{ menuItemId: 'a', quantity: 2, note: 'Salsa aparte' }] });
    expect(cartToPayload(cart)).toEqual([{ menu_item_id: 'a', quantity: 2, note: 'Salsa aparte' }]);
  });

  it('removes unavailable items from a resumed editable cart', () => {
    const order = {
      items: [
        { menuItemId: 'available', name: 'Tortilla', quantity: 1, note: '' },
        { menuItemId: 'gone', name: 'Croquetas', quantity: 2, note: '' },
      ],
    };
    const menu = [{ id: 'available' }];
    expect(orderToCart(order, menu)).toEqual({ available: { quantity: 1, note: '' } });
    expect(unavailableOrderItems(order, menu).map((item) => item.name)).toEqual(['Croquetas']);
  });
});
