import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
import { createDatabase } from '../db/client.js';
import { testDatabase } from '../testing/database.js';
import { createSessionToken, SESSION_COOKIE } from '../auth/session.js';
import { addDays, calendarDate, localNow } from './time.js';

describe('Rezerwacje API na migrowanym pliku SQLite', () => {
  let fixture: Awaited<ReturnType<typeof testDatabase>>;
  let second: Awaited<ReturnType<typeof createDatabase>>;
  let app: Awaited<ReturnType<typeof createApp>>['app'];
  let otherApp: typeof app;
  let date: string;
  const cookie = (id = 2) =>
    `${SESSION_COOKIE}=${createSessionToken(id, fixture.secret)}`;
  const payload = (extra = {}) => ({
    roomId: 1,
    date,
    startHour: 7,
    durationSlots: 1,
    ...extra,
  });
  const post = (extra = {}, user = 2, target = app) =>
    request(target)
      .post('/api/bookings')
      .set('Cookie', cookie(user))
      .send(payload(extra));
  const cancel = (id: number | string, user = 2, target = app) =>
    request(target)
      .post(`/api/bookings/${id}/cancel`)
      .set('Cookie', cookie(user))
      .send({});
  const record = (extra = {}) =>
    fixture.db.booking.create({
      data: { studentId: 2, createdByUserId: 2, ...payload(extra) },
    });
  const monday = () => {
    const day = calendarDate(date).getUTCDay();
    return addDays(date, 1 - day);
  };
  const availability = (user = 2, roomId = 1) =>
    request(app)
      .get('/api/availability')
      .query({ roomId, weekStart: monday() })
      .set('Cookie', cookie(user));

  beforeAll(async () => {
    fixture = await testDatabase();
    second = await createDatabase(fixture.databaseUrl);
    const options = {
      session: { secret: fixture.secret, secure: false },
      allowedOrigins: ['http://127.0.0.1:5173'],
    };
    app = (await createApp({ ...options, db: fixture.db })).app;
    otherApp = (await createApp({ ...options, db: second })).app;
    date = addDays(localNow(new Date()).date, 1);
    while ([0, 6].includes(calendarDate(date).getUTCDay()))
      date = addDays(date, 1);
  });
  beforeEach(async () => {
    await fixture.db.booking.deleteMany();
    await fixture.db.timeBlock.deleteMany();
    await fixture.db.room.updateMany({ data: { isActive: true } });
  });
  afterAll(async () => {
    await second?.$disconnect();
    await fixture?.close();
  });

  it('TC-05: 45 minut od 07 zajmuje jeden slot; zapisuje ACTIVE i prawdziwe ID', async () => {
    const response = await post().expect(201);
    expect(response.body).toMatchObject({
      studentId: 2,
      status: 'ACTIVE',
      state: 'UPCOMING',
      lessonMinutes: 45,
      occupiedMinutes: 60,
      canCancel: true,
      createdBy: { id: 2 },
    });
    expect(
      await fixture.db.booking.findUnique({ where: { id: response.body.id } }),
    ).toMatchObject({
      studentId: 2,
      createdByUserId: 2,
      status: 'ACTIVE',
      date,
      startHour: 7,
      durationSlots: 1,
      cancelledAt: null,
    });
    const preview = await availability().expect(200);
    const slots = preview.body.days.find(
      (day: { date: string }) => day.date === date,
    ).slots;
    expect(slots[0].status).toBe('RESERVED');
    expect(slots[1].status).toBe('AVAILABLE');
    await post({}, 3).expect(409);
    await post({ startHour: 8 }).expect(201);
  });

  it('TC-06: pełne 120 minut, sąsiedztwo 09 i ostatnie starty 21/22', async () => {
    await post({ durationSlots: 2 }).expect(201);
    await post({ startHour: 8 }, 3).expect(409);
    await post({ startHour: 9 }, 3).expect(201);
    const slots = (await availability()).body.days.find(
      (day: { date: string }) => day.date === date,
    ).slots;
    expect(
      slots.slice(0, 3).map((slot: { status: string }) => slot.status),
    ).toEqual(['RESERVED', 'RESERVED', 'RESERVED']);
    await post({ startHour: 21, durationSlots: 2 }, 4).expect(201);
    await post({ roomId: 2, startHour: 22, durationSlots: 2 }, 5).expect(422);
    await post({ roomId: 2, startHour: 22 }, 5).expect(201);
  });

  it('TC-07: limit obejmuje wpisy admina, wyklucza historyczne i anulowane', async () => {
    await record({ date: addDays(date, -30) });
    await record({
      startHour: 8,
      status: 'CANCELLED',
      cancelledAt: new Date(),
      cancelledByUserId: 2,
      cancelReason: 'STUDENT_CANCELLED',
    });
    await post().expect(201);
    await post({ startHour: 9 }).expect(201);
    await post({ startHour: 10, studentId: 2 }, 1).expect(201);
    const response = await post({ startHour: 11 }).expect(422);
    expect(response.body.error.code).toBe('BOOKING_LIMIT');
    expect(
      await fixture.db.booking.count({ where: { status: 'ACTIVE', date } }),
    ).toBe(3);
  });

  it('TC-09: admin omija limit i horyzont, zachowuje autora i nie omija konfliktów', async () => {
    for (const startHour of [7, 8, 9]) await record({ startHour });
    const far = addDays(date, 70);
    const response = await post({ date: far, studentId: 2 }, 1).expect(201);
    expect(response.body).toMatchObject({
      studentId: 2,
      createdBy: { id: 1, role: 'ADMIN' },
    });
    expect(
      await fixture.db.booking.findUnique({ where: { id: response.body.id } }),
    ).toMatchObject({ studentId: 2, createdByUserId: 1 });
    await post({ date: far, roomId: 2, studentId: 2 }, 1).expect(409);
    await post({ studentId: 1 }, 1).expect(422);
    await post({ studentId: 999999 }, 1).expect(404);
    await post({ roomId: 999999, studentId: 3 }, 1).expect(404);
    await post({}, 1).expect(422);
  });

  it('TC-10: sala LUB student, niezależne sale, nieaktywność i CANCELLED', async () => {
    const first = await post({ durationSlots: 2 }).expect(201);
    await post({ roomId: 2, startHour: 8 }).expect(409);
    await post({ startHour: 8 }, 3).expect(409);
    await post({ roomId: 2, startHour: 8 }, 3).expect(201);
    await fixture.db.room.update({
      where: { id: 3 },
      data: { isActive: false },
    });
    await post({ roomId: 3 }, 4).expect(409);
    await cancel(first.body.id).expect(200);
    await post({ durationSlots: 2 }, 4).expect(201);
  });

  it.each([1, 2])(
    'TC-12: istniejąca blokada %i-slotowa i wolne sąsiedztwo',
    async (durationSlots) => {
      await fixture.db.timeBlock.create({
        data: {
          roomId: 1,
          date,
          startHour: 8,
          durationSlots,
          createdByUserId: 1,
        },
      });
      await post({ durationSlots: 2 }).expect(409);
      await post({ startHour: 8 }).expect(409);
      await post({ startHour: 7 }).expect(201);
      await post({ startHour: 8 + durationSlots }).expect(201);
      const preview = await availability().expect(200);
      const slots = preview.body.days.find(
        (day: { date: string }) => day.date === date,
      ).slots;
      expect(slots[1].status).toBe('BLOCKED');
      expect(slots[1].available90).toBe(false);
    },
  );

  it('TC-13: własna historia, wpisy admina, porządek i brak obcych danych', async () => {
    await record({ studentId: 3, createdByUserId: 3, roomId: 2 });
    await record({ createdByUserId: 1, startHour: 10 });
    await record({
      startHour: 7,
      status: 'CANCELLED',
      cancelledAt: new Date(),
      cancelledByUserId: 2,
      cancelReason: 'STUDENT_CANCELLED',
    });
    await record({ date: addDays(date, -30), startHour: 9 });
    const response = await request(app)
      .get('/api/bookings/mine')
      .set('Cookie', cookie())
      .expect(200);
    expect(response.body).toHaveLength(3);
    expect(
      response.body.map((row: { studentId: number }) => row.studentId),
    ).toEqual([2, 2, 2]);
    expect(response.body.map((row: { state: string }) => row.state)).toEqual([
      'COMPLETED',
      'CANCELLED',
      'UPCOMING',
    ]);
    expect(response.body[2].createdBy.id).toBe(1);
    expect(response.body[1]).toMatchObject({
      cancelledByUserId: 2,
      cancelReason: 'STUDENT_CANCELLED',
      canCancel: false,
    });
    expect(JSON.stringify(response.body)).not.toMatch(
      /email|password|secret/iu,
    );
    await request(app)
      .get('/api/bookings/mine?studentId=3')
      .set('Cookie', cookie())
      .expect(422);
    await request(app)
      .get('/api/bookings/mine')
      .set('Cookie', cookie(1))
      .expect(403);
  });

  it('TC-14: anulowanie zapisuje historię, zwalnia termin i ukrywa cudze ID', async () => {
    const booking = await post().expect(201);
    const foreign = await cancel(booking.body.id, 3).expect(404);
    const missing = await cancel(999999, 3).expect(404);
    expect(foreign.body).toEqual(missing.body);
    await cancel(booking.body.id, 1).expect(403);
    const cancelled = await cancel(booking.body.id).expect(200);
    expect(cancelled.body).toMatchObject({
      status: 'CANCELLED',
      state: 'CANCELLED',
      cancelReason: 'STUDENT_CANCELLED',
      cancelledByUserId: 2,
      canCancel: false,
    });
    const saved = await fixture.db.booking.findUniqueOrThrow({
      where: { id: booking.body.id },
    });
    expect(saved.cancelledAt).toBeInstanceOf(Date);
    expect(saved).toMatchObject({
      status: 'CANCELLED',
      cancelledByUserId: 2,
      cancelReason: 'STUDENT_CANCELLED',
    });
    await cancel(booking.body.id).expect(409);
    expect(
      await fixture.db.booking.findUnique({ where: { id: saved.id } }),
    ).toEqual(saved);
    await post({}, 3).expect(201);
    const historical = await record({ date: addDays(date, -30) });
    await cancel(historical.id).expect(422);
    expect(
      await fixture.db.booking.findUnique({ where: { id: historical.id } }),
    ).toEqual(historical);
  });

  it('WF-02/03: role sal, 5×16, dwa wolne sloty, zakres odczytu i prywatność', async () => {
    await fixture.db.room.update({
      where: { id: 8 },
      data: { isActive: false },
    });
    const student = await request(app)
      .get('/api/rooms')
      .set('Cookie', cookie())
      .expect(200);
    const admin = await request(app)
      .get('/api/rooms')
      .set('Cookie', cookie(1))
      .expect(200);
    expect(student.body).toHaveLength(7);
    expect(admin.body).toHaveLength(8);
    expect(student.body[0]).not.toHaveProperty('isActive');
    expect(admin.body[7].isActive).toBe(false);
    expect(
      student.body.map((row: { roomNumber: string }) => row.roomNumber),
    ).toEqual(
      [
        ...student.body.map((row: { roomNumber: string }) => row.roomNumber),
      ].sort(),
    );
    await availability(2, 8).expect(404);
    const inactive = await availability(1, 8).expect(200);
    expect(inactive.body.days[0].slots[0].status).toBe('INACTIVE');
    await record({ startHour: 8 });
    const preview = await availability().expect(200);
    expect(preview.body.days).toHaveLength(5);
    for (const day of preview.body.days) {
      expect(day.slots).toHaveLength(16);
      expect(
        day.slots.map((slot: { startHour: number }) => slot.startHour),
      ).toEqual(Array.from({ length: 16 }, (_, i) => i + 7));
      expect(day.slots[15]).toMatchObject({
        fits90: false,
        available90: false,
      });
    }
    const slots = preview.body.days.find(
      (day: { date: string }) => day.date === date,
    ).slots;
    expect(slots[0]).toMatchObject({ available45: true, available90: false });
    expect(slots[2].available90).toBe(true);
    expect(JSON.stringify(preview.body)).not.toMatch(
      /student|createdBy|displayName|email|password/iu,
    );
    for (const offset of [-70, 70])
      await request(app)
        .get('/api/availability')
        .query({ roomId: 1, weekStart: addDays(monday(), offset) })
        .set('Cookie', cookie())
        .expect(200);
    const past = await request(app)
      .get('/api/availability')
      .query({ roomId: 1, weekStart: addDays(monday(), -70) })
      .set('Cookie', cookie())
      .expect(200);
    expect(past.body.days[0].slots[0]).toMatchObject({
      status: 'PAST',
      available45: false,
    });
  });

  it('WF-15: sesja, rola, Origin, Content-Type, duże/uszkodzone JSON', async () => {
    for (const endpoint of [
      '/api/rooms',
      '/api/availability',
      '/api/bookings/mine',
    ])
      await request(app).get(endpoint).expect(401);
    await request(app).post('/api/bookings').send(payload()).expect(401);
    await request(app).post('/api/bookings/1/cancel').send({}).expect(401);
    for (const endpoint of ['/api/bookings', '/api/bookings/1/cancel']) {
      await request(app)
        .post(endpoint)
        .set('Cookie', cookie())
        .set('Origin', 'https://evil.test')
        .send({})
        .expect(403);
      await request(app)
        .post(endpoint)
        .set('Cookie', cookie())
        .set('Sec-Fetch-Site', 'cross-site')
        .send({})
        .expect(403);
      await request(app)
        .post(endpoint)
        .set('Cookie', cookie())
        .type('form')
        .send({})
        .expect(400);
      await request(app)
        .post(endpoint)
        .set('Cookie', cookie())
        .set('Content-Type', 'application/json')
        .send('{')
        .expect(400);
      await request(app)
        .post(endpoint)
        .set('Cookie', cookie())
        .send({ junk: 'x'.repeat(5000) })
        .expect(400);
    }
    await post({ studentId: 2 }).expect(403);
    await post({ studentId: 3 }).expect(403);
    await request(app)
      .post('/api/bookings/1/cancel')
      .set('Cookie', cookie())
      .send({ cancelReason: 'ADMIN_CANCELLED' })
      .expect(422);
    await request(app)
      .get('/api/bookings/1')
      .set('Cookie', cookie())
      .expect(404);
    await request(app)
      .get('/api/admin/bookings')
      .set('Cookie', cookie())
      .expect(404);
    expect(await fixture.db.booking.count()).toBe(0);
  });

  it.each([
    { roomId: 0 },
    { roomId: -1 },
    { roomId: 1.5 },
    { roomId: '1' },
    { roomId: 2 ** 40 },
    { startHour: 6 },
    { startHour: 23 },
    { startHour: 7.5 },
    { startHour: '7' },
    { durationSlots: 0 },
    { durationSlots: 3 },
    { durationSlots: 1.5 },
    { durationSlots: '1' },
    { date: '2026-02-30' },
    { date: '2026-2-02' },
    { date: '2026-01-01T07:00:00Z' },
    { date: '0000-01-01' },
    { createdByUserId: 1 },
    { status: 'ACTIVE' },
    { cancelledAt: null },
    { cancelReason: 'X' },
    { foo: 'bar' },
  ])('walidacja granic payloadu: %j', async (extra) => {
    const response = await post(extra).expect(422);
    expect(response.body).toEqual({
      error: { code: 'INVALID_INPUT', message: expect.any(String) },
    });
    expect(await fixture.db.booking.count()).toBe(0);
  });

  it('odrzuca brakujące pola, tablice, puste body i błędne parametry', async () => {
    for (const key of ['roomId', 'date', 'startHour', 'durationSlots']) {
      const body: Record<string, unknown> = payload();
      delete body[key];
      await request(app)
        .post('/api/bookings')
        .set('Cookie', cookie())
        .send(body)
        .expect(422);
    }
    await request(app)
      .post('/api/bookings')
      .set('Cookie', cookie())
      .send([])
      .expect(422);
    for (const id of ['0', '-1', '1.5', 'abc', '2147483648', '01'])
      await cancel(id).expect(422);
    for (const query of [
      { roomId: '0', weekStart: monday() },
      { roomId: '1.5', weekStart: monday() },
      { roomId: '1', weekStart: addDays(monday(), 1) },
      { roomId: '1', weekStart: '2026-02-30' },
      { roomId: ['1', '2'], weekStart: monday() },
    ])
      await request(app)
        .get('/api/availability')
        .query(query)
        .set('Cookie', cookie())
        .expect(422);
  });

  it.each(['sala', 'student', 'limit', 'anulowanie'])(
    'TC-11: równoległe HTTP, osobne klienty SQLite: %s',
    async (scenario) => {
      for (let iteration = 0; iteration < 3; iteration++) {
        await fixture.db.booking.deleteMany();
        let responses;
        if (scenario === 'anulowanie') {
          const booking = await record();
          responses = await Promise.all([
            cancel(booking.id),
            cancel(booking.id, 2, otherApp),
          ]);
          expect(responses.map((row) => row.status).sort()).toEqual([200, 409]);
          const rows = await fixture.db.booking.findMany();
          expect(rows).toHaveLength(1);
          expect(rows[0]).toMatchObject({
            status: 'CANCELLED',
            cancelReason: 'STUDENT_CANCELLED',
            cancelledByUserId: 2,
          });
          continue;
        }
        if (scenario === 'limit') {
          await record({ startHour: 10 });
          await record({ startHour: 11 });
          responses = await Promise.all([
            post({ startHour: 12 }),
            post({ startHour: 13 }, 2, otherApp),
          ]);
        } else {
          responses = await Promise.all([
            post({ durationSlots: 2 }),
            post(
              { roomId: scenario === 'student' ? 2 : 1, startHour: 8 },
              scenario === 'student' ? 2 : 3,
              otherApp,
            ),
          ]);
        }
        expect(responses.filter((row) => row.status === 201)).toHaveLength(1);
        expect(
          responses.every((row) => [201, 409, 422].includes(row.status)),
        ).toBe(true);
        expect(
          await fixture.db.booking.count({ where: { status: 'ACTIVE' } }),
        ).toBe(scenario === 'limit' ? 3 : 1);
      }
    },
  );

  it('TC-11: równoległe żądania na jednym kliencie adaptera także zachowują integralność', async () => {
    const responses = await Promise.all([
      post({ durationSlots: 2 }),
      post({ startHour: 8 }, 3),
    ]);
    expect(responses.map((row) => row.status).sort()).toEqual([201, 409]);
    expect(
      await fixture.db.booking.count({ where: { status: 'ACTIVE' } }),
    ).toBe(1);
  });
});
