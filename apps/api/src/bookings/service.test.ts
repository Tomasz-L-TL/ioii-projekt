import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { testDatabase } from '../testing/database.js';
import { createDatabase } from '../db/client.js';
import { createApp } from '../app.js';
import { createSessionToken, SESSION_COOKIE } from '../auth/session.js';
import type { UserDto } from '../auth/service.js';
import { BookingService } from './service.js';
import { BookingReads } from './reads.js';
import { addDays, localNow } from './time.js';
import { isWriteContention, writeTransaction } from './transaction.js';

describe('Transakcyjne reguły przy wstrzykiwanym zegarze i prawdziwej SQLite', () => {
  let fixture: Awaited<ReturnType<typeof testDatabase>>;
  let second: Awaited<ReturnType<typeof createDatabase>>;
  const instant = new Date(Date.UTC(2026, 2, 16, 5)); // poniedziałek 06:00 w Warszawie
  const today = localNow(instant).date;
  let now: Date;
  let service: BookingService;
  const student: UserDto = {
    id: 2,
    role: 'STUDENT',
    email: '',
    displayName: '',
  };
  const admin: UserDto = { ...student, id: 1, role: 'ADMIN' };
  const input = (extra = {}) => ({
    roomId: 1,
    date: today,
    startHour: 7,
    durationSlots: 1,
    ...extra,
  });
  const record = (extra = {}) =>
    fixture.db.booking.create({
      data: { ...input(extra), studentId: 2, createdByUserId: 2 },
    });
  beforeAll(async () => {
    fixture = await testDatabase();
    second = await createDatabase(fixture.databaseUrl);
  });
  beforeEach(async () => {
    now = new Date(instant);
    service = new BookingService(fixture.db, () => new Date(now));
    await fixture.db.booking.deleteMany();
    await fixture.db.room.updateMany({ data: { isActive: true } });
  });
  afterAll(async () => {
    await second?.$disconnect();
    await fixture?.close();
  });

  it('TC-08: dziś, +14 włącznie, +15, weekend i przeszłość przy zapisie do DB', async () => {
    await service.createBooking(student, input());
    await service.createBooking(student, input({ date: addDays(today, 14) }));
    await expect(
      service.createBooking(student, input({ date: addDays(today, 15) })),
    ).rejects.toMatchObject({ status: 422, code: 'HORIZON_EXCEEDED' });
    for (const offset of [5, 6])
      await expect(
        service.createBooking(
          admin,
          input({ date: addDays(today, offset), studentId: 3 }),
        ),
      ).rejects.toMatchObject({ status: 422, code: 'WEEKEND' });
    await expect(
      service.createBooking(
        admin,
        input({ date: addDays(today, -7), studentId: 3 }),
      ),
    ).rejects.toMatchObject({ status: 422, code: 'NOT_FUTURE' });
    expect(await fixture.db.booking.count()).toBe(2);
  });

  it('TC-08/14: dokładny początek i zakończona rezerwacja nie mogą być anulowane', async () => {
    const booking = await record();
    now = new Date(instant.getTime() + 60 * 60000);
    await expect(
      service.createBooking(student, input({ roomId: 2 })),
    ).rejects.toMatchObject({ status: 422, code: 'NOT_FUTURE' });
    await expect(
      service.cancelBooking(student, booking.id),
    ).rejects.toMatchObject({ status: 422, code: 'NOT_FUTURE' });
    now = new Date(now.getTime() + 2 * 60 * 60000);
    await expect(
      service.cancelBooking(student, booking.id),
    ).rejects.toMatchObject({ status: 422 });
    expect(
      await fixture.db.booking.findUnique({ where: { id: booking.id } }),
    ).toEqual(booking);
  });

  it('TC-07: rozpoczęta ACTIVE nie wchodzi do limitu, nawet w buforze', async () => {
    await record();
    await record({ startHour: 8 });
    await record({ startHour: 9 });
    now = new Date(instant.getTime() + 60 * 60000);
    await service.createBooking(student, input({ startHour: 10 }));
    await expect(
      service.createBooking(student, input({ startHour: 11 })),
    ).rejects.toMatchObject({ code: 'BOOKING_LIMIT' });
  });

  it('TC-13: lista wylicza STARTED i COMPLETED z zegara, bez zmiany ACTIVE', async () => {
    await record();
    now = new Date(instant.getTime() + 60 * 60000);
    expect((await service.mine(student))[0]).toMatchObject({
      state: 'STARTED',
      status: 'ACTIVE',
      canCancel: false,
    });
    now = new Date(now.getTime() + 45 * 60000);
    expect((await service.mine(student))[0]).toMatchObject({
      state: 'COMPLETED',
      status: 'ACTIVE',
    });
  });

  it('WF-03: kalendarz przy ścisłym początku jest PAST; bufor pozostaje RESERVED', async () => {
    now = new Date(instant.getTime() + 60 * 60000);
    const reads = new BookingReads(fixture.db, () => now);
    const preview = await reads.availability(student, 1, today);
    expect(preview.days[0]!.slots[0]).toMatchObject({
      status: 'PAST',
      available45: false,
    });
    await record();
    now = new Date(now.getTime() + 45 * 60000);
    const busy = await reads.availability(student, 1, today);
    expect(busy.days[0]!.slots[0]).toMatchObject({
      status: 'RESERVED',
      past: true,
      available45: false,
    });
  });

  it('odczytuje aktualną rolę inicjatora i właściciela w transakcji', async () => {
    await fixture.db.user.update({ where: { id: 2 }, data: { role: 'ADMIN' } });
    try {
      await expect(
        service.createBooking(student, input()),
      ).rejects.toMatchObject({ status: 403 });
      await expect(
        service.createBooking(admin, input({ studentId: 2 })),
      ).rejects.toMatchObject({ status: 422, code: 'INVALID_STUDENT' });
      await expect(service.cancelBooking(student, 1)).rejects.toMatchObject({
        status: 403,
      });
    } finally {
      await fixture.db.user.update({
        where: { id: 2 },
        data: { role: 'STUDENT' },
      });
    }
    expect(await fixture.db.booking.count()).toBe(0);
  });

  it('czas sprawdzany ponownie przy INSERT; przekroczenie początku wycofuje wpis', async () => {
    let calls = 0;
    const crossing = new BookingService(fixture.db, () =>
      ++calls < 3 ? instant : new Date(instant.getTime() + 60 * 60000),
    );
    await expect(
      crossing.createBooking(student, input()),
    ).rejects.toMatchObject({ code: 'NOT_FUTURE' });
    expect(await fixture.db.booking.count()).toBe(0);
  });

  it('czas sprawdzany ponownie przy UPDATE; przekroczenie początku wycofuje anulowanie', async () => {
    const booking = await record();
    let calls = 0;
    const crossing = new BookingService(fixture.db, () =>
      ++calls === 1 ? instant : new Date(instant.getTime() + 60 * 60000),
    );
    await expect(
      crossing.cancelBooking(student, booking.id),
    ).rejects.toMatchObject({ code: 'NOT_FUTURE' });
    expect(
      await fixture.db.booking.findUnique({ where: { id: booking.id } }),
    ).toEqual(booking);
  });

  it('TC-11: UPDATE bez wierszy rzeczywiście blokuje drugi klient przed regułami; HTTP 409', async () => {
    const app = (
      await createApp({
        db: second,
        session: { secret: fixture.secret, secure: false },
        allowedOrigins: [],
      })
    ).app;
    const cookie = `${SESSION_COOKIE}=${createSessionToken(2, fixture.secret)}`;
    await writeTransaction(fixture.db, async () => {
      // Brak zmian rekordów. Gdyby blokada nie działała, poniższy zapis odniósłby sukces.
      const response = await request(app)
        .post('/api/bookings')
        .set('Cookie', cookie)
        .send(input({ date: addDays(localNow(new Date()).date, 7) }));
      expect(response.status).toBe(409);
      expect(response.body.error.code).toBe('WRITE_CONFLICT');
    });
    expect(await fixture.db.booking.count()).toBe(0);
    await service.createBooking(student, input());
    expect(await second.booking.count()).toBe(1);
  });

  it('nie mapuje błędów SQL/programistycznych na 409; HTTP 500 bez wycieku', async () => {
    const app = (
      await createApp({
        db: second,
        session: { secret: fixture.secret, secure: false },
        allowedOrigins: [],
      })
    ).app;
    const cookie = `${SESSION_COOKIE}=${createSessionToken(2, fixture.secret)}`;
    await fixture.db.$executeRawUnsafe(
      "CREATE TRIGGER test_insert_fault AFTER INSERT ON bookings BEGIN SELECT RAISE(ABORT, 'test fault'); END",
    );
    try {
      let date = addDays(localNow(new Date()).date, 1);
      // Wybierz kolejny poniedziałek niezależnie od dnia uruchomienia.
      while (new Date(`${date}T00:00:00Z`).getUTCDay() !== 1)
        date = addDays(date, 1);
      const response = await request(app)
        .post('/api/bookings')
        .set('Cookie', cookie)
        .send(input({ date }));
      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        error: { code: 'INTERNAL_ERROR', message: 'Wewnętrzny błąd serwera.' },
      });
      expect(await fixture.db.booking.count()).toBe(0);
    } finally {
      await fixture.db.$executeRawUnsafe('DROP TRIGGER test_insert_fault');
    }
    expect(isWriteContention(new Error('SQL error'))).toBe(false);
    expect(
      isWriteContention({ code: 'P2028', message: 'programming error' }),
    ).toBe(false);
    expect(
      isWriteContention({
        code: 'P2028',
        meta: { error: 'Unable to start a transaction in the given time.' },
      }),
    ).toBe(true);
    expect(
      isWriteContention({
        code: 'P2028',
        meta: {
          error:
            'A commit cannot be executed on an expired transaction. The timeout for this transaction was 5000 ms, however 5001 ms passed since the start of the transaction.',
        },
      }),
    ).toBe(true);
  });
});
