import type { UserDto } from '../auth/service.js';
import { Prisma, type PrismaClient } from '../generated/prisma/client.js';
import { ApiError } from '../http/errors.js';
import { bookingDto } from '../bookings/service.js';
import {
  BookingRepository,
  bookingInclude,
  futureActiveWhere,
  TimeBlockRepository,
  type Tx,
} from '../bookings/repository.js';
import { isFuture, overlaps, validateTerm } from '../bookings/time.js';
import { positiveId } from '../bookings/validation.js';
import { writeTransaction } from '../bookings/transaction.js';
import { ImpactConfirmation, stale } from './confirmation.js';
import {
  blockInput,
  confirmation,
  roomInput,
  roomPatch,
  type BlockInput,
  type Confirmation,
} from './validation.js';

const personSelect = { id: true, displayName: true, role: true } as const;
const roomSelect = {
  id: true,
  roomNumber: true,
  capacity: true,
  name: true,
  description: true,
  isActive: true,
} as const;
const blockSelect = {
  id: true,
  roomId: true,
  date: true,
  startHour: true,
  durationSlots: true,
  reason: true,
  createdAt: true,
  createdBy: { select: personSelect },
  room: { select: roomSelect },
} as const;
type Affected = {
  id: number;
  date: string;
  startHour: number;
  durationSlots: number;
};

async function requireAdmin(actor: UserDto, tx: Tx) {
  const current = await tx.user.findUnique({
    where: { id: actor.id },
    select: { role: true },
  });
  if (actor.role !== 'ADMIN' || current?.role !== 'ADMIN')
    throw new ApiError(403, 'FORBIDDEN', 'Wymagana rola administratora.');
}

async function roomById(id: number, tx: Tx, active = false) {
  const room = await tx.room.findUnique({ where: { id }, select: roomSelect });
  if (!room) throw new ApiError(404, 'ROOM_NOT_FOUND', 'Nie znaleziono sali.');
  if (active && !room.isActive)
    throw new ApiError(409, 'ROOM_INACTIVE', 'Sala jest nieaktywna.');
  return room;
}

async function affected(
  roomId: number,
  now: Date,
  tx: Tx,
  window?: BlockInput,
) {
  const rows = await tx.booking.findMany({
    where: {
      roomId,
      ...futureActiveWhere(now),
      ...(window ? { date: window.date } : {}),
    },
    select: { id: true, date: true, startHour: true, durationSlots: true },
    orderBy: { id: 'asc' },
  });
  return window ? rows.filter((row) => overlaps(row, window)) : rows;
}

function context(
  actor: UserDto,
  roomId: number,
  ids: number[],
  window?: BlockInput,
) {
  return {
    adminId: actor.id,
    operation: window ? 'CREATE_BLOCK' : 'DEACTIVATE_ROOM',
    roomId,
    parameters: window ?? { isActive: false },
    expectedCancellationIds: ids,
    cancellationCount: ids.length,
  };
}

function stillFuture(rows: Affected[], now: Date, window?: BlockInput) {
  if (window) validateTerm(window, now, false);
  if (rows.some((row) => !isFuture(row.date, row.startHour, now))) stale();
}

export class AdminService {
  private readonly tokens: ImpactConfirmation;
  constructor(
    private readonly db: PrismaClient,
    secret: Buffer,
    private readonly now: () => Date = () => new Date(),
  ) {
    this.tokens = new ImpactConfirmation(secret);
  }

  // Snapshot podglądu jest tylko odczytem; właściwy zapis zawsze bierze blokadę.
  private read<T>(actor: UserDto, operation: (tx: Tx) => Promise<T>) {
    return this.db.$transaction(async (tx) => {
      await requireAdmin(actor, tx);
      return operation(tx);
    });
  }

  students(actor: UserDto) {
    return this.read(actor, (tx) =>
      tx.user.findMany({
        where: { role: 'STUDENT' },
        orderBy: [{ displayName: 'asc' }, { id: 'asc' }],
        select: { id: true, displayName: true, email: true },
      }),
    );
  }

  bookings(actor: UserDto) {
    return this.read(actor, async (tx) => {
      const rows = await tx.booking.findMany({
        orderBy: [{ date: 'asc' }, { startHour: 'asc' }, { id: 'asc' }],
        include: {
          ...bookingInclude,
          student: { select: personSelect },
          cancelledBy: { select: personSelect },
        },
      });
      const now = this.now();
      return rows.map((row) => ({
        ...bookingDto(row, now),
        student: row.student,
        cancelledBy: row.cancelledBy,
      }));
    });
  }

  blocks(actor: UserDto) {
    return this.read(actor, (tx) =>
      tx.timeBlock.findMany({
        select: blockSelect,
        orderBy: [{ date: 'asc' }, { startHour: 'asc' }, { id: 'asc' }],
      }),
    );
  }

