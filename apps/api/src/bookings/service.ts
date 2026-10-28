import type { UserDto } from '../auth/service.js';
import type { PrismaClient } from '../generated/prisma/client.js';
import { ApiError } from '../http/errors.js';
import {
  BookingRepository,
  RoomRepository,
  TimeBlockRepository,
  UserRepository,
  bookingInclude,
  type BookingRecord,
  type Tx,
} from './repository.js';
import { bookingState, isFuture, validateTerm } from './time.js';
import { bookingInput, positiveId, type BookingInput } from './validation.js';
import { writeTransaction } from './transaction.js';

export function bookingDto(booking: BookingRecord, now: Date) {
  return {
    id: booking.id,
    studentId: booking.studentId,
    room: booking.room,
    date: booking.date,
    startHour: booking.startHour,
    durationSlots: booking.durationSlots,
    lessonMinutes: booking.durationSlots * 45,
    occupiedMinutes: booking.durationSlots * 60,
    status: booking.status,
    state: bookingState(booking, now),
    canCancel:
      booking.status === 'ACTIVE' &&
      isFuture(booking.date, booking.startHour, now),
    createdAt: booking.createdAt,
    createdBy: booking.createdBy,
    cancelledAt: booking.cancelledAt,
    cancelledByUserId: booking.cancelledByUserId,
    cancelReason: booking.cancelReason,
  };
}

async function currentActor(actor: UserDto, tx: Tx, studentOnly = false) {
  const current = await UserRepository.findById(actor.id, tx);
  if (
    !current ||
    current.role !== actor.role ||
    !['STUDENT', 'ADMIN'].includes(current.role) ||
    (studentOnly && current.role !== 'STUDENT')
  )
    throw new ApiError(403, 'FORBIDDEN', 'Brak uprawnień do operacji.');
  return current;
}

export class BookingService {
  constructor(
    private readonly db: PrismaClient,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async createBooking(actor: UserDto, input: BookingInput) {
    // Weryfikacja też dla wywołań usługi poza HTTP.
    bookingInput(input, actor.role);
    return writeTransaction(this.db, async (tx) => {
      await currentActor(actor, tx);
      const data = bookingInput(input, actor.role);
      const studentId = actor.role === 'STUDENT' ? actor.id : data.studentId!;
      const student = await UserRepository.findById(studentId, tx);
      if (!student)
        throw new ApiError(
          404,
          'STUDENT_NOT_FOUND',
          'Nie znaleziono studenta.',
        );
      if (student.role !== 'STUDENT')
        throw new ApiError(
          422,
          'INVALID_STUDENT',
          'Właścicielem musi być student.',
        );
      const room = await RoomRepository.findById(data.roomId, tx);
      if (!room)
        throw new ApiError(404, 'ROOM_NOT_FOUND', 'Nie znaleziono sali.');
      if (!room.isActive)
        throw new ApiError(409, 'ROOM_INACTIVE', 'Sala jest nieaktywna.');
      let now = this.now();
      validateTerm(data, now, actor.role === 'STUDENT');
      if (
        actor.role === 'STUDENT' &&
        (await BookingRepository.countFutureActive(studentId, now, tx)) >= 3
      )
        throw new ApiError(
          422,
          'BOOKING_LIMIT',
          'Osiągnięto limit trzech przyszłych rezerwacji.',
        );
      if (
        (
          await BookingRepository.findOverlapping(
            data.roomId,
            studentId,
            data.date,
            data.startHour,
            data.durationSlots,
            tx,
          )
        ).length ||
        (
          await TimeBlockRepository.findOverlapping(
            data.roomId,
            data.date,
            data.startHour,
            data.durationSlots,
            tx,
          )
        ).length
      )
        throw new ApiError(
          409,
          'SLOT_CONFLICT',
          'Termin koliduje z rezerwacją lub blokadą.',
        );
      now = this.now();
      validateTerm(data, now, actor.role === 'STUDENT');
      const booking = await BookingRepository.insert(
        {
          roomId: data.roomId,
          studentId,
          createdByUserId: actor.id,
          date: data.date,
          startHour: data.startHour,
          durationSlots: data.durationSlots,
          status: 'ACTIVE',
          createdAt: now,
        },
        tx,
      );
      // Jeżeli czas przekroczył początek podczas INSERT, wycofaj cały zapis.
      validateTerm(data, this.now(), actor.role === 'STUDENT');
      return bookingDto(booking, now);
    });
  }

  async cancelBooking(actor: UserDto, bookingId: number) {
    positiveId(bookingId);
    return writeTransaction(this.db, async (tx) => {
      await currentActor(actor, tx, true);
      const booking = await BookingRepository.findById(bookingId, tx);
      if (!booking || booking.studentId !== actor.id)
        throw new ApiError(
          404,
          'BOOKING_NOT_FOUND',
          'Nie znaleziono rezerwacji.',
        );
      if (booking.status === 'CANCELLED')
        throw new ApiError(
          409,
          'ALREADY_CANCELLED',
          'Rezerwacja jest już anulowana.',
        );
      const now = this.now();
      if (!isFuture(booking.date, booking.startHour, now))
        throw new ApiError(
          422,
          'NOT_FUTURE',
          'Można anulować tylko przyszłą rezerwację.',
        );
      if (
        (await BookingRepository.cancelMany(
          [bookingId],
          actor.id,
          'STUDENT_CANCELLED',
          now,
          tx,
        )) !== 1
      )
        throw new ApiError(
          409,
          'WRITE_CONFLICT',
          'Rezerwacja została zmieniona.',
        );
      if (!isFuture(booking.date, booking.startHour, this.now()))
        throw new ApiError(422, 'NOT_FUTURE', 'Rezerwacja już się rozpoczęła.');
      return bookingDto(
        {
          ...booking,
          status: 'CANCELLED',
          cancelledAt: now,
          cancelledByUserId: actor.id,
          cancelReason: 'STUDENT_CANCELLED',
        },
        now,
      );
    });
  }

  async mine(actor: UserDto) {
    if (actor.role !== 'STUDENT')
      throw new ApiError(403, 'FORBIDDEN', 'Wymagana rola studenta.');
    const bookings = await this.db.booking.findMany({
      where: { studentId: actor.id },
      orderBy: [{ date: 'asc' }, { startHour: 'asc' }, { id: 'asc' }],
      include: bookingInclude,
    });
    const now = this.now();
    return bookings.map((booking) => bookingDto(booking, now));
  }
}
