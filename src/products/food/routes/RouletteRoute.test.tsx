import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { Component, loader } from './RouletteRoute';
import { getFoodTypes } from '../model/foodTypes';
import type { Restaurant } from '../model/types';

vi.mock('../api/foodApi', () => ({
  foodConfigured: true,
  getRestaurantOptions: vi.fn().mockResolvedValue([]),
}));

const makeRestaurant = (name: string, description = ''): Restaurant => ({
  id: name,
  name,
  description,
  imageUrl: null,
  sourceUrl: `https://example.com/${name}`,
  availableItems: 1,
  openingHours: [],
});
const restaurants = ['Pizza', 'Sushi', 'Tacos'].map((name) => makeRestaurant(name));

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
  screen.getAllByRole('radio').forEach((radio) => expect(radio).toBeDisabled());
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

it('moves keyboard focus to selection before the wheel and keeps the full option names accessible', async () => {
  const user = userEvent.setup();
  const { container } = show();
  const changeSelection = screen.getByRole('button', { name: 'Cambiar selección' });
  expect(container.querySelector('.food-roulette__number small')).toHaveTextContent('Pizza');
  changeSelection.focus();
  await user.keyboard('{Enter}');
  expect(screen.getByRole('heading', { name: 'Restaurantes' })).toHaveFocus();
  await user.tab();
  expect(screen.getByRole('checkbox', { name: 'Pizza' })).toHaveFocus();
  await user.keyboard(' ');
  expect(screen.getByRole('checkbox', { name: 'Pizza' })).not.toBeChecked();
});

it('uses the winning restaurant photo and does not invent a missing menu link', () => {
  const restaurant = {
    ...restaurants[0]!,
    imageUrl: 'https://example.com/pizza.jpg',
    sourceUrl: null,
  };
  const { container } = show([restaurant]);
  fireEvent.click(screen.getByRole('button', { name: 'Girar ruleta' }));
  expect(screen.getByRole('heading', { name: '¡Hoy toca Pizza!' })).toBeVisible();
  expect(screen.getByRole('status')).toHaveTextContent('Carta online no disponible');
  expect(screen.queryByRole('link', { name: /Ver carta/ })).not.toBeInTheDocument();
  const photo = container.querySelector('.food-roulette__winner-image');
  expect(photo).toHaveAttribute('src', restaurant.imageUrl);
  fireEvent.error(photo!);
  expect(photo).not.toBeVisible();
  expect(screen.getByRole('button', { name: 'Volver a girar' })).toBeEnabled();
});

it('groups multiple cuisines without duplicate types and keeps unclassified restaurants', () => {
  const pizzaKebab = makeRestaurant('Pizzería KEBAB');
  const burger = makeRestaurant("McDonald's");
  const pasta = makeRestaurant('La casa', 'Cocina italiana, pasta y pizza');
  const unknown = makeRestaurant('La plaza', 'Usa tu cuenta de Uber para pedir pizza');
  expect(getFoodTypes([pizzaKebab, burger, pasta, unknown])).toEqual([
    { id: 'pizza', name: 'Pizza', restaurants: [pizzaKebab, pasta] },
    { id: 'burgers', name: 'Hamburguesas', restaurants: [burger] },
    { id: 'kebab', name: 'Kebab', restaurants: [pizzaKebab] },
    { id: 'italian', name: 'Italiana', restaurants: [pasta] },
    { id: 'other', name: 'Otros', restaurants: [unknown] },
  ]);
  expect(getFoodTypes([])).toEqual([]);
});