  private async uniqueRoom<T>(operation: () => Promise<T>) {
    try {
      return await operation();
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002' &&
        JSON.stringify(error.meta).includes('room_number')
      )
        throw new ApiError(
          409,
          'ROOM_NUMBER_CONFLICT',
          'Numer sali jest już używany.',
        );
      throw error;
    }
  }

  createRoom(actor: UserDto, body: unknown) {
    const data = roomInput(body);
    return this.uniqueRoom(() =>
      writeTransaction(this.db, async (tx) => {
        await requireAdmin(actor, tx);
        // roomInput gwarantuje kompletność pól tworzenia.
        return tx.room.create({
          data: {
            ...data,
            roomNumber: data.roomNumber!,
            capacity: data.capacity!,
            isActive: true,
          },
          select: roomSelect,
        });
      }),
    );
  }

  patchRoom(actor: UserDto, roomId: number, body: unknown) {
    positiveId(roomId);
    const patch = roomPatch(body);
    return this.uniqueRoom(() =>
      writeTransaction(this.db, async (tx) => {
        await requireAdmin(actor, tx);
        await roomById(roomId, tx, patch.kind === 'deactivate');
        if (patch.kind === 'deactivate') {
          const rows = await this.confirmedRows(
            actor,
            roomId,
            patch.confirmation,
            tx,
          );
          await tx.room.update({
            where: { id: roomId },
            data: { isActive: false },
          });
          await this.cancelAffected(
            actor,
            rows,
            patch.confirmation,
            roomId,
            tx,
          );
          return {
            ...(await roomById(roomId, tx)),
            cancelledCount: rows.length,
          };
        }
        return tx.room.update({
          where: { id: roomId },
          data: patch.kind === 'activate' ? { isActive: true } : patch.data,
          select: roomSelect,
        });
      }),
    );
  }

  previewDeactivation(actor: UserDto, roomId: number) {
    positiveId(roomId);
    return this.read(actor, async (tx) => {
      await roomById(roomId, tx, true);
      return this.preview(actor, roomId, tx);
    });
  }

  private async validateBlock(input: BlockInput, tx: Tx) {
    await roomById(input.roomId, tx);
    validateTerm(input, this.now(), false);
    if (
      (
        await TimeBlockRepository.findOverlapping(
          input.roomId,
          input.date,
          input.startHour,
          input.durationSlots,
          tx,
        )
      ).length
    )
      throw new ApiError(
        409,
        'BLOCK_CONFLICT',
        'Termin koliduje z inną blokadą.',
      );
  }

  previewBlock(actor: UserDto, body: unknown) {
    const input = blockInput(body);
    return this.read(actor, async (tx) => {
      await this.validateBlock(input, tx);
      return this.preview(actor, input.roomId, tx, input);
    });
  }

  private async preview(
    actor: UserDto,
    roomId: number,
    tx: Tx,
    window?: BlockInput,
  ) {
    const now = this.now();
    if (window) validateTerm(window, now, false);
    const rows = await affected(roomId, now, tx, window);
    const ids = rows.map((row) => row.id);
    return {
      roomId,
      cancellationCount: ids.length,
      expectedCancellationIds: ids,
      confirmationToken: this.tokens.issue(
        context(actor, roomId, ids, window),
        now,
      ),
    };
  }

  private async confirmedRows(
    actor: UserDto,
    roomId: number,
    confirm: Confirmation,
    tx: Tx,
    window?: BlockInput,
  ) {
    const now = this.now();
    this.tokens.verify(
      confirm.confirmationToken,
      context(actor, roomId, confirm.expectedCancellationIds, window),
      now,
    );
    const rows = await affected(roomId, now, tx, window);
    if (
      rows.length !== confirm.expectedCancellationIds.length ||
      rows.some((row, i) => row.id !== confirm.expectedCancellationIds[i])
    )
      stale();
    return rows;
  }

  private async cancelAffected(
    actor: UserDto,
    rows: Affected[],
    confirm: Confirmation,
    roomId: number,
    tx: Tx,
    window?: BlockInput,
  ) {
    const now = this.now();
    this.tokens.verify(
      confirm.confirmationToken,
      context(
        actor,
        roomId,
        rows.map((row) => row.id),
        window,
      ),
      now,
    );
    stillFuture(rows, now, window);
    const count = await BookingRepository.cancelMany(
      rows.map((row) => row.id),
      actor.id,
      window ? 'TIME_BLOCKED' : 'ROOM_DEACTIVATED',
      now,
      tx,
      null,
    );
    if (count !== rows.length) stale();
    const after = this.now();
    stillFuture(rows, after, window);
    this.tokens.verify(
      confirm.confirmationToken,
      context(
        actor,
        roomId,
        rows.map((row) => row.id),
        window,
      ),
      after,
    );
  }

  createBlock(actor: UserDto, body: unknown) {
    const input = blockInput(body, true);
    const confirm = confirmation(body as Record<string, unknown>);
    return writeTransaction(this.db, async (tx) => {
      await requireAdmin(actor, tx);
      await this.validateBlock(input, tx);
      const rows = await this.confirmedRows(
        actor,
        input.roomId,
        confirm,
        tx,
        input,
      );
      validateTerm(input, this.now(), false);
      const block = await tx.timeBlock.create({
        data: { ...input, createdByUserId: actor.id, createdAt: this.now() },
        select: blockSelect,
      });
      await this.cancelAffected(actor, rows, confirm, input.roomId, tx, input);
      return { ...block, cancelledCount: rows.length };
    });
  }

  deleteBlock(actor: UserDto, id: number) {
    positiveId(id);
    return writeTransaction(this.db, async (tx) => {
      await requireAdmin(actor, tx);
      if (
        !(await tx.timeBlock.findUnique({
          where: { id },
          select: { id: true },
        }))
      )
        throw new ApiError(404, 'BLOCK_NOT_FOUND', 'Nie znaleziono blokady.');
      const result = await tx.timeBlock.deleteMany({ where: { id } });
      if (result.count !== 1)
        throw new ApiError(409, 'WRITE_CONFLICT', 'Blokada została zmieniona.');
    });
  }
}
