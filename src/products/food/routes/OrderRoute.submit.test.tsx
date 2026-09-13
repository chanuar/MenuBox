import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryRouter, Link, RouterProvider } from 'react-router';

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
  const router = createMemoryRouter(
    [
      { path: '/', Component, loader },
      { path: '/options', element: <Link to="/">Volver al pedido</Link> },
    ],
    {
      initialEntries: ['/'],
    },
  );
  render(<RouterProvider router={router} />);
  return router;
}

describe('successful order recovery', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  beforeEach(async () => {
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
    apiMocks.getActiveMenu.mockResolvedValue({
      ...menu,
      cycle: { ...menu.cycle, id: 'reset-cycle' },
    });
    await loader();
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
      expect(
        within(card).getByRole('button', { name: 'Quitar una unidad de Tortilla' }),
      ).toBeEnabled();
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
    const details = screen.getByRole('button', { name: 'Ver detalles de Tortilla' });
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
    expect(await screen.findByRole('heading', { name: 'Apuntado, Ana.' })).toBeVisible();
    await waitFor(() => expect(screen.getByRole('main')).toHaveFocus());
    expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'instant' });
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

    await screen.findByRole('heading', { name: 'Apuntado, Ana.' });
    await user.click(screen.getByRole('button', { name: 'Editar pedido' }));
    expect(screen.getByText(/Croquetas ya no está disponible y se quitará/)).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    await waitFor(() => expect(apiMocks.updateOrder).toHaveBeenCalledTimes(1));
    expect(apiMocks.updateOrder.mock.calls[0]![0].items).toEqual([
      { menu_item_id: 'dish-1', quantity: 1, note: null },
    ]);
  });

  it('resumes the committed credential over an older storage pointer, even after the cycle closes', async () => {
    const user = userEvent.setup();
    saveCredential({ cycleId: 'old-cycle', orderId: 'old-order', token: 'old-token' });
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
    expect(localStorage.getItem('food:last-order')).toContain('old-order');
    await user.click(screen.getByRole('link', { name: 'Restaurantes' }));
    await user.click(screen.getByRole('link', { name: 'Volver al pedido' }));
    expect(await screen.findByRole('heading', { name: 'Apuntado, Ana.' })).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Editar pedido' }));
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    await screen.findByRole('heading', { name: 'Apuntado, Ana.' });
    expect(apiMocks.submitOrder).toHaveBeenCalledOnce();
    expect(apiMocks.updateOrder).toHaveBeenCalledOnce();
    await user.click(screen.getByRole('link', { name: 'Restaurantes' }));
    apiMocks.getActiveMenu.mockResolvedValue(null);
    apiMocks.getOrder.mockResolvedValue({ ...confirmedOrder, cycleStatus: 'closed' });
    await user.click(screen.getByRole('link', { name: 'Volver al pedido' }));
    expect(await screen.findByRole('heading', { name: 'Apuntado, Ana.' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Editar pedido' })).not.toBeInTheDocument();
    expect(apiMocks.getOrder).toHaveBeenLastCalledWith('order-1', 'token-1');
    storageFailure.mockRestore();
  });

  it('restores an unsent draft after exploring, including notes and quantities', async () => {
    const user = userEvent.setup();
    renderOrder();
    const card = await screen.findByRole('article', { name: 'Tortilla' });
    const menuJump = new MouseEvent('click', { bubbles: true, cancelable: true });
    fireEvent(screen.getByRole('link', { name: /Elegir platos/ }), menuJump);
    expect(menuJump.defaultPrevented).toBe(true);
    await waitFor(() => expect(document.getElementById('menu-title')).toHaveFocus());
    const untouched = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(untouched);
    expect(untouched.defaultPrevented).toBe(false);
    await user.click(within(card).getByRole('button', { name: 'Añadir una unidad de Tortilla' }));
    await user.type(screen.getByPlaceholderText(/Cómo te reconocerá/), 'Ana');
    await user.click(within(card).getByText(/Nota para el plato/));
    await user.type(screen.getByLabelText(/Nota para Tortilla/), 'Sin cebolla');
    await user.click(screen.getByText(/Añadir una nota general/));
    await user.type(screen.getByLabelText(/Nota general/), 'Recojo a las dos');
    await user.click(screen.getByRole('link', { name: 'Restaurantes' }));
    const leavingTab = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(leavingTab);
    expect(leavingTab.defaultPrevented).toBe(true);
    await user.click(screen.getByRole('link', { name: 'Volver al pedido' }));
    expect(await screen.findByPlaceholderText(/Cómo te reconocerá/)).toHaveValue('Ana');
    expect(screen.getByLabelText(/Nota para Tortilla/)).toHaveValue('Sin cebolla');
    expect(screen.getByLabelText(/Nota general/)).toHaveValue('Recojo a las dos');
    const summaryJump = new MouseEvent('click', { bubbles: true, cancelable: true });
    fireEvent(screen.getByRole('link', { name: /Revisar pedido/ }), summaryJump);
    expect(summaryJump.defaultPrevented).toBe(true);
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Tu pedido' })).toHaveFocus());
    const cart = screen.getByRole('complementary', { name: 'Tu pedido' });
    await user.click(within(cart).getByRole('button', { name: 'Añadir una unidad de Tortilla' }));
    expect(within(cart).getByText('2 unidades')).toBeVisible();
    expect(apiMocks.submitOrder).not.toHaveBeenCalled();
    expect(localStorage.getItem('food:last-order')).toBeNull();
  });

  it('restores unsaved edits without replacing them with the saved order and clears them after saving or forgetting', async () => {
    const user = userEvent.setup();
    saveCredential({ cycleId: 'cycle-1', orderId: 'order-1', token: 'token-1' });
    apiMocks.getOrder.mockResolvedValue(confirmedOrder);
    renderOrder();
    await screen.findByRole('heading', { name: 'Apuntado, Ana.' });
    await user.click(screen.getByRole('button', { name: 'Editar pedido' }));
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Tu pedido' })).toHaveFocus());
    const unchanged = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(unchanged);
    expect(unchanged.defaultPrevented).toBe(false);
    await user.clear(screen.getByPlaceholderText(/Cómo te reconocerá/));
    await user.type(screen.getByPlaceholderText(/Cómo te reconocerá/), 'Ana María');
    await user.click(
      within(screen.getByRole('article', { name: 'Tortilla' })).getByRole('button', {
        name: 'Añadir una unidad de Tortilla',
      }),
    );
    await user.click(screen.getByRole('link', { name: 'Restaurantes' }));
    await user.click(screen.getByRole('link', { name: 'Volver al pedido' }));
    expect(await screen.findByPlaceholderText(/Cómo te reconocerá/)).toHaveValue('Ana María');
    expect(screen.getByText('2 unidades')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    await screen.findByRole('heading', { name: 'Apuntado, Ana.' });
    expect(apiMocks.updateOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        displayName: 'Ana María',
        items: [{ menu_item_id: 'dish-1', quantity: 2, note: null }],
      }),
    );
    const saved = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(saved);
    expect(saved.defaultPrevented).toBe(false);
    await user.click(screen.getByRole('button', { name: 'Editar pedido' }));
    expect(screen.getByPlaceholderText(/Cómo te reconocerá/)).toHaveValue('Ana');
    const serverValues = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(serverValues);
    expect(serverValues.defaultPrevented).toBe(false);
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    await screen.findByRole('heading', { name: 'Apuntado, Ana.' });
    await user.click(screen.getByRole('link', { name: 'Restaurantes' }));
    await user.click(screen.getByRole('link', { name: 'Volver al pedido' }));
    await screen.findByRole('heading', { name: 'Apuntado, Ana.' });
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    await user.click(screen.getByRole('button', { name: 'Olvidar en este dispositivo' }));
    await waitFor(() => expect(screen.getByRole('main')).toHaveFocus());
    expect(screen.getByPlaceholderText(/Cómo te reconocerá/)).toHaveValue('');
    expect(screen.queryByRole('link', { name: /Revisar pedido/ })).not.toBeInTheDocument();
    const forgotten = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(forgotten);
    expect(forgotten.defaultPrevented).toBe(false);
  });

  it('drops the previous draft when the active cycle changes, including revalidation', async () => {
    const user = userEvent.setup();
    const router = renderOrder();
    await screen.findByRole('heading', { name: 'La Cocina' });
    await user.click(screen.getByRole('button', { name: 'Añadir una unidad de Tortilla' }));
    await user.type(screen.getByPlaceholderText(/Cómo te reconocerá/), 'Ana');
    apiMocks.getActiveMenu.mockResolvedValue({ ...menu, cycle: { ...menu.cycle, id: 'cycle-2' } });
    await act(async () => {
      await router.revalidate();
    });
    expect(screen.getByPlaceholderText(/Cómo te reconocerá/)).toHaveValue('');
    expect(screen.queryByRole('link', { name: /Revisar pedido/ })).not.toBeInTheDocument();
    const reset = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(reset);
    expect(reset.defaultPrevented).toBe(false);
  });

  it('restores focus after the photo opener succeeds or fails and clears a search without losing the cart', async () => {
    const user = userEvent.setup();
    renderOrder();
    const photo = await screen.findByRole('button', { name: 'Ver foto y detalles de Tortilla' });
    await user.click(photo);
    await user.click(screen.getByRole('button', { name: 'Cerrar detalles' }));
    await waitFor(() => expect(photo).toHaveFocus());
    await user.click(photo);
    fireEvent.error(screen.getByRole('article', { name: 'Tortilla' }).querySelector('img')!);
    expect(photo).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Cerrar detalles' }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Ver detalles de Tortilla' })).toHaveFocus(),
    );
    await user.click(screen.getByRole('button', { name: 'Añadir una unidad de Tortilla' }));
    await user.type(screen.getByRole('searchbox'), 'inexistente');
    await user.click(screen.getByRole('button', { name: 'Limpiar filtros' }));
    expect(screen.getByRole('searchbox')).toHaveFocus();
    expect(screen.getByRole('article', { name: 'Tortilla' })).toBeVisible();
    expect(screen.getByRole('link', { name: /Revisar pedido/ })).toHaveTextContent('1 unidad');
  });

  it('does not carry a draft into a different saved order in the same cycle', async () => {
    const user = userEvent.setup();
    const router = renderOrder();
    await screen.findByRole('heading', { name: 'La Cocina' });
    await user.type(screen.getByPlaceholderText(/Cómo te reconocerá/), 'Mi borrador');
    saveCredential({ cycleId: 'cycle-1', orderId: 'order-2', token: 'token-2' });
    apiMocks.getOrder.mockResolvedValue({ ...confirmedOrder, id: 'order-2', displayName: 'Bea' });
    await act(async () => {
      await router.revalidate();
    });
    expect(screen.getByRole('heading', { name: 'Apuntado, Bea.' })).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Editar pedido' }));
    expect(screen.getByPlaceholderText(/Cómo te reconocerá/)).toHaveValue('Bea');
    const unchanged = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(unchanged);
    expect(unchanged.defaultPrevented).toBe(false);
  });

  it('warns when a draft item disappears from the menu while exploring', async () => {
    const user = userEvent.setup();
    renderOrder();
    await screen.findByRole('heading', { name: 'La Cocina' });
    await user.click(screen.getByRole('button', { name: 'Añadir una unidad de Tortilla' }));
    await user.click(screen.getByRole('link', { name: 'Restaurantes' }));
    apiMocks.getActiveMenu.mockResolvedValue({
      ...menu,
      menuItems: [{ ...menu.menuItems[0], id: 'dish-2', name: 'Croquetas' }],
    });
    await user.click(screen.getByRole('link', { name: 'Volver al pedido' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Algunos platos de tu selección ya no están disponibles',
    );
    expect(screen.getByRole('button', { name: 'Enviar pedido' })).toBeDisabled();
    expect(screen.queryByRole('link', { name: /Revisar pedido/ })).not.toBeInTheDocument();
  });

  it('keeps a closed receipt visible when the active menu has ended', async () => {
    saveCredential({ cycleId: 'cycle-1', orderId: 'order-1', token: 'token-1' });
    apiMocks.getActiveMenu.mockResolvedValue(null);
    apiMocks.getOrder.mockResolvedValue({ ...confirmedOrder, cycleStatus: 'closed' });
    renderOrder();
    expect(await screen.findByRole('heading', { name: 'Apuntado, Ana.' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Editar pedido' })).not.toBeInTheDocument();
  });

  it.each(['missing', 'failed'])('keeps the detail useful with a %s image', async (imageState) => {
    const user = userEvent.setup();
    if (imageState === 'missing')
      apiMocks.getActiveMenu.mockResolvedValue({
        ...menu,
        menuItems: [{ ...menu.menuItems[0], imageUrl: null }],
      });
    renderOrder();
    await user.click(await screen.findByRole('button', { name: 'Ver detalles de Tortilla' }));
    const dialog = screen.getByRole('dialog', { name: 'Tortilla' });
    if (imageState === 'failed') fireEvent.error(dialog.querySelector('img')!);
    expect(dialog.querySelector('.food-item-modal__media')).toBeNull();
    expect(dialog.querySelector('.food-item-image--placeholder')).toBeNull();
    expect(dialog).toHaveTextContent('Una tortilla recién hecha');
    expect(dialog.querySelector('.food-item-modal__price')).toHaveTextContent('7,00');
    await user.click(within(dialog).getByRole('button', { name: 'Añadir una unidad de Tortilla' }));
    expect(dialog).toHaveTextContent('1 en tu pedido');
    expect(within(dialog).getByRole('button', { name: 'Cerrar detalles' })).toBeEnabled();
  });

  it('keeps both note disclosures open while clearing their last character', async () => {
    const user = userEvent.setup();
    saveCredential({ cycleId: 'cycle-1', orderId: 'order-1', token: 'token-1' });
    apiMocks.getOrder.mockResolvedValue({
      ...confirmedOrder,
      note: 'A',
      items: [{ ...confirmedOrder.items[0], note: 'B' }],
    });
    renderOrder();
    await user.click(await screen.findByRole('button', { name: 'Editar pedido' }));
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Tu pedido' })).toHaveFocus());
    const itemNote = screen.getByLabelText(/Nota para Tortilla/);
    const generalNote = screen.getByLabelText(/Nota general/);
    for (const field of [itemNote, generalNote]) {
      await user.clear(field);
      expect(field).toHaveValue('');
      expect(field).toHaveFocus();
      expect(field.closest('details')).toHaveAttribute('open');
      await user.type(field, 'Sigo escribiendo');
      expect(field).toHaveValue('Sigo escribiendo');
    }
  });

  it('blocks navigation and edits while a submission is pending, then resumes the saved order', async () => {
    const user = userEvent.setup();
    let finishSubmit = () => {};
    apiMocks.submitOrder.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishSubmit = () => resolve({ orderId: 'order-1', token: 'token-1' });
        }),
    );
    apiMocks.getOrder.mockResolvedValue(confirmedOrder);
    renderOrder();
    await user.click(await screen.findByRole('button', { name: 'Añadir una unidad de Tortilla' }));
    await user.type(screen.getByPlaceholderText(/Cómo te reconocerá/), 'Ana');
    await user.click(screen.getByRole('button', { name: 'Enviar pedido' }));
    expect(screen.getByText('Guardando tu pedido, un momento…')).toBeVisible();
    expect(screen.getByPlaceholderText(/Cómo te reconocerá/)).toBeDisabled();
    expect(screen.getByLabelText(/Nota general/)).toBeDisabled();
    expect(screen.getByLabelText(/Nota para Tortilla/)).toBeDisabled();
    expect(
      within(screen.getByRole('article', { name: 'Tortilla' })).getByRole('button', {
        name: 'Añadir una unidad de Tortilla',
      }),
    ).toBeDisabled();
    await user.click(screen.getByRole('link', { name: 'Restaurantes' }));
    expect(screen.queryByRole('link', { name: 'Volver al pedido' })).not.toBeInTheDocument();
    const submitting = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(submitting);
    expect(submitting.defaultPrevented).toBe(true);
    await act(async () => finishSubmit());
    await screen.findByRole('heading', { name: 'Apuntado, Ana.' });
    await user.click(screen.getByRole('link', { name: 'Restaurantes' }));
    await user.click(screen.getByRole('link', { name: 'Volver al pedido' }));
    await screen.findByRole('heading', { name: 'Apuntado, Ana.' });
    expect(apiMocks.submitOrder).toHaveBeenCalledOnce();
    await user.click(screen.getByRole('button', { name: 'Editar pedido' }));
    let finishUpdate = () => {};
    apiMocks.updateOrder.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishUpdate = () => resolve(confirmedOrder);
        }),
    );
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    const unchangedButSaving = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(unchangedButSaving);
    expect(unchangedButSaving.defaultPrevented).toBe(true);
    await act(async () => finishUpdate());
    await screen.findByRole('heading', { name: 'Apuntado, Ana.' });
    const finished = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(finished);
    expect(finished.defaultPrevented).toBe(false);
  });
});

describe('order route loader', () => {
  beforeEach(async () => {
    localStorage.clear();
    vi.clearAllMocks();
    apiMocks.getActiveMenu.mockResolvedValue({
      ...menu,
      cycle: { ...menu.cycle, id: 'reset-cycle' },
    });
    await loader();
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
