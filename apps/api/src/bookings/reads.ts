import type { UserDto } from '../auth/service.js';
import type { PrismaClient } from '../generated/prisma/client.js';
import { ApiError } from '../http/errors.js';
import { addDays, calendarDate, invalid, isFuture, overlaps } from './time.js';

export class BookingReads {
  constructor(
    private readonly db: PrismaClient,
    private readonly now: () => Date = () => new Date(),
  ) {}

  rooms(actor: UserDto) {
    return this.db.room.findMany({
      where: actor.role === 'STUDENT' ? { isActive: true } : {},
      orderBy: [{ roomNumber: 'asc' }, { id: 'asc' }],
      select: {
        id: true,
        roomNumber: true,
        name: true,
        capacity: true,
        ...(actor.role === 'ADMIN' ? { isActive: true } : {}),
      },
    });
  }

  async availability(actor: UserDto, roomId: number, weekStart: string) {
    if (calendarDate(weekStart).getUTCDay() !== 1)
      invalid('weekStart musi być poniedziałkiem.');
    const last = addDays(weekStart, 4);
    // Jeden snapshot odczytu; nigdy nie traktujemy go jako gwarancji zapisu.
    const [room, bookings, blocks] = await this.db.$transaction([
      this.db.room.findUnique({
        where: { id: roomId },
        select: { id: true, isActive: true },
      }),
      this.db.booking.findMany({
        where: {
          roomId,
          status: 'ACTIVE',
          date: { gte: weekStart, lte: last },
        },
        select: { date: true, startHour: true, durationSlots: true },
      }),
      this.db.timeBlock.findMany({
        where: { roomId, date: { gte: weekStart, lte: last } },
        select: { date: true, startHour: true, durationSlots: true },
      }),
    ]);
    if (!room || (!room.isActive && actor.role === 'STUDENT'))
      throw new ApiError(404, 'ROOM_NOT_FOUND', 'Nie znaleziono sali.');
    const now = this.now();
    const days = Array.from({ length: 5 }, (_, index) => {
      const date = addDays(weekStart, index);
      const slots = Array.from({ length: 16 }, (_, index) => {
        const startHour = index + 7;
        const window = { startHour, durationSlots: 1 };
        const reserved = bookings.some(
          (row) => row.date === date && overlaps(row, window),
        );
        const blocked = blocks.some(
          (row) => row.date === date && overlaps(row, window),
        );
        const past = !isFuture(date, startHour, now);
        const status = !room.isActive
          ? 'INACTIVE'
          : blocked
            ? 'BLOCKED'
            : reserved
              ? 'RESERVED'
              : past
                ? 'PAST'
                : 'AVAILABLE';
        return {
          startHour,
          status,
          past,
          available45: status === 'AVAILABLE',
          fits90: startHour <= 21,
        };
      });
      return {
        date,
        slots: slots.map((slot, index) => ({
          ...slot,
          available90:
            slot.fits90 &&
            slot.available45 &&
            slots[index + 1]?.available45 === true,
        })),
      };
    });
    return { roomId, weekStart, timeZone: 'Europe/Warsaw', days };
  }
}
