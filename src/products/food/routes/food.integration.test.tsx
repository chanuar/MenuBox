import type { ComponentType } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
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
import { getRestaurantOptions } from '../api/foodApi';
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
      await screen.findByRole('heading', { name: 'Estamos preparando la próxima mesa' }),
    ).toBeVisible();
    expect(screen.getByRole('link', { name: 'Explorar restaurantes' })).toHaveAttribute(
      'href',
      '/options',
    );
    expect(screen.getByRole('link', { name: 'Dejarlo a la suerte' })).toHaveAttribute(
      'href',
      '/roulette',
    );
    expect(screen.queryByText(/Supabase/)).not.toBeInTheDocument();
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
    expect(screen.getByText('Horario del restaurante')).toBeVisible();
    expect(
      screen.getByRole('link', { name: /Ver carta en Uber Eats de PSM Burger/ }),
    ).toHaveAttribute('href', 'https://www.ubereats.com/es/store/psm-burger-telde/example');
  });

  it('omits imported account instructions instead of repeating filler descriptions', async () => {
    const restaurants = await getRestaurantOptions();
    const restaurant = restaurants[0];
    if (!restaurant) throw new Error('Missing restaurant fixture');
    vi.mocked(getRestaurantOptions).mockResolvedValueOnce([
      {
        ...restaurant,
        description: 'Usa tu cuenta de Uber para pedir entregas de PSM Burger.',
      },
    ]);
    renderRoute(OptionsRoute, optionsLoader, '/options');
    expect(await screen.findByRole('heading', { name: 'PSM Burger' })).toBeVisible();
    expect(screen.getByText('45 platos disponibles')).toBeVisible();
    expect(screen.queryByText(/Usa tu cuenta de Uber/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Descubre sus platos/)).not.toBeInTheDocument();
  });

  it('shows an honest missing-menu state and a graphic fallback when a restaurant photo fails', async () => {
    const [restaurant] = await getRestaurantOptions();
    if (!restaurant) throw new Error('Missing restaurant fixture');
    vi.mocked(getRestaurantOptions).mockResolvedValueOnce([
      { ...restaurant, sourceUrl: null, description: '' },
    ]);
    renderRoute(OptionsRoute, optionsLoader, '/options');
    expect(await screen.findByRole('heading', { name: 'PSM Burger' })).toBeVisible();
    expect(screen.getByText('Carta online no disponible')).toBeVisible();
    expect(screen.queryByRole('link', { name: /Ver carta/ })).not.toBeInTheDocument();
    const photo = document.querySelector('.food-option-card img');
    if (!photo) throw new Error('Missing restaurant photo');
    fireEvent.error(photo);
    expect(document.querySelector('.food-option-card img')).not.toBeInTheDocument();
    expect(document.querySelector('.food-option-card__image--placeholder svg')).toBeVisible();
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
