import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  OpeningHours,
  OpeningHoursForm,
  formatOpeningPeriods,
  normalizeOpeningHours,
} from './OpeningHours';

afterEach(cleanup);

describe('restaurant opening hours', () => {
  const openingHours = [
    {
      day: 1,
      periods: [
        { open: '12:00', close: '16:00' },
        { open: '19:00', close: '23:30' },
      ],
    },
    { day: 2, periods: [{ open: '12:00', close: '23:30' }] },
  ];

  it('normalizes schedules and formats split shifts', () => {
    expect(normalizeOpeningHours([...openingHours, { day: 9, periods: [] }])).toEqual(openingHours);
    expect(formatOpeningPeriods(openingHours[0]!.periods)).toBe('12:00–16:00, 19:00–23:30');
    expect(formatOpeningPeriods([])).toBe('Cerrado');
  });

  it('shows a full, labelled weekly schedule', async () => {
    const user = userEvent.setup();
    render(<OpeningHours openingHours={openingHours} />);
    await user.click(screen.getByText('Horario'));
    expect(screen.getByText('Lunes')).toBeVisible();
    expect(screen.getAllByText('Cerrado')).toHaveLength(5);
  });

  it('lets an administrator enable a day and save structured hours', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(
      <OpeningHoursForm restaurant={{ id: 'restaurant-1', openingHours: [] }} onSave={onSave} />,
    );
    await user.click(screen.getByRole('checkbox', { name: 'Lunes' }));
    await user.click(screen.getByRole('button', { name: 'Guardar horario' }));
    expect(onSave).toHaveBeenCalledWith('restaurant-1', [
      { day: 1, periods: [{ open: '12:00', close: '23:00' }] },
    ]);
  });
});
