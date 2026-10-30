import { normalizeRoomNumber } from '../auth/normalization.js';
import {
  bookingInput,
  objectInput,
  positiveId,
} from '../bookings/validation.js';
import { invalid } from '../bookings/time.js';

export function fields(data: Record<string, unknown>, allowed: string[]) {
  if (Object.keys(data).some((key) => !allowed.includes(key)))
    invalid('Niedozwolone pola żądania.');
}

export function optionalText(value: unknown, max: number): string | null {
  if (value === null) return null;
  if (typeof value !== 'string' || value.length > max)
    invalid('Niepoprawny tekst.');
  return value.trim() || null;
}

export function roomInput(body: unknown, partial = false) {
  const data = objectInput(body);
  fields(data, ['roomNumber', 'capacity', 'name', 'description']);
  if (!Object.keys(data).length) invalid('Podaj dane sali.');
  const result: {
    roomNumber?: string;
    capacity?: number;
    name?: string | null;
    description?: string | null;
  } = {};
  if (!partial || 'roomNumber' in data) {
    if (typeof data.roomNumber !== 'string' || data.roomNumber.length > 100)
      invalid('Niepoprawny numer sali.');
    result.roomNumber = normalizeRoomNumber(data.roomNumber);
    if (!result.roomNumber) invalid('Numer sali jest wymagany.');
  }
  if (!partial || 'capacity' in data)
    result.capacity = positiveId(data.capacity);
  if ('name' in data) result.name = optionalText(data.name, 200);
  if ('description' in data)
    result.description = optionalText(data.description, 2000);
  return result;
}

export type Confirmation = {
  confirmed: true;
  expectedCancellationIds: number[];
  confirmationToken: string;
};

export function confirmation(data: Record<string, unknown>): Confirmation {
  if (
    data.confirmed !== true ||
    !Array.isArray(data.expectedCancellationIds) ||
    typeof data.confirmationToken !== 'string' ||
    !data.confirmationToken ||
    data.confirmationToken.length > 1024
  )
    invalid('Wymagane jawne potwierdzenie i token podglądu.');
  const ids = data.expectedCancellationIds.map(positiveId);
  if (ids.some((id, index) => index > 0 && id <= ids[index - 1]!))
    invalid('ID muszą być unikalne i rosnąco posortowane.');
  return {
    confirmed: true,
    expectedCancellationIds: ids,
    confirmationToken: data.confirmationToken,
  };
}

export function roomPatch(body: unknown) {
  const data = objectInput(body);
  if (!('isActive' in data))
    return { kind: 'edit' as const, data: roomInput(body, true) };
  if (data.isActive === true) {
    fields(data, ['isActive']);
    return { kind: 'activate' as const };
  }
  if (data.isActive !== false) invalid('isActive musi być boolean.');
  fields(data, [
    'isActive',
    'confirmed',
    'expectedCancellationIds',
    'confirmationToken',
  ]);
  return { kind: 'deactivate' as const, confirmation: confirmation(data) };
}

export function blockInput(body: unknown, confirm = false) {
  const data = objectInput(body);
  fields(data, [
    'roomId',
    'date',
    'startHour',
    'durationSlots',
    'reason',
    ...(confirm
      ? ['confirmed', 'expectedCancellationIds', 'confirmationToken']
      : []),
  ]);
  const { roomId, date, startHour, durationSlots } = bookingInput(
    {
      roomId: data.roomId,
      date: data.date,
      startHour: data.startHour,
      durationSlots: data.durationSlots,
    },
    'STUDENT',
  );
  return {
    roomId,
    date,
    startHour,
    durationSlots,
    reason: 'reason' in data ? optionalText(data.reason, 2000) : null,
  };
}

export type BlockInput = ReturnType<typeof blockInput>;
