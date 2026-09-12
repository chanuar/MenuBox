import { createBrowserRouter, type RouteObject } from 'react-router';
import { NotFound } from './NotFound';
import { RouteEnvironment } from './RouteEnvironment';

export const routes: RouteObject[] = [
  {
    Component: RouteEnvironment,
    children: [
      {
        lazy: () => import('../products/food/routes/FoodLayout'),
        children: [
          {
            index: true,
            handle: { page: 'food' },
            lazy: () => import('../products/food/routes/OrderRoute'),
          },
          {
            path: 'options',
            handle: { page: 'options' },
            lazy: () => import('../products/food/routes/OptionsRoute'),
          },
          {
            path: 'roulette',
            handle: { page: 'roulette' },
            lazy: () => import('../products/food/routes/RouletteRoute'),
          },
          {
            path: 'admin',
            handle: { page: 'admin' },
            lazy: () => import('../products/food/routes/AdminRoute'),
          },
        ],
      },
      { path: '*', handle: { page: 'notFound' }, Component: NotFound },
    ],
  },
];

export const router = createBrowserRouter(routes);
