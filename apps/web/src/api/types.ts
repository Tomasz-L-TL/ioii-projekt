export type UserDto = {
  id: number;
  email: string;
  displayName: string;
  role: 'STUDENT' | 'ADMIN';
};
export type RoomDto = {
  id: number;
  roomNumber: string;
  name: string | null;
  capacity: number;
};
export type SlotStatus =
  'AVAILABLE' | 'RESERVED' | 'BLOCKED' | 'INACTIVE' | 'PAST';
export type SlotDto = {
  startHour: number;
  status: SlotStatus;
  past: boolean;
  available45: boolean;
  fits90: boolean;
  available90: boolean;
};
export type AvailabilityDto = {
  roomId: number;
  weekStart: string;
  timeZone: 'Europe/Warsaw';
  days: { date: string; slots: SlotDto[] }[];
};
export type BookingInput = {
  roomId: number;
  date: string;
  startHour: number;
  durationSlots: 1 | 2;
};
export type BookingDto = Omit<BookingInput, 'roomId'> & {
  id: number;
  studentId: number;
  room: RoomDto;
  lessonMinutes: 45 | 90;
  occupiedMinutes: 60 | 120;
  status: 'ACTIVE' | 'CANCELLED';
  state: 'UPCOMING' | 'STARTED' | 'COMPLETED' | 'CANCELLED';
  canCancel: boolean;
  createdAt: string;
  createdBy: { id: number; displayName: string; role: UserDto['role'] };
  cancelledAt: string | null;
  cancelledByUserId: number | null;
  cancelReason:
    | 'STUDENT_CANCELLED'
    | 'ADMIN_CANCELLED'
    | 'ROOM_DEACTIVATED'
    | 'TIME_BLOCKED'
    | null;
};
