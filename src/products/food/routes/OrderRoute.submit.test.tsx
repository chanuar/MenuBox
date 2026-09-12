import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryRouter, RouterProvider } from 'react-router';

const apiMocks = vi.hoisted(() => ({
  getActiveMenu: vi.fn(),
  getOrder: vi.fn(),
  submitOrder: vi.fn(),
  updateOrder: vi.fn(),
}));

vi.mock('../api/foodApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../api/foodApi')>()),
  foodConfigured: true,
  ...apiMocks,
}));

import { Component, loader } from './OrderRoute';
import { FoodApiError } from '../api/foodApi';
import { saveCredential } from '../model/storage';

const menu = {
  cycle: { id: 'cycle-1', status: 'open', openedAt: '2026-08-09T12:00:00Z' },
  restaurant: {
    id: 'restaurant-1',
    name: 'La Cocina',
    description: '',
    imageUrl: null,
    sourceUrl: 'https://www.ubereats.com/es/store/la-cocina/example',
  },
  menuItems: [
    {
      id: 'dish-1',
      restaurantId: 'restaurant-1',
      category: 'Platos',
      name: 'Tortilla',
      description: 'Una tortilla recién hecha con papas del país.',
      priceCents: 700,
      currency: 'EUR',
      imageUrl: 'https://example.invalid/tortilla.jpg',
      available: true,
    },
  ],
};

const confirmedOrder = {
  id: 'order-1',
  cycleId: 'cycle-1',
  cycleStatus: 'open',
  displayName: 'Ana',
  note: '',
  createdAt: '2026-08-09T12:00:00Z',
  updatedAt: '2026-08-09T12:01:00Z',
  totalCents: 700,
  items: [
    {
      id: 'line-1',
      menuItemId: 'dish-1',
      name: 'Tortilla',
      unitPriceCents: 700,
      quantity: 1,
      note: '',
      lineTotalCents: 700,
    },
  ],
};

function renderOrder() {
  const router = createMemoryRouter([{ path: '/', Component, loader }], {
    initialEntries: ['/'],
  });
  render(<RouterProvider router={router} />);
}

