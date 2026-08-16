import type { ComponentType } from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMemoryRouter, RouterProvider } from 'react-router';

vi.mock('../api/foodApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/foodApi')>();
  return {
    ...actual,
    foodConfigured: false,
    getActiveMenu: vi.fn().mockResolvedValue(null),
    getRestaurantOptions: vi.fn().mockResolvedValue([
      {
        id: 'restaurant-1',
        name: 'PSM Burger',
        description: 'Hamburguesas artesanas en Telde.',
        imageUrl: 'https://example.com/psm.jpg',
        sourceUrl: 'https://www.ubereats.com/es/store/psm-burger-telde/example',
        availableItems: 45,
        openingHours: [{ day: 1, periods: [{ open: '12:00', close: '23:30' }] }],
      },
    ]),
    foodAuth: {
      session: vi.fn().mockResolvedValue(null),
      onChange: vi.fn(() => () => {}),
      signIn: vi.fn(),
      signOut: vi.fn(),
    },
  };
});

import { Component as OrderRoute, loader as orderLoader } from './OrderRoute';
import { Component as AdminRoute, loader as adminLoader } from './AdminRoute';
import { Component as OptionsRoute, loader as optionsLoader } from './OptionsRoute';

function renderRoute(Component: ComponentType, loader: () => Promise<unknown>, path: string) {
  const router = createMemoryRouter([{ path, Component, loader }], { initialEntries: [path] });
  render(<RouterProvider router={router} />);
}

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe('food route integration without configured Supabase', () => {
  it('shows the friendly no-active-week state', async () => {
    renderRoute(OrderRoute, orderLoader, '/');
    expect(
      await screen.findByRole('heading', { name: /No hay ningún pedido abierto/ }),
    ).toBeVisible();
    expect(screen.getByText(/Falta conectar el proyecto de Supabase/)).toBeVisible();
  });

  it('shows the admin sign-in surface without catalog editing controls', async () => {
    renderRoute(AdminRoute, adminLoader, '/admin');
    expect(await screen.findByRole('heading', { name: 'Administración' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Entrar' })).toBeDisabled();
    expect(screen.queryByText(/editar restaurante/i)).not.toBeInTheDocument();
  });

  it('lists imported restaurants with descriptions and Uber Eats links', async () => {
    renderRoute(OptionsRoute, optionsLoader, '/options');
    expect(await screen.findByRole('heading', { name: 'PSM Burger' })).toBeVisible();
    expect(screen.getByText('Hamburguesas artesanas en Telde.')).toBeVisible();
    expect(screen.getByText('45 platos disponibles')).toBeVisible();
    expect(screen.getByText('Horario')).toBeVisible();
    expect(screen.getByRole('link', { name: /Ver en Uber Eats/ })).toHaveAttribute(
      'href',
      'https://www.ubereats.com/es/store/psm-burger-telde/example',
    );
  });

  it('loads restaurant options and an unauthenticated admin session at route boundaries', async () => {
    await expect(optionsLoader()).resolves.toHaveLength(1);
    await expect(adminLoader()).resolves.toMatchObject({
      session: null,
      catalog: [],
      current: null,
      history: [],
    });
  });
});
