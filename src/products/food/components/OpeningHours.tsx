import { useId, useMemo, useState } from 'react';
import type { OpeningDay, OpeningPeriod, Restaurant } from '../model/types';

const WEEK_DAYS = [
  { id: 1, label: 'Lunes', short: 'Lun' },
  { id: 2, label: 'Martes', short: 'Mar' },
  { id: 3, label: 'Miércoles', short: 'Mié' },
  { id: 4, label: 'Jueves', short: 'Jue' },
  { id: 5, label: 'Viernes', short: 'Vie' },
  { id: 6, label: 'Sábado', short: 'Sáb' },
  { id: 7, label: 'Domingo', short: 'Dom' },
];

const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

export function normalizeOpeningHours(value: unknown): OpeningDay[] {
  if (!Array.isArray(value)) return [];
  const days = new Map<number, OpeningDay>();
  for (const entry of value) {
    if (!entry || typeof entry !== 'object') continue;
    const raw = entry as { day?: unknown; periods?: unknown };
    const day = Number(raw.day);
    if (!Number.isInteger(day) || day < 1 || day > 7 || days.has(day)) continue;
    const periods = Array.isArray(raw.periods)
      ? raw.periods
          .filter((period): period is OpeningPeriod =>
            Boolean(
              period &&
              typeof period === 'object' &&
              TIME_PATTERN.test((period as OpeningPeriod).open) &&
              TIME_PATTERN.test((period as OpeningPeriod).close) &&
              (period as OpeningPeriod).open !== (period as OpeningPeriod).close,
            ),
          )
          .slice(0, 4)
          .map((period) => ({ open: period.open, close: period.close }))
      : [];
    days.set(day, { day, periods });
  }
  return [...days.values()].sort((a, b) => a.day - b.day);
}

export function formatOpeningPeriods(periods: OpeningPeriod[] | undefined) {
  if (!periods?.length) return 'Cerrado';
  return periods.map((period) => `${period.open}–${period.close}`).join(', ');
}

function canaryWeekDay(date = new Date()) {
  const short = new Intl.DateTimeFormat('en-GB', {
    weekday: 'short',
    timeZone: 'Atlantic/Canary',
  }).format(date);
  return (
    ({ Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 } as Record<string, number>)[short] ??
    1
  );
}

function getTodayHours(openingHours: OpeningDay[], date = new Date()) {
  const day = canaryWeekDay(date);
  return openingHours.find((entry) => entry.day === day) ?? { day, periods: [] };
}

export function OpeningHours({
  openingHours,
  compact = false,
}: {
  openingHours?: OpeningDay[];
  compact?: boolean;
}) {
  const normalized = normalizeOpeningHours(openingHours);
  const today = getTodayHours(normalized);

  if (!normalized.length) {
    return (
      <div className={`food-hours-empty${compact ? ' food-hours-empty--compact' : ''}`}>
        Horario pendiente de confirmar
      </div>
    );
  }

  return (
    <details className={`food-hours${compact ? ' food-hours--compact' : ''}`}>
      <summary>
        <span>Horario</span>
        <strong>Hoy · {formatOpeningPeriods(today.periods)}</strong>
      </summary>
      <dl>
        {WEEK_DAYS.map((day) => {
          const entry = normalized.find((candidate) => candidate.day === day.id);
          return (
            <div className={day.id === today.day ? 'is-today' : ''} key={day.id}>
              <dt>
                {day.label}
                <span className="sr-only">{day.id === today.day ? ', hoy' : ''}</span>
              </dt>
              <dd>{formatOpeningPeriods(entry?.periods)}</dd>
            </div>
          );
        })}
      </dl>
    </details>
  );
}

function editableSchedule(openingHours: OpeningDay[]) {
  const normalized = normalizeOpeningHours(openingHours);
  return WEEK_DAYS.map(
    (day) => normalized.find((entry) => entry.day === day.id) ?? { day: day.id, periods: [] },
  );
}

