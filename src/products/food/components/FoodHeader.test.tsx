import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { MemoryRouter } from 'react-router';
import FoodHeader from './FoodHeader';

afterEach(cleanup);

describe('employee menu controls', () => {
  it('marks nested food navigation with React Router', () => {
    render(
      <MemoryRouter initialEntries={['/options']}>
        <FoodHeader />
      </MemoryRouter>,
    );
    expect(screen.getByRole('link', { name: 'Restaurantes' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });
});