it('gives cuisines equal segments and narrows the next spin to matching restaurants', async () => {
  const user = userEvent.setup();
  const random = vi.spyOn(Math, 'random').mockReturnValue(0.6);
  const { container } = show(
    ['Pizza Norte', 'Pizza Sur', 'Sushi'].map((name) => makeRestaurant(name)),
    true,
  );
  const restaurantMode = screen.getByRole('radio', { name: 'Restaurante' });
  restaurantMode.focus();
  await user.keyboard('{ArrowRight}');
  expect(screen.getByRole('radio', { name: 'Tipo de comida' })).toBeChecked();
  expect(screen.getByRole('status')).toHaveTextContent('2 tipos de comida');
  expect(container.querySelectorAll('.food-roulette__number')).toHaveLength(2);
  await user.click(screen.getByRole('button', { name: 'Girar ruleta desde el centro' }));
  expect(screen.getByRole('status')).toHaveTextContent('¡Hoy toca Sushi!');
  expect(container.querySelector('.food-roulette__wheel')).toHaveStyle({
    transform: 'rotate(1890deg)',
  });
  expect(screen.queryByRole('link', { name: /Ver carta/ })).not.toBeInTheDocument();

  random.mockReturnValue(0);
  await user.click(screen.getByRole('button', { name: 'Volver a girar' }));
  await user.click(screen.getByRole('button', { name: 'Elegir restaurante de Pizza' }));
  expect(restaurantMode).toBeChecked();
  expect(restaurantMode).toHaveFocus();
  expect(screen.getByRole('status')).toHaveTextContent('2 restaurantes');
  expect(screen.queryByRole('checkbox', { name: 'Sushi' })).not.toBeInTheDocument();
  await user.click(screen.getByRole('checkbox', { name: 'Pizza Norte' }));
  await user.click(screen.getByRole('button', { name: 'Girar ruleta' }));
  expect(screen.getByRole('status')).toHaveTextContent('¡Hoy toca Pizza Sur!');
  expect(screen.getByRole('link', { name: /Ver carta/ })).toHaveAttribute(
    'href',
    'https://example.com/Pizza Sur',
  );
  await user.click(screen.getByRole('checkbox', { name: 'Pizza Sur' }));
  await user.click(screen.getByRole('button', { name: 'Ver todos los restaurantes' }));
  expect(restaurantMode).toHaveFocus();
  expect(screen.getByRole('checkbox', { name: 'Sushi' })).toBeChecked();
  expect(screen.getByRole('checkbox', { name: 'Pizza Norte' })).not.toBeChecked();
  await user.click(screen.getByRole('radio', { name: 'Tipo de comida' }));
  expect(screen.queryByRole('checkbox', { name: 'Pizza' })).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Girar ruleta' }));
  expect(screen.getByRole('status')).toHaveTextContent('¡Hoy toca Sushi!');
  await user.click(screen.getByRole('radio', { name: 'Restaurante' }));
  await user.click(screen.getByRole('checkbox', { name: 'Sushi' }));
  await user.click(screen.getByRole('radio', { name: 'Tipo de comida' }));
  expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  expect(screen.getByText(/Vuelve a «Restaurante»/)).toBeVisible();
  await user.click(screen.getByRole('radio', { name: 'Restaurante' }));
  await user.click(screen.getByRole('checkbox', { name: 'Sushi' }));
  await user.click(screen.getByRole('radio', { name: 'Tipo de comida' }));
  expect(screen.getByRole('checkbox', { name: 'Sushi' })).toBeChecked();
});

it('preserves independent exclusions across modes and can recover from no selected cuisines', async () => {
  const user = userEvent.setup();
  show(restaurants, true);
  await user.click(screen.getByRole('checkbox', { name: 'Tacos' }));
  await user.click(screen.getByRole('radio', { name: 'Tipo de comida' }));
  expect(screen.queryByRole('checkbox', { name: 'Mexicana' })).not.toBeInTheDocument();
  await user.click(screen.getByRole('checkbox', { name: 'Sushi' }));
  await user.click(screen.getByRole('checkbox', { name: 'Pizza' }));
  expect(screen.getByRole('status')).toHaveTextContent('Selecciona al menos un tipo de comida');
  expect(screen.getByRole('button', { name: 'Girar ruleta' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Girar ruleta desde el centro' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Cambiar selección' })).toBeEnabled();
  await user.click(screen.getByRole('checkbox', { name: 'Pizza' }));
  await user.click(screen.getByRole('button', { name: 'Girar ruleta desde el centro' }));
  expect(screen.getByRole('status')).toHaveTextContent('¡Hoy toca Pizza!');
  await user.click(screen.getByRole('radio', { name: 'Restaurante' }));
  expect(screen.getByRole('status')).not.toHaveTextContent('¡Hoy toca');
  expect(screen.getByRole('checkbox', { name: 'Tacos' })).not.toBeChecked();
  expect(screen.getByRole('checkbox', { name: 'Sushi' })).toBeChecked();
  await user.click(screen.getByRole('radio', { name: 'Tipo de comida' }));
  expect(screen.getByRole('checkbox', { name: 'Sushi' })).not.toBeChecked();
  expect(screen.getByRole('checkbox', { name: 'Pizza' })).toBeChecked();
});

it('locks cuisine controls during animation and clears the result when switching modes', () => {
  vi.useFakeTimers();
  vi.spyOn(Math, 'random').mockReturnValue(0);
  show();
  fireEvent.click(screen.getByRole('radio', { name: 'Tipo de comida' }));
  fireEvent.click(screen.getByRole('button', { name: 'Girar ruleta desde el centro' }));
  expect(screen.getByRole('status')).toHaveTextContent('Eligiendo tipo de comida');
  screen.getAllByRole('radio').forEach((radio) => expect(radio).toBeDisabled());
  screen.getAllByRole('checkbox').forEach((checkbox) => expect(checkbox).toBeDisabled());
  act(() => vi.advanceTimersByTime(4200));
  expect(screen.getByRole('status')).toHaveTextContent('¡Hoy toca Pizza!');
  fireEvent.click(screen.getByRole('radio', { name: 'Restaurante' }));
  act(() => vi.advanceTimersByTime(4200));
  expect(screen.getByRole('status')).toHaveTextContent('3 restaurantes');
  expect(screen.queryByRole('button', { name: /Elegir restaurante de/ })).not.toBeInTheDocument();
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
  expect(screen.getByRole('button', { name: 'Girar ruleta' })).toBeDisabled();
  expect(hub).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Cambiar selección' })).toBeEnabled();

  await user.click(pizza);
  expect(pizza).toBeChecked();
  expect(container.querySelectorAll('.food-roulette__number')).toHaveLength(1);
  hub.focus();
  await user.keyboard(' ');
  expect(screen.getByRole('status')).toHaveTextContent('¡Hoy toca Pizza!');
});
