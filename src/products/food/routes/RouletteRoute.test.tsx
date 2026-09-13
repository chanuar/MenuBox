import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { Component, loader } from './RouletteRoute';
import type { Restaurant } from '../model/types';

vi.mock('../api/foodApi', () => ({
  foodConfigured: true,
  getRestaurantOptions: vi.fn().mockResolvedValue([]),
}));

const restaurants: Restaurant[] = ['Pizza', 'Sushi', 'Tacos'].map((name) => ({
  id: name,
  name,
  description: '',
  imageUrl: null,
  sourceUrl: `https://example.com/${name}`,
  availableItems: 1,
  openingHours: [],
}));

function show(items = restaurants, reduced = false) {
  vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: reduced }));
  const router = createMemoryRouter([{ path: '/roulette', Component, loader }], {
    initialEntries: ['/roulette'],
    hydrationData: { loaderData: { '0': items } },
  });
  return render(<RouterProvider router={router} />);
}

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it('finishes on the selected segment, announces it, and supports another spin', () => {
  vi.useFakeTimers();
  vi.spyOn(Math, 'random').mockReturnValueOnce(0.5).mockReturnValueOnce(0.99);
  const { container } = show();
  fireEvent.click(screen.getByRole('button', { name: 'Girar ruleta' }));
  screen.getAllByRole('button').forEach((button) => expect(button).toBeDisabled());
  screen.getAllByRole('checkbox').forEach((checkbox) => expect(checkbox).toBeDisabled());
  expect(screen.getByRole('status')).toHaveTextContent('Eligiendo restaurante');
  expect(container.querySelector('.food-roulette__wheel')).toHaveStyle({
    transform: 'rotate(1980deg)',
  });
  act(() => vi.advanceTimersByTime(4200));
  expect(screen.getByRole('status')).toHaveTextContent('¡Hoy toca Sushi!');
  expect(screen.getByRole('link', { name: /Ver carta/ })).toHaveAttribute(
    'href',
    'https://example.com/Sushi',
  );
  fireEvent.click(screen.getByRole('button', { name: 'Girar ruleta desde el centro' }));
  act(() => vi.advanceTimersByTime(4200));
  expect(screen.getByRole('status')).toHaveTextContent('¡Hoy toca Tacos!');
  expect(container.querySelector('.food-roulette__wheel')).toHaveStyle({
    transform: 'rotate(4020deg)',
  });
});

it('shows an empty state and has no spin button without restaurants', () => {
  show([]);
  expect(
    screen.getByRole('heading', { name: 'Todavía no hay restaurantes disponibles' }),
  ).toBeVisible();
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
});

it('reveals the result immediately with reduced motion', () => {
  vi.spyOn(Math, 'random').mockReturnValue(0);
  show(restaurants, true);
  fireEvent.click(screen.getByRole('button', { name: 'Girar ruleta' }));
  expect(screen.getByRole('status')).toHaveTextContent('¡Hoy toca Pizza!');
  screen.getAllByRole('button').forEach((button) => expect(button).toBeEnabled());
});

it('selects the only restaurant immediately', () => {
  show(restaurants.slice(0, 1));
  fireEvent.click(screen.getByRole('button', { name: 'Girar ruleta' }));
  expect(screen.getByRole('status')).toHaveTextContent('¡Hoy toca Pizza!');
});

it('excludes restaurants from the wheel and draw, clears the result, and allows reselecting', async () => {
  const user = userEvent.setup();
  vi.spyOn(Math, 'random').mockReturnValue(0);
  const { container } = show(restaurants, true);
  const pizza = screen.getByRole('checkbox', { name: 'Pizza' });
  await user.click(pizza);
  expect(pizza).not.toBeChecked();
  expect(pizza).toHaveFocus();
  expect(container.querySelectorAll('.food-roulette__number')).toHaveLength(2);
  expect(screen.getByRole('status')).toHaveTextContent('2 restaurantes');

  const hub = screen.getByRole('button', { name: 'Girar ruleta desde el centro' });
  hub.focus();
  await user.keyboard('{Enter}');
  expect(screen.getByRole('status')).toHaveTextContent('¡Hoy toca Sushi!');
  expect(container.querySelector('.food-roulette__wheel')).toHaveStyle({
    transform: 'rotate(2070deg)',
  });

  await user.click(screen.getByRole('checkbox', { name: 'Sushi' }));
  expect(screen.getByRole('status')).not.toHaveTextContent('¡Hoy toca');
  expect(screen.queryByRole('link', { name: /Ver carta/ })).not.toBeInTheDocument();
  expect(container.querySelector('.food-roulette__wheel')).toHaveStyle({
    transform: 'rotate(0deg)',
  });
  await user.click(screen.getByRole('checkbox', { name: 'Tacos' }));
  expect(screen.getByRole('status')).toHaveTextContent('Selecciona al menos un restaurante');
  expect(container.querySelectorAll('.food-roulette__number')).toHaveLength(0);
  screen.getAllByRole('button').forEach((button) => expect(button).toBeDisabled());

  await user.click(pizza);
  expect(pizza).toBeChecked();
  expect(container.querySelectorAll('.food-roulette__number')).toHaveLength(1);
  hub.focus();
  await user.keyboard(' ');
  expect(screen.getByRole('status')).toHaveTextContent('¡Hoy toca Pizza!');
});
