import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryRouter, RouterProvider } from 'react-router';

const mocks = vi.hoisted(() => ({
  sessionValue: null as unknown,
  session: vi.fn(),
  onChange: vi.fn(() => () => {}),
  signIn: vi.fn(),
  signOut: vi.fn(),
  access: vi.fn(),
  catalog: vi.fn(),
  current: vi.fn(),
  history: vi.fn(),
  openCycle: vi.fn(),
  updateRestaurantHours: vi.fn(),
  closeCycle: vi.fn(),
}));

vi.mock('../api/foodApi', () => ({
  foodConfigured: true,
  FoodApiError: class FoodApiError extends Error {
    constructor(
      public code: string,
      message: string,
    ) {
      super(message);
    }
  },
  foodAuth: {
    session: mocks.session,
    onChange: mocks.onChange,
    signIn: mocks.signIn,
    signOut: mocks.signOut,
  },
  foodAdminApi: {
    access: mocks.access,
    catalog: mocks.catalog,
    current: mocks.current,
    history: mocks.history,
    openCycle: mocks.openCycle,
    updateRestaurantHours: mocks.updateRestaurantHours,
    closeCycle: mocks.closeCycle,
  },
}));

import { Component, loader } from './AdminRoute';

const session = { user: { email: 'admin@example.com' } };
const restaurant = {
  id: 'restaurant-1',
  name: 'La Cocina',
  description: '',
  imageUrl: null,
  sourceUrl: null,
  availableItems: 12,
  openingHours: [{ day: 1, periods: [{ open: '12:00', close: '23:00' }] }],
};

function renderAdmin() {
  const router = createMemoryRouter([{ path: '/admin', Component, loader }], {
    initialEntries: ['/admin'],
  });
  render(<RouterProvider router={router} />);
}

describe('authenticated food administration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.sessionValue = null;
    mocks.session.mockImplementation(() => Promise.resolve(mocks.sessionValue));
    mocks.signIn.mockImplementation(() => {
      mocks.sessionValue = session;
      return Promise.resolve(session);
    });
    mocks.access.mockResolvedValue(true);
    mocks.catalog.mockResolvedValue([restaurant]);
    mocks.current.mockResolvedValue(null);
    mocks.history.mockResolvedValue([]);
    mocks.updateRestaurantHours.mockImplementation((_id, openingHours) =>
      Promise.resolve({ ...restaurant, openingHours }),
    );
  });

  afterEach(cleanup);

  it('revalidates protected loader data after sign-in', async () => {
    renderAdmin();
    const user = userEvent.setup();

    await user.type(await screen.findByLabelText(/Correo/), 'admin@example.com');
    await user.type(screen.getByLabelText(/Contrase/), 'secret');
    await user.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(await screen.findByRole('heading', { name: 'Pedido semanal' })).toBeVisible();
    expect(mocks.access).toHaveBeenCalledOnce();
    expect(mocks.catalog).toHaveBeenCalledOnce();
  });

  it('revalidates the catalog after an opening-hours update', async () => {
    mocks.sessionValue = session;
    renderAdmin();
    const user = userEvent.setup();

    await user.click(await screen.findByRole('tab', { name: /Restaurantes/ }));
    await user.click(screen.getByText('La Cocina'));
    await user.click(screen.getByRole('checkbox', { name: 'Lunes' }));
    await user.click(screen.getByRole('button', { name: 'Guardar horario' }));

    expect(await screen.findByRole('status')).toHaveTextContent('Horario de La Cocina guardado.');
    await waitFor(() => expect(mocks.catalog).toHaveBeenCalledTimes(2));
    expect(mocks.updateRestaurantHours).toHaveBeenCalledWith('restaurant-1', []);
  });
});
