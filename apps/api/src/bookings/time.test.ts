import { describe, expect, it } from 'vitest';
import {
  addDays,
  bookingState,
  calendarDate,
  isFuture,
  localNow,
  validateTerm,
} from './time.js';

describe('TC-08: kalendarz i Europe/Warsaw niezależnie od strefy hosta', () => {
  it.each([
    '2026-02-30',
    '2026-02-29',
    '2026-04-31',
    '2026-13-01',
    '2026-00-01',
    '2026-01-00',
    '0000-01-01',
    '26-01-01',
    '2026-1-01',
    '2026-01-01Z',
    '2026-01-01T00:00:00+01:00',
    ' 2026-01-01',
    '',
    null,
    20260101,
  ])('odrzuca datę %j bez normalizacji', (date) => {
    expect(() => calendarDate(date)).toThrow();
  });
  it('obsługuje lata przestępne, granice miesiąca/roku i lata 0001…0099', () => {
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('0099-12-31', 1)).toBe('0100-01-01');
    expect(calendarDate('0001-01-01').getUTCFullYear()).toBe(1);
  });
  it.each([
    [new Date(Date.UTC(2026, 2, 16, 5)), 1],
    [new Date(Date.UTC(2026, 9, 19, 4)), 2],
  ])('liczy +14 kalendarzowo przez zmianę DST: %s', (now, offset) => {
    const today = localNow(now).date;
    const last = addDays(today, 14);
    expect(() =>
      validateTerm({ date: last, startHour: 7, durationSlots: 1 }, now, true),
    ).not.toThrow();
    expect(() =>
      validateTerm(
        { date: addDays(today, 15), startHour: 7, durationSlots: 1 },
        now,
        true,
      ),
    ).toThrow('14 dni');
    expect(() =>
      validateTerm(
        { date: addDays(today, 15), startHour: 7, durationSlots: 1 },
        now,
        false,
      ),
    ).not.toThrow();
    expect(localNow(now).hour).toBe(now.getUTCHours() + offset);
  });
  it('przyszłość jest ścisła; dzień lokalny różni się od UTC', () => {
    const midnight = new Date(Date.UTC(2026, 5, 14, 22, 30));
    expect(localNow(midnight)).toMatchObject({ date: '2026-06-15', hour: 0 });
    const start = new Date(Date.UTC(2026, 5, 15, 5));
    expect(
      isFuture(localNow(start).date, 7, new Date(start.getTime() - 1)),
    ).toBe(true);
    expect(isFuture(localNow(start).date, 7, start)).toBe(false);
    expect(
      isFuture(localNow(start).date, 7, new Date(start.getTime() + 1)),
    ).toBe(false);
  });
  it('wylicza zakończenie zajęć 45/90 min, zachowując osobną zajętość bufora', () => {
    const now = new Date(Date.UTC(2026, 5, 15, 5));
    const booking = {
      date: localNow(now).date,
      startHour: 7,
      durationSlots: 1,
      status: 'ACTIVE',
    };
    expect(bookingState(booking, new Date(now.getTime() - 1))).toBe('UPCOMING');
    expect(bookingState(booking, now)).toBe('STARTED');
    expect(bookingState(booking, new Date(now.getTime() + 44 * 60000))).toBe(
      'STARTED',
    );
    expect(bookingState(booking, new Date(now.getTime() + 45 * 60000))).toBe(
      'COMPLETED',
    );
    expect(
      bookingState(
        { ...booking, durationSlots: 2 },
        new Date(now.getTime() + 89 * 60000),
      ),
    ).toBe('STARTED');
    expect(
      bookingState(
        { ...booking, durationSlots: 2 },
        new Date(now.getTime() + 90 * 60000),
      ),
    ).toBe('COMPLETED');
    expect(bookingState({ ...booking, status: 'CANCELLED' }, now)).toBe(
      'CANCELLED',
    );
  });
});
