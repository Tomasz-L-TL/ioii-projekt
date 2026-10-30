import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { createDatabase } from '../db/client.js';
import { testDatabase } from '../testing/database.js';
import { createSessionToken, SESSION_COOKIE } from '../auth/session.js';
import type { UserDto } from '../auth/service.js';
import { AdminService } from './service.js';
import { BookingService } from '../bookings/service.js';
import { ImpactConfirmation } from './confirmation.js';

describe('Administracja TC-15…21 — rzeczywiste SQLite i sesje HTTP', () => {
  let fixture: Awaited<ReturnType<typeof testDatabase>>;
  let second: Awaited<ReturnType<typeof createDatabase>>;
  let app: Awaited<ReturnType<typeof createApp>>['app'];
  let otherApp: typeof app;
  const instant = new Date('2026-10-26T05:00:00Z'); // poniedziałek 06:00 Warszawa
  const date = '2026-10-26';
  const admin: UserDto = { id: 1, role: 'ADMIN', email: '', displayName: '' };
  let service: AdminService;
  const cookie = (id = 1) =>
    `${SESSION_COOKIE}=${createSessionToken(id, fixture.secret)}`;
  const http = (
    method: 'get' | 'post' | 'patch' | 'delete',
    path: string,
    user = 1,
    target = app,
  ) => request(target)[method](path).set('Cookie', cookie(user));
  const term = (extra = {}) => ({
    roomId: 1,
    date,
    startHour: 10,
    durationSlots: 1,
    ...extra,
  });
  const record = (extra = {}) =>
    fixture.db.booking.create({
      data: { ...term(), studentId: 2, createdByUserId: 2, ...extra },
    });
  const preview = async (extra = {}) =>
    (
      await http('get', '/api/admin/blocks/preview')
        .query(term(extra))
        .expect(200)
    ).body;
  const roomPreview = async (id = 1) =>
    (
      await http('get', `/api/admin/rooms/${id}/deactivation-preview`).expect(
        200,
      )
    ).body;
  const confirm = (p: {
    expectedCancellationIds: number[];
    confirmationToken: string;
  }) => ({
    confirmed: true,
    expectedCancellationIds: p.expectedCancellationIds,
    confirmationToken: p.confirmationToken,
  });
  const block = (p: Parameters<typeof confirm>[0], extra = {}, target = app) =>
    http('post', '/api/admin/blocks', 1, target).send({
      ...term(extra),
      ...confirm(p),
    });
  const deactivate = (p: Parameters<typeof confirm>[0], target = app) =>
    http('patch', '/api/admin/rooms/1', 1, target).send({
      isActive: false,
      ...confirm(p),
    });
  const cancel = (id: number, user = 1, target = app) =>
    http('post', `/api/bookings/${id}/cancel`, user, target).send({});
  const snapshot = async () => ({
    rooms: await fixture.db.room.findMany({ orderBy: { id: 'asc' } }),
    bookings: await fixture.db.booking.findMany({ orderBy: { id: 'asc' } }),
    blocks: await fixture.db.timeBlock.findMany({ orderBy: { id: 'asc' } }),
  });

  beforeEach(async () => {
    // Każdy przypadek ma własny migrowany plik; fałszujemy wyłącznie Date,
    // zegary timeoutów, adapter SQLite i transakcje pozostają rzeczywiste.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(instant);
    fixture = await testDatabase(false);
    await fixture.db.user.createMany({
      data: [
        {
          id: 1,
          role: 'ADMIN',
          email: 'admin@test.test',
          displayName: 'Admin',
          passwordHash: 'unused-test-hash',
        },
        {
          id: 2,
          role: 'STUDENT',
          email: 'a@test.test',
          displayName: 'Anna',
          passwordHash: 'unused-test-hash',
        },
        {
          id: 3,
          role: 'STUDENT',
          email: 'b@test.test',
          displayName: 'Bartek',
          passwordHash: 'unused-test-hash',
        },
        {
          id: 4,
          role: 'ADMIN',
          email: 'other@test.test',
          displayName: 'Other',
          passwordHash: 'unused-test-hash',
        },
      ],
    });
    await fixture.db.room.createMany({
      data: [
        { id: 1, roomNumber: 'A-1', capacity: 5 },
        { id: 2, roomNumber: 'A-2', capacity: 8 },
      ],
    });
    second = await createDatabase(fixture.databaseUrl);
    const options = {
      session: { secret: fixture.secret, secure: false },
      allowedOrigins: ['http://127.0.0.1:5173'],
    };
    app = (await createApp({ ...options, db: fixture.db })).app;
    otherApp = (await createApp({ ...options, db: second })).app;
    service = new AdminService(fixture.db, fixture.secret, () => instant);
  });
  afterEach(async () => {
    vi.useRealTimers();
    await second?.$disconnect();
    await fixture?.close();
  });

  it('TC-15: anulowanie ADMIN i STUDENT, inicjator, odmowy historycznych bez zapisu', async () => {
    const a = await record();
    await cancel(a.id, 3).expect(404);
    const r = await cancel(a.id).expect(200);
    expect(r.body).toMatchObject({
      status: 'CANCELLED',
      cancelledByUserId: 1,
      cancelReason: 'ADMIN_CANCELLED',
      cancelledAt: instant.toISOString(),
    });
    const saved = await snapshot();
    await cancel(a.id).expect(409);
    expect(await snapshot()).toEqual(saved);
    const own = await record({ startHour: 11 });
    await cancel(own.id, 2).expect(200);
    expect(
      await fixture.db.booking.findUnique({ where: { id: own.id } }),
    ).toMatchObject({
      cancelReason: 'STUDENT_CANCELLED',
      cancelledByUserId: 2,
    });
    for (const hour of [7, 9]) {
      const past = await record({ startHour: hour });
      vi.setSystemTime(new Date('2026-10-26T08:00:00Z')); // 09:00
      await cancel(past.id).expect(422);
      expect(
        await fixture.db.booking.findUnique({ where: { id: past.id } }),
      ).toEqual(past);
    }
  });

  it('TC-16: listy wszystkich rezerwacji i tylko studentów, jawne bezpieczne DTO', async () => {
    const a = await record({
      studentId: 3,
      createdByUserId: 1,
      durationSlots: 2,
    });
    await cancel(a.id);
    await record({ startHour: 7 });
    vi.setSystemTime(new Date('2026-10-26T06:00:00Z')); // 07 STARTED
    const rows = (await http('get', '/api/admin/bookings').expect(200)).body;
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      student: { id: 2 },
      state: 'STARTED',
      room: { id: 1 },
    });
    expect(rows[1]).toMatchObject({
      student: { id: 3, role: 'STUDENT' },
      createdBy: { id: 1, role: 'ADMIN' },
      cancelledBy: { id: 1 },
      lessonMinutes: 90,
      occupiedMinutes: 120,
      status: 'CANCELLED',
      cancelReason: 'ADMIN_CANCELLED',
    });
    const students = (await http('get', '/api/admin/students').expect(200))
      .body;
    expect(students.map((s: { id: number }) => s.id)).toEqual([2, 3]);
    expect(JSON.stringify({ rows, students })).not.toMatch(
      /password|hash|secret|token/iu,
    );
    const mine = (await http('get', '/api/bookings/mine', 2).expect(200)).body;
    expect(mine).toHaveLength(1);
    expect(JSON.stringify(mine)).not.toContain('Bartek');
  });

  it('TC-17: tworzenie/edycja sali, normalizacja, nullable teksty i zachowane FK', async () => {
    const created = await http('post', '/api/admin/rooms')
      .send({
        roomNumber: '  b  201 ',
        capacity: 10,
        name: ' ',
        description: null,
      })
      .expect(201);
    expect(created.body).toMatchObject({
      roomNumber: 'B 201',
      isActive: true,
      name: null,
      description: null,
    });
    await http('post', '/api/admin/rooms')
      .send({ roomNumber: 'b \t201', capacity: 1 })
      .expect(409);
    const a = await record();
    await http('patch', '/api/admin/rooms/1')
      .send({
        roomNumber: ' a  101 ',
        name: ' Nowa ',
        description: '',
        capacity: 12,
      })
      .expect(200);
    const studentRooms = (await http('get', '/api/rooms', 2).expect(200)).body;
    expect(studentRooms.find((r: { id: number }) => r.id === 1)).toMatchObject({
      roomNumber: 'A 101',
      name: 'Nowa',
      capacity: 12,
    });
    expect(
      studentRooms.some((r: { id: number }) => r.id === created.body.id),
    ).toBe(true);
    expect(
      await fixture.db.booking.findUnique({ where: { id: a.id } }),
    ).toEqual(a);
    await http('patch', '/api/admin/rooms/1')
      .send({ roomNumber: 'b 201' })
      .expect(409);
    const before = await snapshot();
    for (const data of [
      {},
      { roomNumber: '' },
      { roomNumber: null },
      { roomNumber: 'x'.repeat(101) },
      { name: 1 },
      { name: 'x'.repeat(201) },
      { capacity: 0 },
      { capacity: -1 },
      { capacity: 1.5 },
      { capacity: '2' },
      { capacity: 2147483648 },
      { isActive: false, capacity: 1 },
      { isActive: true, name: 'x' },
      { isActive: 'true' },
      { description: 'x'.repeat(2001) },
    ]) {
      await http('patch', '/api/admin/rooms/1').send(data).expect(422);
    }
    expect(await snapshot()).toEqual(before);
    await http('post', '/api/admin/rooms')
      .send({ roomNumber: 'X', capacity: 1, isActive: false })
      .expect(422);
    await http('delete', '/api/admin/rooms/1').expect(404);
  });

  it('TC-18: dezaktywacja wszystkich przyszłych, dalekie daty, historia i aktywacja', async () => {
    const upcoming = await record();
    const far = await record({ date: '2027-02-01' });
    const other = await record({ roomId: 2 });
    const started = await record({ startHour: 7 });
    const completed = await record({ date: '2026-10-23' });
    const cancelled = await record({
      status: 'CANCELLED',
      cancelledAt: instant,
      cancelledByUserId: 2,
      cancelReason: 'STUDENT_CANCELLED',
    });
    vi.setSystemTime(new Date('2026-10-26T06:00:00Z'));
    const p = await roomPreview();
    expect(p).toMatchObject({
      roomId: 1,
      cancellationCount: 2,
      expectedCancellationIds: [upcoming.id, far.id],
    });
    await deactivate(p).expect(200);
    expect(
      await fixture.db.room.findUnique({ where: { id: 1 } }),
    ).toMatchObject({ isActive: false });
    for (const id of [upcoming.id, far.id])
      expect(
        await fixture.db.booking.findUnique({ where: { id } }),
      ).toMatchObject({
        status: 'CANCELLED',
        cancelReason: 'ROOM_DEACTIVATED',
        cancelledByUserId: 1,
        cancelledAt: new Date('2026-10-26T06:00:00Z'),
      });
    for (const row of [other, started, completed, cancelled])
      expect(
        await fixture.db.booking.findUnique({ where: { id: row.id } }),
      ).toEqual(row);
    await http('post', '/api/bookings', 3).send(term()).expect(409);
    expect((await http('get', '/api/rooms', 2)).body).toHaveLength(1);
    expect(
      (await http('get', '/api/rooms')).body.find(
        (r: { id: number }) => r.id === 1,
      ),
    ).toMatchObject({ isActive: false });
    const after = await snapshot();
    await deactivate(p).expect(409);
    await http('get', '/api/admin/rooms/1/deactivation-preview').expect(409);
    expect(await snapshot()).toEqual(after);
    await http('patch', '/api/admin/rooms/1')
      .send({ isActive: true })
      .expect(200);
    expect((await snapshot()).bookings).toEqual(after.bookings);
  });

  it.each(['room', 'block'])(
    'jawne potwierdzenie zera i wszystkie pola wymagane: %s',
    async (kind) => {
      const p = kind === 'room' ? await roomPreview() : await preview();
      expect(p.cancellationCount).toBe(0);
      const body =
        kind === 'room'
          ? { isActive: false, ...confirm(p) }
          : { ...term(), ...confirm(p) };
      const send = (data: object) =>
        http(
          kind === 'room' ? 'patch' : 'post',
          kind === 'room' ? '/api/admin/rooms/1' : '/api/admin/blocks',
        ).send(data);
      const before = await snapshot();
      for (const key of [
        'confirmed',
        'expectedCancellationIds',
        'confirmationToken',
      ]) {
        const bad: Record<string, unknown> = { ...body };
        delete bad[key];
        await send(bad).expect(422);
      }
      for (const extra of [
        { confirmed: false },
        { confirmed: 'true' },
        { expectedCancellationIds: null },
        { expectedCancellationIds: [2, 1] },
        { expectedCancellationIds: [1, 1] },
        { expectedCancellationIds: ['1'] },
        { expectedCancellationIds: [0] },
        { expectedCancellationIds: [2147483648] },
        { confirmationToken: 'bad' },
        { cancelReason: 'TIME_BLOCKED' },
        { createdByUserId: 4 },
      ])
        await send({ ...body, ...extra }).expect(422);
      expect(await snapshot()).toEqual(before);
      await send(body).expect(kind === 'room' ? 200 : 201);
    },
  );

  it.each(['room', 'block'])(
    'PREVIEW_STALE: nowa/anulowana/inne ID przy tej samej liczbie: %s',
    async (kind) => {
      const a = await record();
      const p = kind === 'room' ? await roomPreview() : await preview();
      const send = () => (kind === 'room' ? deactivate(p) : block(p));
      const added = await record({ studentId: 3 });
      const withNew = await snapshot();
      expect((await send().expect(409)).body.error.code).toBe('PREVIEW_STALE');
      expect(await snapshot()).toEqual(withNew);
      await cancel(a.id);
      const replaced = await snapshot();
      expect((await send().expect(409)).body.error.code).toBe('PREVIEW_STALE');
      expect(await snapshot()).toEqual(replaced);
      await cancel(added.id);
      const none = await snapshot();
      await send().expect(409);
      expect(await snapshot()).toEqual(none);
      const fresh = kind === 'room' ? await roomPreview() : await preview();
      await (kind === 'room' ? deactivate(fresh) : block(fresh)).expect(
        kind === 'room' ? 200 : 201,
      );
    },
  );

  it('podpis wiąże pokój, termin, opis, admina, operację i ID; ważność ograniczona', async () => {
    const p = await preview({ reason: ' Remont ' });
    const before = await snapshot();
    for (const extra of [
      { roomId: 2 },
      { date: '2026-10-27' },
      { startHour: 11 },
      { durationSlots: 2 },
      { reason: 'Inny' },
    ])
      await block(p, { reason: 'Remont', ...extra }).expect(409);
    await http('post', '/api/admin/blocks', 4)
      .send({ ...term({ reason: 'Remont' }), ...confirm(p) })
      .expect(409);
    await deactivate(p).expect(409);
    await block(
      { ...p, expectedCancellationIds: [123] },
      { reason: 'Remont' },
    ).expect(409);
    const tampered = p.confirmationToken.slice(0, -5) + 'abcde';
    await block(
      { ...p, confirmationToken: tampered },
      { reason: 'Remont' },
    ).expect(422);
    expect(await snapshot()).toEqual(before);
    vi.setSystemTime(new Date(instant.getTime() + ImpactConfirmation.ttlMs));
    await block(p, { reason: 'Remont' }).expect(409);
    expect(await snapshot()).toEqual(before);
    const fresh = await preview({ reason: ' Remont ' });
    await block(fresh, { reason: 'Remont' }).expect(201);
  });

  it('TC-19/20: dwa sloty, tylko kolizje, BLOCKED, usunięcie i nowa rezerwacja', async () => {
    const a = await record({ startHour: 9, durationSlots: 2 });
    const b = await record({ startHour: 11, studentId: 3 });
    const other = await record({ roomId: 2 });
    const adjacent = await record({ startHour: 12 });
    const old = await record({
      startHour: 10,
      status: 'CANCELLED',
      cancelledAt: instant,
      cancelledByUserId: 2,
      cancelReason: 'STUDENT_CANCELLED',
    });
    const p = await preview({ durationSlots: 2, reason: 'remont' });
    expect(p.expectedCancellationIds).toEqual([a.id, b.id]);
    const r = await block(p, { durationSlots: 2, reason: 'remont' }).expect(
      201,
    );
    expect(r.body).toMatchObject({
      cancelledCount: 2,
      durationSlots: 2,
      reason: 'remont',
      createdBy: { id: 1 },
      room: { id: 1 },
    });
    for (const id of [a.id, b.id])
      expect(
        await fixture.db.booking.findUnique({ where: { id } }),
      ).toMatchObject({
        status: 'CANCELLED',
        cancelledAt: instant,
        cancelledByUserId: 1,
        cancelReason: 'TIME_BLOCKED',
      });
    for (const row of [other, adjacent, old])
      expect(
        await fixture.db.booking.findUnique({ where: { id: row.id } }),
      ).toEqual(row);
    const availability = (
      await http('get', '/api/availability', 2)
        .query({ roomId: 1, weekStart: date })
        .expect(200)
    ).body.days[0].slots;
    expect(availability[2].status).toBe('AVAILABLE'); // początek a zwolniony
    expect(availability[3].status).toBe('BLOCKED');
    expect(availability[4].status).toBe('BLOCKED');
    const listed = await http('get', '/api/admin/blocks').expect(200);
    expect(listed.body).toHaveLength(1);
    expect(JSON.stringify(listed.body)).not.toMatch(/password|hash|secret/iu);
    await http('delete', `/api/admin/blocks/${r.body.id}`).expect(204);
    const after = await snapshot();
    await http('delete', `/api/admin/blocks/${r.body.id}`).expect(404);
    expect(await snapshot()).toEqual(after);
    await http('post', '/api/bookings', 3).send(term()).expect(201);
    expect(
      await fixture.db.booking.findUnique({ where: { id: a.id } }),
    ).toMatchObject({ status: 'CANCELLED' });
  });

  it('TC-19: granice, brak horyzontu, kolizje blokad i dozwolone sąsiedztwo', async () => {
    const far = { date: '2027-02-01', startHour: 21, durationSlots: 2 };
    const p = await preview(far);
    await block(p, far).expect(201);
    for (const extra of [
      far,
      { ...far, startHour: 20 },
      { ...far, startHour: 22, durationSlots: 1 },
    ])
      await http('get', '/api/admin/blocks/preview')
        .query(term(extra))
        .expect(409);
    const adjacent = { ...far, startHour: 20, durationSlots: 1 };
    await block(await preview(adjacent), adjacent).expect(201);
    for (const extra of [
      { startHour: 22, durationSlots: 2 },
      { startHour: 6 },
      { startHour: 7.5 },
      { durationSlots: 0 },
      { date: '2026-10-31' },
      { date: '2026-10-25' },
      { date: '2026-02-30' },
      { date: '2026-2-02' },
    ])
      await http('get', '/api/admin/blocks/preview')
        .query(term(extra))
        .expect(422);
    const single = { startHour: 22 };
    await block(await preview(single), single).expect(201);
    const saved = await fixture.db.timeBlock.findFirstOrThrow();
    vi.setSystemTime(new Date('2028-01-01T00:00:00Z'));
    await http('delete', `/api/admin/blocks/${saved.id}`).expect(204); // historyczna też dozwolona
  });

  it('TC-21: każda trasa admin wymaga sesji/roli, w tym zgadnięte ID i preview', async () => {
    for (const [method, path] of [
      ['get', '/students'],
      ['get', '/bookings'],
      ['post', '/rooms'],
      ['patch', '/rooms/1'],
      ['get', '/rooms/1/deactivation-preview'],
      ['get', '/blocks'],
      ['get', '/blocks/preview'],
      ['post', '/blocks'],
      ['delete', '/blocks/1'],
    ] as const) {
      await request(app)[method](`/api/admin${path}`).expect(401);
      const r = await http(method, `/api/admin${path}`, 2).expect(403);
      expect(r.body).toEqual({
        error: { code: 'FORBIDDEN', message: expect.any(String) },
      });
    }
  });

  it('TC-21: ochrona wszystkich mutacji i puste DELETE bez wymogu JSON', async () => {
    const before = await snapshot();
    for (const [method, path] of [
      ['post', '/rooms'],
      ['patch', '/rooms/1'],
      ['post', '/blocks'],
      ['delete', '/blocks/1'],
    ] as const) {
      for (const headers of [
        { Origin: 'https://evil.test' },
        { 'Sec-Fetch-Site': 'cross-site' },
        { 'Sec-Fetch-Site': 'same-origin' },
      ])
        await http(method, `/api/admin${path}`)
          .set(headers)
          .send({})
          .expect(403);
      await http(method, `/api/admin${path}?unexpected=1`).send({}).expect(422);
      if (method === 'delete') continue;
      await http(method, `/api/admin${path}`).type('form').send({}).expect(400);
      await http(method, `/api/admin${path}`)
        .set('Content-Type', 'application/json')
        .send('{')
        .expect(400);
      await http(method, `/api/admin${path}`)
        .send({ data: 'x'.repeat(5000) })
        .expect(400);
      for (const body of [
        [],
        { cancelledByUserId: 1 },
        { status: 'ACTIVE' },
        { cancelReason: 'TIME_BLOCKED' },
        { createdByUserId: 1 },
      ])
        await http(method, `/api/admin${path}`).send(body).expect(422);
    }
    await http('delete', '/api/admin/blocks/1').send({}).expect(422);
    for (const path of [
      '/students',
      '/bookings',
      '/blocks',
      '/rooms/1/deactivation-preview',
    ])
      await http('get', `/api/admin${path}?studentId=2`).expect(422);
    for (const id of ['0', '01', '-1', '1.5', '2147483648', 'abc']) {
      await http('get', `/api/admin/rooms/${id}/deactivation-preview`).expect(
        422,
      );
      await http('patch', `/api/admin/rooms/${id}`)
        .send({ capacity: 2 })
        .expect(422);
      await http('delete', `/api/admin/blocks/${id}`).expect(422);
    }
    await http('get', '/api/admin/rooms/999/deactivation-preview').expect(404);
    await http('patch', '/api/admin/rooms/999')
      .send({ capacity: 2 })
      .expect(404);
    await http('get', '/api/admin/blocks/preview')
      .query(term({ roomId: 999 }))
      .expect(404);
    expect(await snapshot()).toEqual(before);
  });

  it.each(['block', 'room'])(
    'rollback DB po częściowej zmianie/anulowaniu: %s',
    async (kind) => {
      await record();
      await record({ studentId: 3, startHour: 11 });
      const p =
        kind === 'room'
          ? await roomPreview()
          : await preview({ durationSlots: 2 });
      const before = await snapshot();
      // AFTER pierwszego UPDATE: zmiana ma zostać rzeczywiście wykonana przed
      // awarią następnego wiersza; błąd nie może maskować się jako konflikt.
      await fixture.db.$executeRawUnsafe(
        "CREATE TRIGGER test_admin_fault AFTER UPDATE ON bookings WHEN NEW.start_hour = 11 BEGIN SELECT RAISE(ABORT, 'private test fault'); END",
      );
      try {
        const r = await (
          kind === 'room' ? deactivate(p) : block(p, { durationSlots: 2 })
        ).expect(500);
        expect(r.body).toEqual({
          error: {
            code: 'INTERNAL_ERROR',
            message: 'Wewnętrzny błąd serwera.',
          },
        });
        expect(await snapshot()).toEqual(before);
      } finally {
        await fixture.db.$executeRawUnsafe('DROP TRIGGER test_admin_fault');
      }
    },
  );

  it.each(['block', 'room'])(
    'zegar przekracza początek podczas zapisu, pełny rollback: %s',
    async (kind) => {
      const a = await record({ startHour: 7 });
      const p =
        kind === 'room'
          ? await service.previewDeactivation(admin, 1)
          : await service.previewBlock(admin, term({ startHour: 7 }));
      let calls = 0;
      // block: validateBlock, confirmedRows, przed INSERT, createdAt,
      // przed cancelMany, po cancelMany; room: confirmedRows, przed i po UPDATE.
      const crossing = new AdminService(fixture.db, fixture.secret, () =>
        ++calls < (kind === 'block' ? 6 : 3)
          ? instant
          : new Date('2026-10-26T06:00:00Z'),
      );
      const before = await snapshot();
      await expect(
        kind === 'room'
          ? crossing.patchRoom(admin, 1, { isActive: false, ...confirm(p) })
          : crossing.createBlock(admin, {
              ...term({ startHour: 7 }),
              ...confirm(p),
            }),
      ).rejects.toMatchObject({ status: kind === 'room' ? 409 : 422 });
      expect(await snapshot()).toEqual(before);
      expect(
        await fixture.db.booking.findUnique({ where: { id: a.id } }),
      ).toEqual(a);
    },
  );

  it('blokada zachowuje rozpoczętą, zakończoną i anulowaną rezerwację', async () => {
    const started = await record({ startHour: 9, durationSlots: 2 });
    const completed = await record({ date: '2026-10-23' });
    const cancelled = await record({
      status: 'CANCELLED',
      cancelledAt: instant,
      cancelledByUserId: 2,
      cancelReason: 'STUDENT_CANCELLED',
    });
    vi.setSystemTime(new Date('2026-10-26T08:00:00Z')); // 09:00
    const p = await preview();
    expect(p.expectedCancellationIds).toEqual([]);
    await block(p).expect(201);
    for (const row of [started, completed, cancelled])
      expect(
        await fixture.db.booking.findUnique({ where: { id: row.id } }),
      ).toEqual(row);
  });

  it('upływ czasu po podglądzie unieważnia dokładny zbiór dezaktywacji', async () => {
    const row = await record({ startHour: 7 });
    const p = await roomPreview();
    const before = await snapshot();
    vi.setSystemTime(new Date('2026-10-26T06:00:00Z'));
    // Osobny serwis bez wygasłego tokena: początek może nadejść w ciągu 5 min.
    const beforeStart = new Date('2026-10-26T05:59:59Z');
    const issuing = new AdminService(
      fixture.db,
      fixture.secret,
      () => beforeStart,
    );
    const valid = await issuing.previewDeactivation(admin, 1);
    const atStart = new AdminService(
      fixture.db,
      fixture.secret,
      () => new Date('2026-10-26T06:00:00Z'),
    );
    await expect(
      atStart.patchRoom(admin, 1, { isActive: false, ...confirm(valid) }),
    ).rejects.toMatchObject({ status: 409, code: 'PREVIEW_STALE' });
    await deactivate(p).expect(409);
    expect(await snapshot()).toEqual(before);
    expect(
      await fixture.db.booking.findUnique({ where: { id: row.id } }),
    ).toEqual(row);
  });

  it.each(['room', 'block'])(
    'warunkowy zapis o innej liczbie efektów wycofuje całość: %s',
    async (kind) => {
      await record();
      const p = kind === 'room' ? await roomPreview() : await preview();
      const before = await snapshot();
      await fixture.db.$executeRawUnsafe(
        'CREATE TRIGGER test_ignore BEFORE UPDATE ON bookings BEGIN SELECT RAISE(IGNORE); END',
      );
      try {
        const r = await (kind === 'room' ? deactivate(p) : block(p)).expect(
          409,
        );
        expect(r.body.error.code).toBe('PREVIEW_STALE');
        expect(await snapshot()).toEqual(before);
      } finally {
        await fixture.db.$executeRawUnsafe('DROP TRIGGER test_ignore');
      }
    },
  );

  it('zmieniona rola ADMIN jest sprawdzana w transakcji usługi', async () => {
    const p = await service.previewDeactivation(admin, 1);
    await fixture.db.user.update({
      where: { id: 1 },
      data: { role: 'STUDENT' },
    });
    const before = await snapshot();
    for (const run of [
      () => service.createRoom(admin, { roomNumber: 'X', capacity: 1 }),
      () => service.patchRoom(admin, 1, { isActive: false, ...confirm(p) }),
      () => service.patchRoom(admin, 1, { capacity: 2 }),
      () => service.deleteBlock(admin, 1),
      () => service.createBlock(admin, { ...term(), ...confirm(p) }),
      () =>
        new BookingService(fixture.db, () => instant).cancelBooking(admin, 1),
    ])
      await expect(run()).rejects.toMatchObject({ status: 403 });
    expect(await snapshot()).toEqual(before);
  });

  it.each([
    'booking-block',
    'booking-room',
    'overlapping-blocks',
    'two-confirms',
    'admin-student-cancel',
  ])(
    'współbieżne HTTP, dwa niezależne klienty jednego pliku: %s',
    async (scenario) => {
      for (let i = 0; i < 3; i++) {
        await fixture.db.booking.deleteMany();
        await fixture.db.timeBlock.deleteMany();
        await fixture.db.room.updateMany({ data: { isActive: true } });
        let responses;
        if (scenario === 'admin-student-cancel') {
          const a = await record();
          responses = await Promise.all([
            cancel(a.id),
            cancel(a.id, 2, otherApp),
          ]);
          expect(responses.map((r) => r.status).sort()).toEqual([200, 409]);
          const row = await fixture.db.booking.findUniqueOrThrow({
            where: { id: a.id },
          });
          expect(row).toMatchObject({
            status: 'CANCELLED',
            cancelledAt: instant,
          });
          expect(row.cancelReason).toBe(
            row.cancelledByUserId === 1
              ? 'ADMIN_CANCELLED'
              : 'STUDENT_CANCELLED',
          );
        } else if (scenario === 'two-confirms') {
          await record();
          const p = await roomPreview();
          responses = await Promise.all([
            deactivate(p),
            deactivate(p, otherApp),
          ]);
          expect(responses.map((r) => r.status).sort()).toEqual([200, 409]);
          expect(
            await fixture.db.room.findUnique({ where: { id: 1 } }),
          ).toMatchObject({ isActive: false });
          expect(await fixture.db.booking.findFirst()).toMatchObject({
            status: 'CANCELLED',
            cancelReason: 'ROOM_DEACTIVATED',
            cancelledByUserId: 1,
          });
        } else if (scenario === 'overlapping-blocks') {
          await record();
          const p = await preview({ durationSlots: 2 });
          const q = await preview({ startHour: 11 });
          responses = await Promise.all([
            block(p, { durationSlots: 2 }),
            block(q, { startHour: 11 }, otherApp),
          ]);
          expect(responses.map((r) => r.status).sort()).toEqual([201, 409]);
          expect(await fixture.db.timeBlock.count()).toBe(1);
        } else {
          const p =
            scenario === 'booking-room' ? await roomPreview() : await preview();
          responses = await Promise.all([
            http('post', '/api/bookings', 2, otherApp).send(term()),
            scenario === 'booking-room' ? deactivate(p) : block(p),
          ]);
          expect(
            responses.filter((r) => [200, 201].includes(r.status)),
          ).toHaveLength(1);
          expect(
            responses.every((r) => [200, 201, 409].includes(r.status)),
          ).toBe(true);
          // Podgląd zera: zwycięska rezerwacja nigdy nie może być anulowana po cichu.
          expect(
            await fixture.db.booking.count({ where: { status: 'CANCELLED' } }),
          ).toBe(0);
        }
        const state = await snapshot();
        const active = state.bookings.filter((r) => r.status === 'ACTIVE');
        for (const r of active) {
          expect(
            state.rooms.find((room) => room.id === r.roomId)?.isActive,
          ).toBe(true);
          expect(
            state.blocks.some(
              (b) =>
                b.roomId === r.roomId &&
                b.date === r.date &&
                b.startHour < r.startHour + r.durationSlots &&
                r.startHour < b.startHour + b.durationSlots,
            ),
          ).toBe(false);
        }
        for (const r of state.bookings.filter(
          (r) => r.status === 'CANCELLED',
        )) {
          expect(r.cancelledAt).not.toBeNull();
          expect(r.cancelledByUserId).not.toBeNull();
          expect(r.cancelReason).not.toBeNull();
        }
      }
    },
  );
});
