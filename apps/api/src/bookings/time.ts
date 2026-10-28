import { ApiError } from '../http/errors.js';

const dayMs = 86_400_000;
const warsaw = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Warsaw',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

export function invalid(message = 'Niepoprawne dane żądania.'): never {
  throw new ApiError(422, 'INVALID_INPUT', message);
}

// UTC jest tu wyłącznie osią arytmetyki kalendarza, nie strefą rezerwacji.
export function calendarDate(value: unknown): Date {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/u.test(value))
    invalid('Podaj datę YYYY-MM-DD.');
  const [year, month, day] = value.split('-').map(Number) as [
    number,
    number,
    number,
  ];
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  if (
    year < 1 ||
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  )
    invalid('Nieistniejąca data.');
  return date;
}

export function addDays(value: string, days: number): string {
  const date = new Date(calendarDate(value).getTime() + days * dayMs);
  if (date.getUTCFullYear() > 9999 || date.getUTCFullYear() < 1)
    invalid('Data poza zakresem kalendarza.');
  return date.toISOString().slice(0, 10);
}

export function localNow(now: Date) {
  const parts = Object.fromEntries(
    warsaw.formatToParts(now).map(({ type, value }) => [type, value]),
  );
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    hour: Number(parts.hour),
    minute: Number(parts.minute),
  };
}

export function isFuture(date: string, startHour: number, now: Date): boolean {
  const local = localNow(now);
  return date > local.date || (date === local.date && startHour > local.hour);
}

export function validateTerm(
  input: { date: string; startHour: number; durationSlots: number },
  now: Date,
  student: boolean,
) {
  const day = calendarDate(input.date).getUTCDay();
  if (day === 0 || day === 6)
    throw new ApiError(
      422,
      'WEEKEND',
      'Rezerwacje są możliwe od poniedziałku do piątku.',
    );
  if (!isFuture(input.date, input.startHour, now))
    throw new ApiError(422, 'NOT_FUTURE', 'Początek musi być w przyszłości.');
  if (student && input.date > addDays(localNow(now).date, 14))
    throw new ApiError(
      422,
      'HORIZON_EXCEEDED',
      'Rezerwacja wykracza poza 14 dni kalendarzowych.',
    );
}

export function overlaps(
  a: { startHour: number; durationSlots: number },
  b: { startHour: number; durationSlots: number },
) {
  return (
    a.startHour < b.startHour + b.durationSlots &&
    b.startHour < a.startHour + a.durationSlots
  );
}

export function bookingState(
  booking: {
    status: string;
    date: string;
    startHour: number;
    durationSlots: number;
  },
  now: Date,
) {
  if (booking.status === 'CANCELLED') return 'CANCELLED';
  if (isFuture(booking.date, booking.startHour, now)) return 'UPCOMING';
  const local = localNow(now);
  if (
    booking.date < local.date ||
    (booking.date === local.date &&
      local.hour * 60 + local.minute >=
        booking.startHour * 60 + booking.durationSlots * 45)
  )
    return 'COMPLETED';
  return 'STARTED';
}
