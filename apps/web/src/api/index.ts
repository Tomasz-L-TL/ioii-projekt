import { isRecord, request } from './client';
import type {
  AvailabilityDto,
  BookingDto,
  BookingInput,
  RoomDto,
  UserDto,
} from './types';
export const isUser = (v: unknown): v is UserDto =>
  isRecord(v) &&
  Number.isInteger(v.id) &&
  typeof v.email === 'string' &&
  typeof v.displayName === 'string' &&
  (v.role === 'STUDENT' || v.role === 'ADMIN');
const isRoom = (v: unknown): v is RoomDto =>
  isRecord(v) &&
  Number.isInteger(v.id) &&
  typeof v.roomNumber === 'string' &&
  (v.name === null || typeof v.name === 'string') &&
  Number.isInteger(v.capacity);
const isBooking = (v: unknown): v is BookingDto =>
  isRecord(v) &&
  Number.isInteger(v.id) &&
  Number.isInteger(v.studentId) &&
  isRoom(v.room) &&
  typeof v.date === 'string' &&
  Number.isInteger(v.startHour) &&
  (v.durationSlots === 1 || v.durationSlots === 2) &&
  (v.lessonMinutes === 45 || v.lessonMinutes === 90) &&
  (v.occupiedMinutes === 60 || v.occupiedMinutes === 120) &&
  ['ACTIVE', 'CANCELLED'].includes(String(v.status)) &&
  ['UPCOMING', 'STARTED', 'COMPLETED', 'CANCELLED'].includes(String(v.state)) &&
  typeof v.canCancel === 'boolean' &&
  typeof v.createdAt === 'string' &&
  isRecord(v.createdBy) &&
  Number.isInteger(v.createdBy.id) &&
  typeof v.createdBy.displayName === 'string' &&
  ['STUDENT', 'ADMIN'].includes(String(v.createdBy.role)) &&
  (v.cancelledAt === null || typeof v.cancelledAt === 'string') &&
  (v.cancelledByUserId === null || Number.isInteger(v.cancelledByUserId)) &&
  (v.cancelReason === null ||
    [
      'STUDENT_CANCELLED',
      'ADMIN_CANCELLED',
      'ROOM_DEACTIVATED',
      'TIME_BLOCKED',
    ].includes(String(v.cancelReason)));
const isAvailability = (v: unknown): v is AvailabilityDto =>
  isRecord(v) &&
  Number.isInteger(v.roomId) &&
  typeof v.weekStart === 'string' &&
  v.timeZone === 'Europe/Warsaw' &&
  Array.isArray(v.days) &&
  v.days.length === 5 &&
  v.days.every(
    (day: unknown) =>
      isRecord(day) &&
      typeof day.date === 'string' &&
      Array.isArray(day.slots) &&
      day.slots.length === 16 &&
      day.slots.every(
        (slot: unknown, index: number) =>
          isRecord(slot) &&
          slot.startHour === index + 7 &&
          ['AVAILABLE', 'RESERVED', 'BLOCKED', 'INACTIVE', 'PAST'].includes(
            String(slot.status),
          ) &&
          ['past', 'available45', 'fits90', 'available90'].every(
            (key) => typeof slot[key] === 'boolean',
          ),
      ),
  );
export function createApi(scope: AbortSignal, onUnauthorized: () => void) {
  const get = <T>(
    path: string,
    decode: (v: unknown) => v is T,
    signal: AbortSignal,
  ) =>
    request(path, decode, {
      signal: AbortSignal.any([scope, signal]),
      onUnauthorized,
    });
  const post = <T>(
    path: string,
    body: object,
    decode: (v: unknown) => v is T,
    signal: AbortSignal,
  ) =>
    request(path, decode, {
      body,
      signal: AbortSignal.any([scope, signal]),
      onUnauthorized,
    });
  return {
    rooms: (signal: AbortSignal) =>
      get(
        '/rooms',
        (v): v is RoomDto[] => Array.isArray(v) && v.every(isRoom),
        signal,
      ),
    availability: (roomId: number, weekStart: string, signal: AbortSignal) =>
      get(
        `/availability?${new URLSearchParams({ roomId: String(roomId), weekStart })}`,
        isAvailability,
        signal,
      ),
    mine: (signal: AbortSignal) =>
      get(
        '/bookings/mine',
        (v): v is BookingDto[] => Array.isArray(v) && v.every(isBooking),
        signal,
      ),
    book: (body: BookingInput, signal: AbortSignal) =>
      post('/bookings', body, isBooking, signal),
    cancel: (id: number, signal: AbortSignal) =>
      post(`/bookings/${id}/cancel`, {}, isBooking, signal),
    logout: (signal: AbortSignal) =>
      post('/auth/logout', {}, (v): v is undefined => v === undefined, signal),
  };
}
export type Api = ReturnType<typeof createApi>;
