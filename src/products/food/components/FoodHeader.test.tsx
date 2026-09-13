import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { MemoryRouter } from 'react-router';
import FoodHeader from './FoodHeader';

afterEach(cleanup);

describe('employee menu controls', () => {
  it('offers the order and restaurant routes with a secondary administration entry', () => {
    render(
      <MemoryRouter initialEntries={['/options']}>
        <FoodHeader />
      </MemoryRouter>,
    );
    expect(screen.getByRole('link', { name: 'Restaurantes' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.getByRole('link', { name: 'Mi pedido' })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: 'Ruleta' })).toHaveAttribute('href', '/roulette');
    expect(screen.getByRole('link', { name: 'Administración' })).toHaveClass('food-header__admin');
    expect(screen.getByRole('link', { name: /Saltar al contenido/ })).toHaveAttribute(
      'href',
      '#main-content',
    );
  });

  it('moves keyboard focus to the main content without adding a fragment history entry', async () => {
    render(
      <MemoryRouter>
        <FoodHeader />
        <main id="main-content" tabIndex={-1}>
          El pedido
        </main>
      </MemoryRouter>,
    );
    const user = userEvent.setup();
    const originalUrl = window.location.href;
    const historyLength = window.history.length;
    await user.tab();
    expect(screen.getByRole('link', { name: /Saltar al contenido/ })).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(screen.getByRole('main')).toHaveFocus();
    expect(window.location.href).toBe(originalUrl);
    expect(window.history.length).toBe(historyLength);
  });
});
