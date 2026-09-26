import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import { createMemoryRouter, RouterProvider } from 'react-router';
const api = vi.hoisted(() => ({
  submitOrder: vi.fn(),
  updateOrder: vi.fn(),
  getOrder: vi.fn(),
  getActiveMenu: vi.fn(),
}));
vi.mock('../api/foodApi', async (original) => ({
  ...(await original<typeof import('../api/foodApi')>()),
  ...api,
}));
import { Component } from './DemoRoute';
import { saveCredential, readLastCredential } from '../model/storage';
afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.restoreAllMocks();
});
it('confirms, edits and resets an example without API writes or replacing a real order credential', async () => {
  window.scrollTo = vi.fn();
  const credential = { cycleId: 'real-cycle', orderId: 'real-order', token: 'real-token' };
  saveCredential(credential);
  const stored = { ...localStorage };
  const user = userEvent.setup();
  render(
    <RouterProvider
      router={createMemoryRouter([{ path: '/demo', Component }], { initialEntries: ['/demo'] })}
    />,
  );
  await user.click(screen.getByRole('button', { name: 'Añadir una unidad de La clásica' }));
  await user.type(screen.getByRole('textbox', { name: /Tu nombre/ }), 'Ejemplo');
  await user.click(screen.getByRole('button', { name: 'Confirmar pedido de ejemplo' }));
  expect(screen.getByText('Demostración completada')).toBeInTheDocument();
  expect(screen.getAllByText(/8,50\s€/).length).toBeGreaterThan(0);
  await user.click(screen.getByRole('button', { name: /Editar/ }));
  await user.click(
    within(screen.getByRole('article', { name: 'La clásica' })).getByRole('button', {
      name: 'Añadir una unidad de La clásica',
    }),
  );
  await user.click(screen.getByRole('button', { name: 'Confirmar pedido de ejemplo' }));
  expect(screen.getAllByText(/17,00\s€/).length).toBeGreaterThan(0);
  await user.click(screen.getByRole('button', { name: 'Empezar de nuevo' }));
  expect(screen.getByRole('textbox', { name: /Tu nombre/ })).toHaveValue('');
  expect(readLastCredential()).toEqual(credential);
  expect({ ...localStorage }).toEqual(stored);
  for (const method of Object.values(api)) expect(method).not.toHaveBeenCalled();
});
