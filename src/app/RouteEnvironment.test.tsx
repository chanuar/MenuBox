import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import FoodHeader from '../products/food/components/FoodHeader';
import { Component as FoodLayout, ErrorBoundary } from '../products/food/routes/FoodLayout';
import { NotFound } from './NotFound';
import { HydrateFallback, RouteEnvironment } from './RouteEnvironment';

function Page() {
  return (
    <>
      <FoodHeader />
      <main id="main-content" tabIndex={-1}>
        <h1>La mesa del equipo</h1>
      </main>
    </>
  );
}

afterEach(cleanup);

describe('route surfaces', () => {
  it.each([
    { path: '/', page: 'food', title: 'MenuBox — El pedido de la semana', indexed: true },
    { path: '/options', page: 'options', title: 'Restaurantes — MenuBox', indexed: true },
    { path: '/admin', page: 'admin', title: 'Administración — MenuBox', indexed: false },
    { path: '/roulette', page: 'roulette', title: 'Ruleta — MenuBox', indexed: false },
  ])(
    'shows accessible initial loading with matching metadata at $path',
    async ({ path, page, title, indexed }) => {
      let finishLoading!: () => void;
      const loader = () =>
        new Promise((resolve) => {
          finishLoading = () => resolve(null);
        });
      const router = createMemoryRouter(
        [
          {
            Component: RouteEnvironment,
            HydrateFallback,
            children: [{ path, handle: { page }, Component: Page, loader }],
          },
        ],
        { initialEntries: [path] },
      );
      render(<RouterProvider router={router} />);
      expect(screen.getByRole('status')).toHaveTextContent('Estamos cargando MenuBox.');
      expect(screen.getByRole('main')).toHaveAttribute('tabindex', '-1');
      expect(screen.getByRole('main')).not.toHaveFocus();
      expect(document.body).toHaveClass('food-page');
      expect(document.documentElement.lang).toBe('es');
      expect(document.title).toBe(title);
      if (indexed) {
        expect(document.head.querySelector('meta[name="robots"]')).toBeNull();
        expect(document.head.querySelector('link[rel="canonical"]')).toHaveAttribute(
          'href',
          `https://menubox.chanuar.com${path}`,
        );
      } else {
        expect(document.head.querySelector('meta[name="robots"]')).toHaveAttribute(
          'content',
          'noindex, nofollow',
        );
        expect(document.head.querySelector('link[rel="canonical"]')).toBeNull();
      }
      await act(async () => finishLoading());
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'La mesa del equipo' })).toBeVisible();
      expect(document.title).toBe(title);
      expect(screen.getByRole('main')).not.toHaveFocus();
    },
  );

  it('restores main focus when the user used the skip link while the initial page was loading', async () => {
    let finishLoading!: () => void;
    const loader = () =>
      new Promise((resolve) => {
        finishLoading = () => resolve(null);
      });
    const router = createMemoryRouter([
      {
        Component: RouteEnvironment,
        HydrateFallback,
        children: [{ path: '/', handle: { page: 'food' }, Component: Page, loader }],
      },
    ]);
    render(<RouterProvider router={router} />);
    const user = userEvent.setup();
    await user.tab();
    expect(screen.getByRole('link', { name: /Saltar al contenido/ })).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(screen.getByRole('main')).toHaveFocus();
    await act(async () => finishLoading());
    expect(screen.getByRole('heading', { name: 'La mesa del equipo' })).toBeVisible();
    expect(screen.getByRole('main')).toHaveFocus();
  });

  it('keeps the current page usable while announcing a pending navigation', async () => {
    let finishLoading!: () => void;
    const router = createMemoryRouter([
      {
        Component: RouteEnvironment,
        children: [
          {
            Component: FoodLayout,
            children: [
              { path: '/', handle: { page: 'food' }, Component: Page },
              {
                path: '/roulette',
                handle: { page: 'roulette' },
                Component: Page,
                loader: () =>
                  new Promise((resolve) => {
                    finishLoading = () => resolve(null);
                  }),
              },
            ],
          },
        ],
      },
    ]);
    render(<RouterProvider router={router} />);
    await userEvent.setup().click(screen.getByRole('link', { name: 'Ruleta' }));
    expect(screen.getByRole('status')).toHaveTextContent('Cargando página');
    expect(screen.getByRole('main')).toBeVisible();
    expect(screen.getByRole('link', { name: 'Restaurantes' })).toBeVisible();
    await act(async () => finishLoading());
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.getByRole('main')).toHaveFocus();
  });

  it('keeps navigation, focus and metadata consistent on public, private and missing pages', async () => {
    const router = createMemoryRouter(
      [
        {
          Component: RouteEnvironment,
          children: [
            { path: '/', handle: { page: 'food' }, Component: Page },
            { path: '/options', handle: { page: 'options' }, Component: Page },
            { path: '/admin', handle: { page: 'admin' }, Component: Page },
            { path: '/roulette', handle: { page: 'roulette' }, Component: Page },
            { path: '*', handle: { page: 'notFound' }, Component: NotFound },
          ],
        },
      ],
      { initialEntries: ['/no-existe'] },
    );
    render(<RouterProvider router={router} />);
    const user = userEvent.setup();

    expect(screen.getByRole('heading', { name: 'Esta página no está en la carta' })).toBeVisible();
    expect(screen.getByRole('link', { name: /Saltar al contenido/ })).toHaveAttribute(
      'href',
      '#main-content',
    );
    expect(document.head.querySelector('meta[name="robots"]')).toHaveAttribute(
      'content',
      'noindex, nofollow',
    );
    expect(document.head.querySelector('link[rel="canonical"]')).toBeNull();
    expect(document.head.querySelector('link[rel="icon"]')).toHaveAttribute('href', '/favicon.svg');

    for (const [name, path] of [
      ['Mi pedido', '/'],
      ['Restaurantes', '/options'],
    ] as const) {
      await user.click(screen.getByRole('link', { name }));
      expect(document.head.querySelector('link[rel="canonical"]')).toHaveAttribute(
        'href',
        `https://menubox.chanuar.com${path}`,
      );
      expect(document.head.querySelector('meta[name="robots"]')).toBeNull();
      expect(screen.getByRole('main')).toHaveFocus();
    }
    for (const name of ['Administración', 'Ruleta']) {
      await user.click(screen.getByRole('link', { name }));
      expect(document.head.querySelector('meta[name="robots"]')).toHaveAttribute(
        'content',
        'noindex, nofollow',
      );
      expect(document.head.querySelector('link[rel="canonical"]')).toBeNull();
      expect(screen.getByRole('main')).toHaveFocus();
    }
  });

  it('provides navigation and a read retry after a route failure without exposing technical details', async () => {
    const loader = vi
      .fn()
      .mockRejectedValueOnce(new Error('Database connection detail'))
      .mockResolvedValue(null);
    const router = createMemoryRouter([
      {
        Component: RouteEnvironment,
        HydrateFallback,
        children: [
          {
            Component: FoodLayout,
            ErrorBoundary,
            children: [{ path: '/', handle: { page: 'food' }, Component: Page, loader }],
          },
        ],
      },
    ]);
    render(<RouterProvider router={router} />);
    const user = userEvent.setup();
    expect(
      await screen.findByRole('heading', { name: 'No hemos podido cargar MenuBox' }),
    ).toBeVisible();
    expect(screen.queryByText('Database connection detail')).not.toBeInTheDocument();
    expect(screen.getByRole('main')).toHaveFocus();
    expect(screen.getByRole('link', { name: /Saltar al contenido/ })).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Volver a cargar' }));
    expect(await screen.findByRole('heading', { name: 'La mesa del equipo' })).toBeVisible();
    expect(screen.getByRole('main')).toHaveFocus();
    await waitFor(() => expect(loader).toHaveBeenCalledTimes(2));
  });
});
