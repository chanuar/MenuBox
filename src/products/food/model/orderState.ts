import type { ActiveMenu, Credential, FoodOrder, OrderRouteData } from './types';

export type OrderWorkflow = {
  active: ActiveMenu | null;
  savedOrder: FoodOrder | null;
  credential: Credential | null;
  editing: boolean;
};

export type OrderAction =
  | { type: 'edit' }
  | { type: 'credential-recorded'; credential: Credential }
  | { type: 'saved'; credential: Credential; order: FoodOrder }
  | { type: 'closed'; order: FoodOrder | null }
  | { type: 'forget' };

export function initialOrderWorkflow(data: OrderRouteData): OrderWorkflow {
  if (data.order)
    return {
      active: data.menu,
      savedOrder: data.order,
      credential: data.credential,
      editing: false,
    };
  if (data.menu) return { active: data.menu, savedOrder: null, credential: null, editing: true };
  return { active: null, savedOrder: null, credential: null, editing: false };
}

export function orderWorkflowReducer(state: OrderWorkflow, action: OrderAction): OrderWorkflow {
  switch (action.type) {
    case 'edit':
      return state.active && state.savedOrder ? { ...state, editing: true } : state;
    case 'credential-recorded':
      return { ...state, credential: action.credential };
    case 'saved':
      return { ...state, credential: action.credential, savedOrder: action.order, editing: false };
    case 'closed':
      return action.order
        ? { ...state, savedOrder: action.order, editing: false }
        : { active: null, savedOrder: null, credential: null, editing: false };
    case 'forget':
      return state.active
        ? { ...state, savedOrder: null, credential: null, editing: true }
        : { active: null, savedOrder: null, credential: null, editing: false };
  }
}
