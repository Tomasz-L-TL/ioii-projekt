import type { Role } from '../auth/service.js';
import { ApiError } from '../http/errors.js';
import { calendarDate, invalid } from './time.js';

export type BookingInput = {
  roomId: number;
  date: string;
  startHour: number;
  durationSlots: number;
  studentId?: number;
};

export function positiveId(value: unknown): number {
  if (
    typeof value !== 'number' ||
    !Number.isSafeInteger(value) ||
    value <= 0 ||
    value > 2_147_483_647
  )
    invalid('ID musi być dodatnią liczbą całkowitą.');
  return value;
}

export function pathId(value: unknown): number {
  if (typeof value !== 'string' || !/^[1-9]\d{0,9}$/u.test(value))
    invalid('Niepoprawne ID.');
  return positiveId(Number(value));
}

export function objectInput(body: unknown): Record<string, unknown> {
  if (typeof body !== 'object' || body === null || Array.isArray(body))
    invalid();
  return body as Record<string, unknown>;
}

export function bookingInput(body: unknown, role: Role): BookingInput {
  const data = objectInput(body);
  if (role === 'STUDENT' && 'studentId' in data)
    throw new ApiError(403, 'FORBIDDEN', 'Właściciel wynika z sesji studenta.');
  const allowed = [
    'roomId',
    'date',
    'startHour',
    'durationSlots',
    ...(role === 'ADMIN' ? ['studentId'] : []),
  ];
  if (Object.keys(data).some((key) => !allowed.includes(key)))
    invalid('Niedozwolone pola żądania.');
  const roomId = positiveId(data.roomId);
  calendarDate(data.date);
  if (
    typeof data.startHour !== 'number' ||
    !Number.isInteger(data.startHour) ||
    data.startHour < 7 ||
    data.startHour > 22 ||
    (data.durationSlots !== 1 && data.durationSlots !== 2) ||
    data.startHour + data.durationSlots > 23
  )
    invalid('Niepoprawna godzina lub liczba slotów.');
  return {
    roomId,
    date: data.date as string,
    startHour: data.startHour,
    durationSlots: data.durationSlots,
    ...(role === 'ADMIN' ? { studentId: positiveId(data.studentId) } : {}),
  };
}

export function emptyInput(body: unknown) {
  if (Object.keys(objectInput(body)).length !== 0)
    invalid('Żądanie wymaga pustego obiektu JSON.');
}