export function OpeningHoursForm({
  restaurant,
  onSave,
  pending = false,
}: {
  restaurant: Pick<Restaurant, 'id' | 'openingHours'>;
  onSave: (restaurantId: string, openingHours: OpeningDay[]) => void;
  pending?: boolean;
}) {
  const formId = useId();
  const initial = useMemo(
    () => editableSchedule(restaurant.openingHours),
    [restaurant.openingHours],
  );
  const [schedule, setSchedule] = useState(initial);

  function updateDay(dayId: number, updater: (entry: OpeningDay) => OpeningDay) {
    setSchedule((current) =>
      current.map((entry) => (entry.day === dayId ? updater(entry) : entry)),
    );
  }

  function toggleDay(dayId: number, enabled: boolean) {
    updateDay(dayId, (entry) => ({
      ...entry,
      periods: enabled ? [{ open: '12:00', close: '23:00' }] : [],
    }));
  }

  function updatePeriod(dayId: number, index: number, field: keyof OpeningPeriod, value: string) {
    updateDay(dayId, (entry) => ({
      ...entry,
      periods: entry.periods.map((period, periodIndex) =>
        periodIndex === index ? { ...period, [field]: value } : period,
      ),
    }));
  }

  function addPeriod(dayId: number) {
    updateDay(dayId, (entry) => ({
      ...entry,
      periods: [...entry.periods, { open: '12:00', close: '16:00' }],
    }));
  }

  function removePeriod(dayId: number, index: number) {
    updateDay(dayId, (entry) => ({
      ...entry,
      periods: entry.periods.filter((_, periodIndex) => periodIndex !== index),
    }));
  }

  return (
    <form
      className="food-hours-form"
      onSubmit={(event) => {
        event.preventDefault();
        onSave(
          restaurant.id,
          schedule.filter((entry) => entry.periods.length),
        );
      }}
    >
      <div className="food-hours-form__days">
        {WEEK_DAYS.map((day) => {
          const entry = schedule.find((candidate) => candidate.day === day.id)!;
          const enabled = Boolean(entry.periods.length);
          return (
            <fieldset className="food-hours-form__day" key={day.id}>
              <legend className="sr-only">{day.label}</legend>
              <label className="food-hours-form__toggle">
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={(event) => toggleDay(day.id, event.target.checked)}
                />
                <span>{day.label}</span>
              </label>
              {enabled ? (
                <div className="food-hours-form__periods">
                  {entry.periods.map((period, index) => (
                    <div className="food-hours-form__period" key={`${day.id}-${index}`}>
                      <label>
                        <span className="sr-only">
                          {day.label}, apertura del tramo {index + 1}
                        </span>
                        <input
                          type="time"
                          required
                          value={period.open}
                          onChange={(event) =>
                            updatePeriod(day.id, index, 'open', event.target.value)
                          }
                        />
                      </label>
                      <span aria-hidden="true">–</span>
                      <label>
                        <span className="sr-only">
                          {day.label}, cierre del tramo {index + 1}
                        </span>
                        <input
                          type="time"
                          required
                          value={period.close}
                          onChange={(event) =>
                            updatePeriod(day.id, index, 'close', event.target.value)
                          }
                        />
                      </label>
                      {entry.periods.length > 1 && (
                        <button
                          type="button"
                          className="food-hours-form__remove"
                          onClick={() => removePeriod(day.id, index)}
                          aria-label={`Eliminar tramo ${index + 1} del ${day.label.toLocaleLowerCase('es')}`}
                        >
                          ×
                        </button>
                      )}
                    </div>
                  ))}
                  {entry.periods.length < 4 && (
                    <button
                      type="button"
                      className="food-hours-form__add"
                      onClick={() => addPeriod(day.id)}
                    >
                      + Añadir tramo
                    </button>
                  )}
                </div>
              ) : (
                <span className="food-hours-form__closed">Cerrado</span>
              )}
            </fieldset>
          );
        })}
      </div>
      <button
        className="food-button"
        type="submit"
        disabled={pending}
        aria-describedby={`${formId}-help`}
      >
        {pending ? 'Guardando…' : 'Guardar horario'}
      </button>
      <p className="food-help" id={`${formId}-help`}>
        Las horas se muestran en horario de Canarias.
      </p>
    </form>
  );
}
