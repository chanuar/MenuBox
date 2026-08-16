import { beforeEach, describe, expect, it, vi } from 'vitest';

const rpc = vi.hoisted(() => vi.fn());

vi.mock('../../../shared/config/supabase', () => ({
  supabaseEnvironment: {
    configured: true,
    url: 'https://example.supabase.co',
    publishableKey: 'publishable',
  },
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    rpc,
    auth: {
      getSession: vi.fn(),
      onAuthStateChange: vi.fn(),
      signInWithPassword: vi.fn(),
      signOut: vi.fn(),
    },
  }),
}));

import { foodAdminApi, getOrder } from './foodApi';

describe('food API normalization', () => {
  beforeEach(() => rpc.mockReset());

  it('keeps snake_case admin payloads out of the UI model', async () => {
    rpc.mockResolvedValue({
      data: {
        cycle: { id: 'cycle-1', status: 'open', opened_at: '2026-08-11T12:00:00Z' },
        restaurant: { id: 'restaurant-1', name: 'La Cocina', image_url: '/restaurant.jpg' },
        total_cents: 700,
        orders: [
          {
            id: 'order-1',
            display_name: 'Ana',
            total_cents: 700,
            updated_at: '2026-08-11T12:01:00Z',
            items: [
              {
                id: 'line-1',
                menu_item_id: 'dish-1',
                item_name: 'Tortilla',
                unit_price_cents: 700,
                quantity: 1,
              },
            ],
          },
        ],
      },
      error: null,
    });

    await expect(foodAdminApi.current()).resolves.toMatchObject({
      id: 'cycle-1',
      openedAt: '2026-08-11T12:00:00Z',
      subtotalCents: 700,
      restaurant: { id: 'restaurant-1', imageUrl: '/restaurant.jpg' },
      orders: [
        {
          displayName: 'Ana',
          items: [{ menuItemId: 'dish-1', name: 'Tortilla', unitPriceCents: 700 }],
        },
      ],
    });
  });

  it('turns an empty order response into the existing not-found contract', async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    await expect(getOrder('missing', 'token')).rejects.toMatchObject({
      code: 'FOOD_ORDER_NOT_FOUND',
    });
  });
});