describe('successful order recovery', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    if (typeof HTMLDialogElement.prototype.showModal !== 'function') {
      Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
        configurable: true,
        value(this: HTMLDialogElement) {
          this.setAttribute('open', '');
        },
      });
    }
    if (typeof HTMLDialogElement.prototype.close !== 'function') {
      Object.defineProperty(HTMLDialogElement.prototype, 'close', {
        configurable: true,
        value(this: HTMLDialogElement) {
          this.removeAttribute('open');
        },
      });
    }
    localStorage.clear();
    vi.clearAllMocks();
    window.scrollTo = vi.fn();
    apiMocks.getActiveMenu.mockResolvedValue(menu);
    apiMocks.submitOrder.mockResolvedValue({ orderId: 'order-1', token: 'token-1' });
    apiMocks.updateOrder.mockResolvedValue(confirmedOrder);
  });

  it.each([
    { category: 'BEBIDAS', imageUrl: 'https://example.invalid/drink.jpg' },
    { category: 'SALSAS EXTRAS', imageUrl: null },
  ])(
    'keeps $category compact while retaining quantity controls',
    async ({ category, imageUrl }) => {
      const user = userEvent.setup();
      apiMocks.getActiveMenu.mockResolvedValue({
        ...menu,
        menuItems: menu.menuItems.map((item) => ({ ...item, category, imageUrl })),
      });
      renderOrder();
      const card = await screen.findByRole('article', { name: 'Tortilla' });
      expect(card).toHaveClass('food-menu-card--text');
      expect(card.querySelector('img')).toBeNull();
      expect(card.querySelector('.food-item-image--placeholder')).toBeNull();
      await user.click(screen.getByRole('button', { name: 'Añadir una unidad de Tortilla' }));
      expect(screen.getByRole('button', { name: 'Quitar una unidad de Tortilla' })).toBeEnabled();
    },
  );

  it('updates the committed order instead of creating a duplicate when confirmation fails', async () => {
    const user = userEvent.setup();
    apiMocks.getOrder.mockRejectedValueOnce(new Error('confirmation unavailable'));
    renderOrder();

    await screen.findByRole('heading', { name: 'La Cocina' });
    expect(screen.getByRole('link', { name: /Ver en Uber Eats/ })).toHaveAttribute(
      'href',
      menu.restaurant.sourceUrl,
    );
    expect(screen.getByRole('link', { name: 'Restaurantes' })).toHaveAttribute('href', '/options');
    fireEvent.error(document.querySelector('.food-menu-card__image')!);
    expect(screen.getByRole('article', { name: 'Tortilla' }).querySelector('img')).toBeNull();
    expect(document.querySelector('.food-item-image--placeholder')).toBeNull();
    const details = screen.getByRole('button', { name: 'Ver detalles' });
    await user.click(details);
    expect(screen.getByRole('dialog', { name: 'Tortilla' })).toHaveTextContent(
      'Una tortilla recién hecha',
    );
    expect(screen.getByRole('button', { name: 'Cerrar detalles' })).toHaveFocus();
    fireEvent(
      screen.getByRole('dialog', { name: 'Tortilla' }),
      new Event('cancel', { bubbles: true, cancelable: true }),
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await waitFor(() => expect(details).toHaveFocus());
    await user.click(screen.getByRole('button', { name: /Añadir una unidad de Tortilla/ }));
    expect(screen.getByPlaceholderText(/Sin cebolla/)).toHaveAttribute('maxlength', '240');
    await user.type(screen.getByPlaceholderText(/Cómo te reconocerá/), 'Ana');
    await user.click(screen.getByRole('button', { name: 'Enviar pedido' }));

    expect(
      await screen.findByText(/El pedido se ha guardado, pero no pudimos cargar la confirmación/),
    ).toBeVisible();
    expect(apiMocks.submitOrder).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem('food:last-order')).toContain('order-1');

    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    expect(await screen.findByRole('heading', { name: 'Todo listo, Ana' })).toBeVisible();
    expect(apiMocks.submitOrder).toHaveBeenCalledTimes(1);
    expect(apiMocks.updateOrder).toHaveBeenCalledTimes(1);
  });

  it('removes unavailable resumed items before sending an edit', async () => {
    const user = userEvent.setup();
    saveCredential({ cycleId: 'cycle-1', orderId: 'order-1', token: 'token-1' });
    apiMocks.getOrder.mockResolvedValueOnce({
      ...confirmedOrder,
      totalCents: 1500,
      items: [
        confirmedOrder.items[0],
        {
          id: 'line-2',
          menuItemId: 'dish-gone',
          name: 'Croquetas',
          unitPriceCents: 400,
          quantity: 2,
          note: '',
          lineTotalCents: 800,
        },
      ],
    });
    renderOrder();

    await screen.findByRole('heading', { name: 'Todo listo, Ana' });
    await user.click(screen.getByRole('button', { name: 'Editar pedido' }));
    expect(screen.getByText(/Croquetas ya no está disponible y se quitará/)).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    await waitFor(() => expect(apiMocks.updateOrder).toHaveBeenCalledTimes(1));
    expect(apiMocks.updateOrder.mock.calls[0]![0].items).toEqual([
      { menu_item_id: 'dish-1', quantity: 1, note: null },
    ]);
  });

  it('keeps the committed credential in memory when local storage fails', async () => {
    const user = userEvent.setup();
    apiMocks.getOrder.mockResolvedValue(confirmedOrder);
    const storageFailure = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    renderOrder();
    await screen.findByRole('heading', { name: 'La Cocina' });
    await user.click(screen.getByRole('button', { name: /Añadir una unidad de Tortilla/ }));
    await user.type(screen.getByPlaceholderText(/Cómo te reconocerá/), 'Ana');
    await user.click(screen.getByRole('button', { name: 'Enviar pedido' }));
    expect(await screen.findByText(/este navegador no permite conservar el acceso/)).toBeVisible();
    expect(apiMocks.submitOrder).toHaveBeenCalledOnce();
    storageFailure.mockRestore();
  });
});

describe('order route loader', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('treats no active menu as valid loader data', async () => {
    apiMocks.getActiveMenu.mockResolvedValue(null);
    await expect(loader()).resolves.toEqual({ menu: null, credential: null, order: null });
  });

  it('resumes the matching local credential', async () => {
    saveCredential({ cycleId: 'cycle-1', orderId: 'order-1', token: 'token-1' });
    apiMocks.getActiveMenu.mockResolvedValue(menu);
    apiMocks.getOrder.mockResolvedValue(confirmedOrder);
    await expect(loader()).resolves.toEqual({
      menu,
      credential: { cycleId: 'cycle-1', orderId: 'order-1', token: 'token-1' },
      order: confirmedOrder,
    });
  });

  it('forgets a missing order without failing the menu route', async () => {
    saveCredential({ cycleId: 'cycle-1', orderId: 'order-1', token: 'token-1' });
    apiMocks.getActiveMenu.mockResolvedValue(menu);
    apiMocks.getOrder.mockRejectedValue(new FoodApiError('FOOD_ORDER_NOT_FOUND', 'missing'));
    await expect(loader()).resolves.toEqual({ menu, credential: null, order: null });
    expect(localStorage.getItem('food:last-order')).toBeNull();
  });
});
