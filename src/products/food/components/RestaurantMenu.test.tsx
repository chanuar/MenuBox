import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { useState } from 'react';
const getRestaurantMenu = vi.hoisted(() => vi.fn());
vi.mock('../api/foodApi', () => ({ getRestaurantMenu }));
import { RestaurantMenu } from './RestaurantMenu';
const restaurant = {
  id: 'cafe',
  name: 'Café',
  description: '',
  imageUrl: null,
  sourceUrl: null,
  availableItems: 2,
  openingHours: [],
};
const dish = {
  id: 'dish',
  restaurantId: 'cafe',
  name: 'Tortilla',
  description: 'Con papas',
  category: 'Platos',
  priceCents: 700,
  currency: 'EUR',
  imageUrl: null,
  available: true,
};
beforeEach(() => {
  getRestaurantMenu.mockReset();
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
    configurable: true,
    value() {
      this.open = true;
    },
  });
  Object.defineProperty(HTMLDialogElement.prototype, 'close', {
    configurable: true,
    value() {
      this.open = false;
    },
  });
});
afterEach(() => cleanup());
it('recovers from failure, searches the read-only menu and returns focus after closing', async () => {
  getRestaurantMenu
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValueOnce([dish, { ...dish, id: 'drink', name: 'Agua', category: 'Bebidas' }]);
  function Harness() {
    const [open, setOpen] = useState(false);
    return (
      <>
        <button onClick={() => setOpen(true)}>Explorar carta</button>
        {open && <RestaurantMenu restaurant={restaurant} onClose={() => setOpen(false)} />}
      </>
    );
  }
  const user = userEvent.setup();
  render(<Harness />);
  await user.click(screen.getByRole('button', { name: 'Explorar carta' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('No hemos podido cargar');
  await user.click(screen.getByRole('button', { name: 'Reintentar' }));
  await screen.findByRole('article', { name: 'Tortilla' });
  expect(screen.queryByRole('button', { name: /Añadir una unidad/ })).not.toBeInTheDocument();
  await user.type(screen.getByRole('searchbox'), 'tortílla');
  expect(screen.queryByRole('article', { name: 'Agua' })).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Ver detalles de Tortilla' }));
  expect(screen.getByRole('dialog', { name: 'Tortilla' })).toHaveTextContent('Con papas');
  await user.click(screen.getByRole('button', { name: 'Cerrar detalles' }));
  fireEvent(
    screen.getByRole('dialog', { name: 'Café' }),
    new Event('cancel', { bubbles: true, cancelable: true }),
  );
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Explorar carta' })).toHaveFocus();
  expect(document.body.style.overflow).toBe('');
});
it('explains an empty menu', async () => {
  getRestaurantMenu.mockResolvedValue([]);
  render(<RestaurantMenu restaurant={restaurant} onClose={() => {}} />);
  expect(await screen.findByText(/todavía no tiene platos/)).toBeInTheDocument();
});
