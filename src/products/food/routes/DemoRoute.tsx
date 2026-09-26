import { FoodApp } from './OrderRoute';
import type { ActiveMenu } from '../model/types';

const DEMO_MENU: ActiveMenu = {
  cycle: { id: 'demo', status: 'open', openedAt: '' },
  restaurant: {
    id: 'demo-kitchen',
    name: 'La cocina de MenuBox',
    description: 'Una carta para probar.',
    imageUrl: '/demo/burger.svg',
    sourceUrl: null,
    availableItems: 4,
    openingHours: [],
  },
  menuItems: [
    {
      id: 'demo-burger',
      restaurantId: 'demo-kitchen',
      category: 'Hamburguesas',
      name: 'La clásica',
      description: 'Pan brioche, hamburguesa a la plancha, cheddar, lechuga y nuestra salsa.',
      priceCents: 850,
      currency: 'EUR',
      imageUrl: '/demo/burger.svg',
      available: true,
    },
    {
      id: 'demo-veggie',
      restaurantId: 'demo-kitchen',
      category: 'Hamburguesas',
      name: 'La del huerto',
      description: 'Hamburguesa de garbanzos, aguacate, tomate y salsa de yogur en pan brioche.',
      priceCents: 900,
      currency: 'EUR',
      imageUrl: '/demo/veggie.svg',
      available: true,
    },
    {
      id: 'demo-fries',
      restaurantId: 'demo-kitchen',
      category: 'Para compartir',
      name: 'Papas de la casa',
      description: 'Doradas, crujientes y con un toque de romero. La pareja perfecta.',
      priceCents: 350,
      currency: 'EUR',
      imageUrl: '/demo/fries.svg',
      available: true,
    },
    {
      id: 'demo-drink',
      restaurantId: 'demo-kitchen',
      category: 'Bebidas',
      name: 'Limonada casera',
      description: 'Limón, hielo y hierbabuena. 330 ml.',
      priceCents: 250,
      currency: 'EUR',
      imageUrl: null,
      available: true,
    },
  ],
};

export function Component() {
  return <FoodApp demo initialData={{ menu: DEMO_MENU, order: null, credential: null }} />;
}
