import { isRecord, request } from './client';
import type {
  AvailabilityDto,
  BookingDto,
  BookingInput,
  RoomDto,
  UserDto,
  AdminRoomDto,
  AdminBookingDto,
  StudentDto,
  BlockDto,
  BlockInput,
  ImpactDto,
  Confirmation,
  RoomInput,
  ActorDto,
} from './types';
const isActor = (v: unknown): v is ActorDto =>
  isRecord(v) &&
  Number.isInteger(v.id) &&
  typeof v.displayName === 'string' &&
  ['STUDENT', 'ADMIN'].includes(String(v.role));
const isAdminRoom = (v: unknown): v is AdminRoomDto =>
  isRecord(v) &&
  typeof v.isActive === 'boolean' &&
  (v.description === null || typeof v.description === 'string') &&
  isRoom(v);
const isAdminBooking = (v: unknown): v is AdminBookingDto =>
  isRecord(v) &&
  isActor(v.student) &&
  (v.cancelledBy === null || isActor(v.cancelledBy)) &&
  isBooking(v);
const isStudent = (v: unknown): v is StudentDto =>
  isRecord(v) &&
  Number.isInteger(v.id) &&
  typeof v.email === 'string' &&
  typeof v.displayName === 'string';
const isBlock = (v: unknown): v is BlockDto =>
  isRecord(v) &&
  Number.isInteger(v.id) &&
  Number.isInteger(v.roomId) &&
  isAdminRoom(v.room) &&
  typeof v.date === 'string' &&
  Number.isInteger(v.startHour) &&
  (v.durationSlots === 1 || v.durationSlots === 2) &&
  (v.reason === null || typeof v.reason === 'string') &&
  typeof v.createdAt === 'string' &&
  isActor(v.createdBy);
export const isImpact = (v: unknown): v is ImpactDto =>
  isRecord(v) &&
  Number.isInteger(v.roomId) &&
  Number.isInteger(v.cancellationCount) &&
  Array.isArray(v.expectedCancellationIds) &&
  v.cancellationCount === v.expectedCancellationIds.length &&
  v.expectedCancellationIds.every(
    (id: unknown, i: number, ids: unknown[]) =>
      typeof id === 'number' &&
      Number.isInteger(id) &&
      id > 0 &&
      (i === 0 || id > (ids[i - 1] as number)),
  ) &&
  typeof v.confirmationToken === 'string' &&
  v.confirmationToken.length > 0;
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
    adminRooms: (signal: AbortSignal) =>
      get(
        '/rooms',
        (v): v is AdminRoomDto[] => Array.isArray(v) && v.every(isAdminRoom),
        signal,
      ),
    students: (signal: AbortSignal) =>
      get(
        '/admin/students',
        (v): v is StudentDto[] => Array.isArray(v) && v.every(isStudent),
        signal,
      ),
    bookings: (signal: AbortSignal) =>
      get(
        '/admin/bookings',
        (v): v is AdminBookingDto[] =>
          Array.isArray(v) && v.every(isAdminBooking),
        signal,
      ),
    blocks: (signal: AbortSignal) =>
      get(
        '/admin/blocks',
        (v): v is BlockDto[] => Array.isArray(v) && v.every(isBlock),
        signal,
      ),
    saveRoom: (
      id: number | null,
      body:
        RoomInput | { isActive: true } | ({ isActive: false } & Confirmation),
      signal: AbortSignal,
    ) =>
      request(
        id === null ? '/admin/rooms' : `/admin/rooms/${id}`,
        isAdminRoom,
        {
          body,
          method: id === null ? 'POST' : 'PATCH',
          signal: AbortSignal.any([scope, signal]),
          onUnauthorized,
        },
      ),
    deactivationPreview: (id: number, signal: AbortSignal) =>
      get(`/admin/rooms/${id}/deactivation-preview`, isImpact, signal),
    blockPreview: (body: BlockInput, signal: AbortSignal) =>
      get(
        `/admin/blocks/preview?${new URLSearchParams({ roomId: String(body.roomId), date: body.date, startHour: String(body.startHour), durationSlots: String(body.durationSlots), ...(body.reason === null ? {} : { reason: body.reason }) })}`,
        isImpact,
        signal,
      ),
    createBlock: (body: BlockInput & Confirmation, signal: AbortSignal) =>
      post('/admin/blocks', body, isBlock, signal),
    deleteBlock: (id: number, signal: AbortSignal) =>
      request(`/admin/blocks/${id}`, (v): v is undefined => v === undefined, {
        method: 'DELETE',
        signal: AbortSignal.any([scope, signal]),
        onUnauthorized,
      }),
    bookFor: (
      body: BookingInput & { studentId: number },
      signal: AbortSignal,
    ) => post('/bookings', body, isBooking, signal),
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
