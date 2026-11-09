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
export type AdminRoomDto = RoomDto & {
  description: string | null;
  isActive: boolean;
};
export type RoomInput = {
  roomNumber: string;
  name: string | null;
  description: string | null;
  capacity: number;
};
export type StudentDto = Pick<UserDto, 'id' | 'displayName' | 'email'>;
export type ActorDto = Pick<UserDto, 'id' | 'displayName' | 'role'>;
export type AdminBookingDto = BookingDto & {
  student: ActorDto;
  cancelledBy: ActorDto | null;
};
export type BlockInput = BookingInput & { reason: string | null };
export type BlockDto = BlockInput & {
  id: number;
  room: AdminRoomDto;
  createdAt: string;
  createdBy: ActorDto;
};
export type ImpactDto = {
  roomId: number;
  cancellationCount: number;
  expectedCancellationIds: number[];
  confirmationToken: string;
};
export type Confirmation = Pick<
  ImpactDto,
  'expectedCancellationIds' | 'confirmationToken'
> & { confirmed: true };
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
