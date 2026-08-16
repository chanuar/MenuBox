import type { Session } from '@supabase/supabase-js';

export type OpeningPeriod = { open: string; close: string };
export type OpeningDay = { day: number; periods: OpeningPeriod[] };

export type Restaurant = {
  id: string;
  name: string;
  description: string;
  imageUrl: string | null;
  sourceUrl: string | null;
  availableItems: number;
  openingHours: OpeningDay[];
};

export type MenuItem = {
  id: string;
  restaurantId: string;
  category: string;
  name: string;
  description: string;
  priceCents: number;
  currency: string;
  imageUrl: string | null;
  available: boolean;
};

export type OrderItem = {
  id: string;
  menuItemId: string;
  name: string;
  unitPriceCents: number;
  quantity: number;
  note: string;
  lineTotalCents: number;
};

export type FoodOrder = {
  id: string;
  cycleId: string;
  cycleStatus: string;
  displayName: string;
  note: string;
  createdAt: string;
  updatedAt: string;
  totalCents: number;
  restaurant: Restaurant | null;
  items: OrderItem[];
};

export type ActiveMenu = {
  cycle: { id: string; status: string; openedAt: string };
  restaurant: Restaurant;
  menuItems: MenuItem[];
};

export type Credential = { cycleId: string; orderId: string; token: string };
export type CartEntry = { quantity: number; note: string };
export type Cart = Record<string, CartEntry>;
export type OrderItemPayload = { menu_item_id: string; quantity: number; note: string | null };

export type AdminOrderItem = {
  id: string;
  menuItemId: string;
  name: string;
  unitPriceCents: number;
  currency: string;
  quantity: number;
  note: string;
};

export type AdminOrder = {
  id: string;
  displayName: string;
  note: string;
  createdAt: string;
  updatedAt: string;
  totalCents: number;
  items: AdminOrderItem[];
};

export type AdminCycle = {
  id: string;
  status: string;
  openedAt: string;
  closedAt: string | null;
  restaurant: Restaurant;
  subtotalCents: number;
  serviceFeeCents: number;
  totalCents: number;
  orders: AdminOrder[];
};

export type OrderRouteData = {
  menu: ActiveMenu | null;
  credential: Credential | null;
  order: FoodOrder | null;
};

export type AdminRouteData = {
  session: Session | null;
  authorized: boolean | undefined;
  catalog: Restaurant[];
  current: AdminCycle | null;
  history: AdminCycle[];
};
