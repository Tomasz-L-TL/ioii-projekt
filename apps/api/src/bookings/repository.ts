import type { Prisma } from '../generated/prisma/client.js';
import { localNow, overlaps } from './time.js';

export type Tx = Prisma.TransactionClient;
export function futureActiveWhere(now: Date) {
  const local = localNow(now);
  return {
    status: 'ACTIVE',
    OR: [
      { date: { gt: local.date } },
      { date: local.date, startHour: { gt: local.hour } },
    ],
  };
}
export const bookingInclude = {
  room: { select: { id: true, roomNumber: true, name: true, capacity: true } },
  createdBy: { select: { id: true, displayName: true, role: true } },
} as const;
export type BookingRecord = Prisma.BookingGetPayload<{
  include: typeof bookingInclude;
}>;

export const UserRepository = {
  findById: (id: number, tx: Tx) =>
    tx.user.findUnique({ where: { id }, select: { id: true, role: true } }),
};
export const RoomRepository = {
  findById: (id: number, tx: Tx) => tx.room.findUnique({ where: { id } }),
};
export const BookingRepository = {
  findById: (id: number, tx: Tx) =>
    tx.booking.findUnique({ where: { id }, include: bookingInclude }),
  countFutureActive(studentId: number, now: Date, tx: Tx) {
    return tx.booking.count({
      where: {
        studentId,
        ...futureActiveWhere(now),
      },
    });
  },
  async findOverlapping(
    roomId: number,
    studentId: number,
    date: string,
    startHour: number,
    durationSlots: number,
    tx: Tx,
  ) {
    const rows = await tx.booking.findMany({
      where: {
        date,
        status: 'ACTIVE',
        OR: [{ roomId }, { studentId }],
        startHour: { lt: startHour + durationSlots },
      },
    });
    return rows.filter((row) => overlaps(row, { startHour, durationSlots }));
  },
  insert: (data: Prisma.BookingUncheckedCreateInput, tx: Tx) =>
    tx.booking.create({ data, include: bookingInclude }),
  cancelMany(
    ids: number[],
    actorId: number,
    reason: string,
    now: Date,
    tx: Tx,
    studentId: number | null = actorId,
  ) {
    return tx.booking
      .updateMany({
        where: {
          id: { in: ids },
          ...(studentId === null ? {} : { studentId }),
          ...futureActiveWhere(now),
        },
        data: {
          status: 'CANCELLED',
          cancelledAt: now,
          cancelledByUserId: actorId,
          cancelReason: reason,
        },
      })
      .then((result) => result.count);
  },
};
export const TimeBlockRepository = {
  async findOverlapping(
    roomId: number,
    date: string,
    startHour: number,
    durationSlots: number,
    tx: Tx,
  ) {
    const rows = await tx.timeBlock.findMany({
      where: { roomId, date, startHour: { lt: startHour + durationSlots } },
    });
    return rows.filter((row) => overlaps(row, { startHour, durationSlots }));
  },
};
