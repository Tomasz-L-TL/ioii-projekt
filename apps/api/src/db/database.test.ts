import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomBytes } from 'node:crypto';
import { testDatabase } from '../testing/database.js';
import { seedDemo } from './seed.js';
import { createDatabase } from './client.js';
import { verifyPassword } from '../auth/password.js';
import { normalizeEmail, normalizeRoomNumber } from '../auth/normalization.js';

describe('Pierwsza migracja, fizyczna SQLite i atomowy seed', () => {
  let fixture: Awaited<ReturnType<typeof testDatabase>>;
  beforeAll(async () => {
    fixture = await testDatabase();
  });
  afterAll(async () => {
    await fixture?.close();
  });

  it('tworzy cztery tabele domenowe, sześć FK RESTRICT i wymagane indeksy', async () => {
    const tables = await fixture.db.$queryRawUnsafe<{ name: string }[]>(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name != '_prisma_migrations' ORDER BY name",
    );
    expect(tables.map((table) => table.name)).toEqual([
      'bookings',
      'rooms',
      'time_blocks',
      'users',
    ]);
    const fks = [];
    for (const table of ['bookings', 'time_blocks']) {
      fks.push(
        ...(await fixture.db.$queryRawUnsafe<
          { on_delete: string; on_update: string }[]
        >(`PRAGMA foreign_key_list(${table})`)),
      );
    }
    expect(fks).toHaveLength(6);
    for (const fk of fks)
      expect(fk).toMatchObject({
        on_delete: 'RESTRICT',
        on_update: 'RESTRICT',
      });
    const indexes = await fixture.db.$queryRawUnsafe<
      { name: string; sql: string }[]
    >(
      "SELECT name, sql FROM sqlite_master WHERE type='index' AND sql IS NOT NULL",
    );
    for (const name of [
      'users_email_key',
      'rooms_room_number_key',
      'bookings_room_id_date_idx',
      'bookings_student_id_date_idx',
      'time_blocks_room_id_date_idx',
    ])
      expect(indexes.map((index) => index.name)).toContain(name);
    expect(
      indexes.find((index) => index.name === 'bookings_room_id_date_idx')?.sql,
    ).toContain('("room_id", "date")');
    expect(
      indexes.find((index) => index.name === 'bookings_student_id_date_idx')
        ?.sql,
    ).toContain('("student_id", "date")');
    expect(
      indexes.find((index) => index.name === 'time_blocks_room_id_date_idx')
        ?.sql,
    ).toContain('("room_id", "date")');
  });

  it('seed tworzy dokładne dane początkowe i bcrypt cost 12', async () => {
    const users = await fixture.db.user.findMany();
    expect(users).toHaveLength(6);
    expect(users.filter((user) => user.role === 'ADMIN')).toHaveLength(1);
    expect(users.filter((user) => user.role === 'STUDENT')).toHaveLength(5);
    expect(
      users.every(
        (user) =>
          user.email.endsWith('@roombook.test') &&
          normalizeEmail(user.email) === user.email,
      ),
    ).toBe(true);
    for (const user of users) {
      expect(user.passwordHash === fixture.password).toBe(false);
      expect(/^\$2[aby]\$12\$/u.test(user.passwordHash)).toBe(true);
    }
    expect(await verifyPassword(fixture.password, users[0]!.passwordHash)).toBe(
      true,
    );
    expect(
      await verifyPassword(
        randomBytes(24).toString('hex'),
        users[0]!.passwordHash,
      ),
    ).toBe(false);
    expect(
      await fixture.db.room.findMany({
        orderBy: { roomNumber: 'asc' },
        select: {
          roomNumber: true,
          name: true,
          capacity: true,
          isActive: true,
        },
      }),
    ).toEqual([
      {
        roomNumber: 'A-101',
        name: 'Sala projektowa',
        capacity: 6,
        isActive: true,
      },
      {
        roomNumber: 'A-102',
        name: 'Sala seminaryjna',
        capacity: 8,
        isActive: true,
      },
      {
        roomNumber: 'B-201',
        name: 'Sala do konsultacji',
        capacity: 4,
        isActive: true,
      },
      {
        roomNumber: 'B-202',
        name: 'Sala zespołowa',
        capacity: 10,
        isActive: true,
      },
      {
        roomNumber: 'C-301',
        name: 'Sala warsztatowa',
        capacity: 12,
        isActive: true,
      },
      { roomNumber: 'C-302', name: null, capacity: 5, isActive: true },
      {
        roomNumber: 'D-401',
        name: 'Sala konferencyjna',
        capacity: 16,
        isActive: true,
      },
      { roomNumber: 'D-402', name: null, capacity: 6, isActive: true },
    ]);
    expect(await fixture.db.booking.count()).toBe(0);
    expect(await fixture.db.timeBlock.count()).toBe(0);
    const before = await fixture.db.room.findMany({ orderBy: { id: 'asc' } });
    await seedDemo(fixture.db, fixture.password);
    expect(await fixture.db.user.count()).toBe(6);
    expect(await fixture.db.room.findMany({ orderBy: { id: 'asc' } })).toEqual(
      before,
    );
    expect(await fixture.db.booking.count()).toBe(0);
    expect(await fixture.db.timeBlock.count()).toBe(0);
  });

  it('normalizuje loginy i numery sal przed zapisem', () => {
    expect(normalizeEmail('  ANNA.NOWAK@ROOMBOOK.TEST  ')).toBe(
      'anna.nowak@roombook.test',
    );
    expect(normalizeRoomNumber('  a-101 \t  skrzydło b \n')).toBe(
      'A-101 SKRZYDŁO B',
    );
  });

  it('egzekwuje foreign_keys=ON także po ponownym otwarciu fizycznego pliku', async () => {
    const second = await createDatabase(fixture.databaseUrl);
    try {
      expect(await second.user.count()).toBe(6);
      const rows = await second.$queryRawUnsafe<{ foreign_keys: bigint }[]>(
        'PRAGMA foreign_keys',
      );
      expect(Number(rows[0]!.foreign_keys)).toBe(1);
      await expect(
        second.$executeRawUnsafe(
          "INSERT INTO time_blocks(room_id,date,start_hour,duration_slots,created_by_user_id) VALUES (999999,'2030-01-01',7,1,1)",
        ),
      ).rejects.toThrow();
    } finally {
      await second.$disconnect();
    }
  });

  const invalidUpdates = [
    ['rola', "UPDATE users SET role='ROOT' WHERE id=1"],
    ['capacity=0', 'UPDATE rooms SET capacity=0 WHERE id=1'],
    ['capacity=-1', 'UPDATE rooms SET capacity=-1 WHERE id=1'],
    ['capacity ułamkowe', 'UPDATE rooms SET capacity=1.5 WHERE id=1'],
    ['capacity tekstowe', "UPDATE rooms SET capacity='abc' WHERE id=1"],
    ['pusty numer', "UPDATE rooms SET room_number='' WHERE id=1"],
    ['numer ze spacjami', "UPDATE rooms SET room_number='   ' WHERE id=1"],
    [
      'unikatowy email',
      'UPDATE users SET email=(SELECT email FROM users WHERE id=2) WHERE id=1',
    ],
    [
      'unikatowy numer',
      'UPDATE rooms SET room_number=(SELECT room_number FROM rooms WHERE id=2) WHERE id=1',
    ],
  ];
  it.each(invalidUpdates)('SQLite odrzuca: %s', async (_label, sql) => {
    await expect(fixture.db.$executeRawUnsafe(sql!)).rejects.toThrow();
  });

  const bookingInsert = (values: string) =>
    `INSERT INTO bookings(student_id,room_id,created_by_user_id,date,start_hour,duration_slots,status,cancelled_at,cancelled_by_user_id,cancel_reason) VALUES (${values})`;
  it.each([
    ['nieznany status', "2,1,2,'2030-01-01',7,1,'DONE',NULL,NULL,NULL"],
    [
      'nieznany powód',
      "2,1,2,'2030-01-01',7,1,'CANCELLED','2030-01-01',1,'OTHER'",
    ],
    ...Array.from({ length: 7 }, (_, mask) => [
      `niepełne anulowanie ${mask}`,
      `2,1,2,'2030-01-01',7,1,'CANCELLED',${mask & 1 ? "'2030-01-01'" : 'NULL'},${mask & 2 ? '1' : 'NULL'},${mask & 4 ? "'ADMIN_CANCELLED'" : 'NULL'}`,
    ]),
    ...Array.from({ length: 7 }, (_, index) => {
      const mask = index + 1;
      return [
        `ACTIVE z anulowaniem ${mask}`,
        `2,1,2,'2030-01-01',7,1,'ACTIVE',${mask & 1 ? "'2030-01-01'" : 'NULL'},${mask & 2 ? '1' : 'NULL'},${mask & 4 ? "'ADMIN_CANCELLED'" : 'NULL'}`,
      ];
    }),
    ['FK student', "999999,1,2,'2030-01-01',7,1,'ACTIVE',NULL,NULL,NULL"],
    ['FK room', "2,999999,2,'2030-01-01',7,1,'ACTIVE',NULL,NULL,NULL"],
    ['FK createdBy', "2,1,999999,'2030-01-01',7,1,'ACTIVE',NULL,NULL,NULL"],
    [
      'FK cancelledBy',
      "2,1,2,'2030-01-01',7,1,'CANCELLED','2030-01-01',999999,'ADMIN_CANCELLED'",
    ],
  ])('SQLite bookings odrzuca: %s', async (_label, values) => {
    await expect(
      fixture.db.$executeRawUnsafe(bookingInsert(values!)),
    ).rejects.toThrow();
  });

  it.each(['bookings', 'time_blocks'])(
    '%s: sprawdza godziny i sloty w rzeczywistej SQLite',
    async (table) => {
      for (const [hour, slots] of [
        [6, 1],
        [23, 1],
        [7, 0],
        [7, 3],
        [22, 2],
        [7.5, 1],
        [7, 1.5],
      ]) {
        const columns =
          table === 'bookings'
            ? 'student_id,room_id,created_by_user_id'
            : 'room_id,created_by_user_id';
        const ids = table === 'bookings' ? '2,1,2' : '1,1';
        await expect(
          fixture.db.$executeRawUnsafe(
            `INSERT INTO ${table}(${columns},date,start_hour,duration_slots) VALUES (${ids},'2030-01-01',${hour},${slots})`,
          ),
        ).rejects.toThrow();
      }
      // Granice poprawne, bez założeń o konfliktach domenowych na tym etapie.
      for (const [hour, slots] of [
        [7, 2],
        [21, 2],
        [22, 1],
      ]) {
        await fixture.db.$executeRawUnsafe(
          `INSERT INTO ${table}(${table === 'bookings' ? 'student_id,' : ''}room_id,created_by_user_id,date,start_hour,duration_slots) VALUES (${table === 'bookings' ? '2,' : ''}1,1,'2030-01-01',${hour},${slots})`,
        );
      }
      await fixture.db.$executeRawUnsafe(`DELETE FROM ${table}`);
    },
  );

  it('odrzuca obydwa FK blokad', async () => {
    for (const [roomId, userId] of [
      [999999, 1],
      [1, 999999],
    ]) {
      await expect(
        fixture.db.$executeRawUnsafe(
          `INSERT INTO time_blocks(room_id,created_by_user_id,date,start_hour,duration_slots) VALUES (${roomId},${userId},'2030-01-01',7,1)`,
        ),
      ).rejects.toThrow();
    }
  });

  it('ponowny seed zachowuje hasła, zmiany sal, dodatkowe dane i historię; FK blokują DELETE/UPDATE', async () => {
    const oldUser = await fixture.db.user.findUniqueOrThrow({
      where: { id: 2 },
    });
    await fixture.db.room.update({
      where: { id: 1 },
      data: { isActive: false, name: 'Zmieniona nazwa' },
    });
    const booking = await fixture.db.booking.create({
      data: {
        studentId: 2,
        roomId: 1,
        createdByUserId: 1,
        date: '2030-01-01',
        startHour: 7,
        durationSlots: 2,
        status: 'CANCELLED',
        cancelledAt: new Date(),
        cancelledByUserId: 1,
        cancelReason: 'ADMIN_CANCELLED',
      },
    });
    const block = await fixture.db.timeBlock.create({
      data: {
        roomId: 1,
        createdByUserId: 1,
        date: '2030-01-01',
        startHour: 9,
        durationSlots: 1,
      },
    });
    const extra = await fixture.db.room.create({
      data: { roomNumber: 'TEST-EXTRA', capacity: 3 },
    });
    await seedDemo(fixture.db, randomBytes(24).toString('hex'));
    expect(await fixture.db.user.count()).toBe(6);
    expect(await fixture.db.room.count()).toBe(9);
    expect(
      (await fixture.db.user.findUniqueOrThrow({ where: { id: 2 } }))
        .passwordHash === oldUser.passwordHash,
    ).toBe(true);
    expect(
      await fixture.db.room.findUnique({ where: { id: 1 } }),
    ).toMatchObject({ isActive: false, name: 'Zmieniona nazwa' });
    expect(
      await fixture.db.booking.findUnique({ where: { id: booking.id } }),
    ).toEqual(booking);
    expect(
      await fixture.db.timeBlock.findUnique({ where: { id: block.id } }),
    ).toEqual(block);
    for (const sql of [
      'DELETE FROM users WHERE id=2',
      'DELETE FROM users WHERE id=1',
      'DELETE FROM rooms WHERE id=1',
      'UPDATE users SET id=999 WHERE id=1',
      'UPDATE users SET id=999 WHERE id=2',
      'UPDATE rooms SET id=999 WHERE id=1',
    ])
      await expect(fixture.db.$executeRawUnsafe(sql)).rejects.toThrow();
    await fixture.db.room.delete({ where: { id: extra.id } });
    expect(await fixture.db.room.count()).toBe(8);
  });

  it('błąd w końcowej części seeda wycofuje także wcześniej dodane konta i sale', async () => {
    const empty = await testDatabase(false);
    try {
      // Testowa usterka: dwie sale demo mają capacity=6; nie jest to reguła domenowa.
      await empty.db.$executeRawUnsafe(
        'CREATE UNIQUE INDEX test_fault ON rooms(capacity)',
      );
      await expect(seedDemo(empty.db, empty.password)).rejects.toThrow();
      expect(await empty.db.user.count()).toBe(0);
      expect(await empty.db.room.count()).toBe(0);
    } finally {
      await empty.close();
    }
  });

  it('odrzuca słabe hasło przed zapisem', async () => {
    await expect(
      seedDemo(fixture.db, randomBytes(4).toString('hex')),
    ).rejects.toThrow('SEED_DEMO_PASSWORD');
    await expect(
      seedDemo(fixture.db, randomBytes(40).toString('hex')),
    ).rejects.toThrow('SEED_DEMO_PASSWORD');
    expect(await fixture.db.user.count()).toBe(6);
  });
});
