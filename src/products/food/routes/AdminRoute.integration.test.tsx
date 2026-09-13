import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
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
import { FoodApiError } from '../api/foodApi';

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
const cycle = {
  id: 'cycle-1',
  status: 'open',
  openedAt: '2026-09-13T12:00:00Z',
  closedAt: null,
  restaurant,
  subtotalCents: 0,
  serviceFeeCents: 0,
  totalCents: 0,
  orders: [],
};

function renderAdmin() {
  const router = createMemoryRouter([{ path: '/admin', Component, loader }], {
    initialEntries: ['/admin'],
  });
  render(<RouterProvider router={router} />);
  return router;
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
    mocks.signOut.mockImplementation(() => {
      mocks.sessionValue = null;
      return Promise.resolve();
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
    expect(screen.getByRole('main')).toHaveFocus();
    expect(mocks.access).toHaveBeenCalledOnce();
    expect(mocks.catalog).toHaveBeenCalledOnce();

    await user.click(screen.getByRole('button', { name: 'Cerrar sesión' }));
    expect(await screen.findByRole('heading', { name: 'Administración' })).toBeVisible();
    expect(screen.getByRole('main')).toHaveFocus();
  });

  it('keeps valid fields out of the invalid state when sign-in cannot reach the service', async () => {
    mocks.signIn.mockRejectedValueOnce(new Error('No se ha podido conectar.'));
    renderAdmin();
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText(/Correo/), 'admin@example.com');
    await user.type(screen.getByLabelText(/Contrase/), 'secret');
    await user.click(screen.getByRole('button', { name: 'Entrar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('No se ha podido conectar.');
    expect(screen.getByLabelText(/Correo/)).toHaveAttribute('aria-invalid', 'false');
    expect(screen.getByLabelText(/Contrase/)).toHaveAttribute('aria-invalid', 'false');

    mocks.signIn.mockRejectedValueOnce(
      new FoodApiError('FOOD_AUTH_FAILED', 'Revisa tus credenciales.'),
    );
    await user.click(screen.getByRole('button', { name: 'Entrar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Revisa tus credenciales.');
    expect(screen.getByLabelText(/Correo/)).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText(/Contrase/)).toHaveAttribute('aria-invalid', 'true');
  });

  it('focuses the history tab after closing a cycle and keeps a reload separate from a failed mutation', async () => {
    mocks.sessionValue = session;
    mocks.current.mockResolvedValue(cycle);
    mocks.closeCycle.mockRejectedValueOnce(new Error('No se ha podido cerrar el pedido.'));
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderAdmin();
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Cerrar pedido' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('No se ha podido cerrar el pedido.');
    await user.click(screen.getByRole('button', { name: 'Recargar vista' }));
    expect(mocks.closeCycle).toHaveBeenCalledOnce();

    mocks.closeCycle.mockImplementationOnce(() => {
      mocks.current.mockResolvedValue(null);
      mocks.history.mockResolvedValue([
        { ...cycle, status: 'closed', closedAt: '2026-09-13T13:00:00Z' },
      ]);
      return Promise.resolve();
    });
    await user.click(screen.getByRole('button', { name: 'Cerrar pedido' }));
    expect(await screen.findByRole('heading', { name: 'Semanas anteriores' })).toBeVisible();
    expect(screen.getByRole('tab', { name: /Historial/ })).toHaveFocus();
    expect(screen.getByRole('tab', { name: /Historial/ })).toHaveAttribute('aria-selected', 'true');
    confirm.mockRestore();
  });

  it('focuses the opened cycle and preserves keyboard tab focus during later reloads', async () => {
    mocks.sessionValue = session;
    mocks.openCycle.mockImplementationOnce(() => {
      mocks.current.mockResolvedValue(cycle);
      return Promise.resolve();
    });
    const router = renderAdmin();
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Abrir pedido semanal' }));
    expect(await screen.findByRole('heading', { name: 'La Cocina' })).toBeVisible();
    expect(screen.getByRole('main')).toHaveFocus();

    await user.click(screen.getByRole('tab', { name: 'Semana actual' }));
    await user.keyboard('{ArrowRight}{End}');
    expect(screen.getByRole('tab', { name: /Historial/ })).toHaveFocus();
    expect(screen.getByRole('tabpanel')).toHaveAccessibleName(/Historial/);

    let finishReload!: () => void;
    mocks.current.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishReload = () => resolve(cycle);
        }),
    );
    await act(async () => {
      void router.revalidate();
    });
    expect(screen.getByRole('tab', { name: /Historial/ })).toHaveFocus();
    await user.keyboard('{Home}');
    const currentTab = screen.getByRole('tab', { name: 'Semana actual' });
    expect(currentTab).toHaveFocus();
    expect(currentTab).toHaveAttribute('aria-selected', 'true');
    await act(async () => finishReload());
    expect(currentTab).toHaveFocus();
    expect(screen.getByRole('tabpanel')).toHaveAccessibleName('Semana actual');
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
