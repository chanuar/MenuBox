import { describe, expect, it } from 'vitest';
import { initialOrderWorkflow, orderWorkflowReducer } from './orderState';
import type { ActiveMenu, Credential, FoodOrder } from './types';

const menu = {
  cycle: { id: 'cycle-1', status: 'open', openedAt: '' },
  restaurant: {
    id: 'r',
    name: 'R',
    description: '',
    imageUrl: null,
    sourceUrl: null,
    availableItems: 1,
    openingHours: [],
  },
  menuItems: [],
} satisfies ActiveMenu;
const credential = { cycleId: 'cycle-1', orderId: 'order-1', token: 'secret' } satisfies Credential;
const order = {
  id: 'order-1',
  cycleId: 'cycle-1',
  cycleStatus: 'open',
  displayName: 'Ana',
  note: '',
  createdAt: '',
  updatedAt: '',
  totalCents: 0,
  restaurant: menu.restaurant,
  items: [],
} satisfies FoodOrder;

describe('food order workflow reducer', () => {
  it('loads an open menu as a new editable order', () => {
    expect(initialOrderWorkflow({ menu, credential: null, order: null })).toMatchObject({
      editing: true,
      savedOrder: null,
    });
  });

  it('resumes a saved order without editing it', () => {
    expect(initialOrderWorkflow({ menu, credential, order })).toMatchObject({
      editing: false,
      credential,
      savedOrder: order,
    });
  });

  it('enters edit mode only for a resumable active order', () => {
    const state = initialOrderWorkflow({ menu, credential, order });
    expect(orderWorkflowReducer(state, { type: 'edit' }).editing).toBe(true);
    expect(
      orderWorkflowReducer(initialOrderWorkflow({ menu: null, credential: null, order: null }), {
        type: 'edit',
      }).editing,
    ).toBe(false);
  });

  it('records credentials before confirmation is available', () => {
    const state = initialOrderWorkflow({ menu, credential: null, order: null });
    expect(orderWorkflowReducer(state, { type: 'credential-recorded', credential })).toMatchObject({
      credential,
      editing: true,
    });
  });

  it('shows a submitted order and leaves edit mode', () => {
    const state = initialOrderWorkflow({ menu, credential: null, order: null });
    expect(orderWorkflowReducer(state, { type: 'saved', credential, order })).toMatchObject({
      savedOrder: order,
      editing: false,
    });
  });

  it('keeps the receipt when the cycle closes', () => {
    const closed = { ...order, cycleStatus: 'closed' };
    expect(
      orderWorkflowReducer(initialOrderWorkflow({ menu, credential, order }), {
        type: 'closed',
        order: closed,
      }),
    ).toMatchObject({ savedOrder: closed, editing: false });
  });

  it('falls back to the empty week when a closed order cannot be recovered', () => {
    expect(
      orderWorkflowReducer(initialOrderWorkflow({ menu, credential, order }), {
        type: 'closed',
        order: null,
      }),
    ).toMatchObject({ active: null, credential: null });
  });

  it('forgets local access while keeping the active menu editable', () => {
    expect(
      orderWorkflowReducer(initialOrderWorkflow({ menu, credential, order }), { type: 'forget' }),
    ).toMatchObject({ credential: null, savedOrder: null, editing: true });
  });
});
