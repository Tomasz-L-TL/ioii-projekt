import assert from 'node:assert/strict';
import { fork, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { mkdir, writeFile } from 'node:fs/promises';
import {
  arch,
  cpus,
  freemem,
  platform,
  release,
  totalmem,
  version,
} from 'node:os';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { testDatabase } from '../../apps/api/src/testing/database.js';
import { repositoryRoot } from '../../apps/api/src/config/database.js';
import {
  addDays,
  calendarDate,
  localNow,
} from '../../apps/api/src/bookings/time.js';
import type { Prisma } from '../../apps/api/src/generated/prisma/client.js';

// Brak opcji podania DB/sekretu/adresu API. Zmienna procesu jest odrzucana,
// .env nie jest ładowany, fixture zawsze tworzy NOWY plik przez flagę wx.
assert(
  !process.env.DATABASE_URL,
  'Usuń DATABASE_URL z procesu: perf nie przyjmuje wskazanej bazy.',
);
assert(
  process.argv.slice(2).every((arg) => arg === '--smoke'),
  'Dozwolona opcja: --smoke.',
);
const smoke = process.argv.includes('--smoke');
const durationMs = smoke ? 15_000 : 600_000;
const clients = 10;
const interruption = new AbortController();
const interrupt = () => interruption.abort();
process.once('SIGINT', interrupt);
process.once('SIGTERM', interrupt);
const fixture = await testDatabase(true);
let child: ReturnType<typeof fork> | undefined;
let report: object | undefined;
try {
  const students = await fixture.db.user.findMany({
    where: { role: 'STUDENT' },
    orderBy: { id: 'asc' },
  });
  const admin = await fixture.db.user.findFirstOrThrow({
    where: { role: 'ADMIN' },
  });
  const rooms = await fixture.db.room.findMany({ orderBy: { id: 'asc' } });
  const today = localNow(new Date()).date;
  const weekDay = calendarDate(today).getUTCDay();
  const firstMonday = addDays(today, -((weekDay + 6) % 7) - 35);
  const data: Prisma.BookingCreateManyInput[] = [];
  // 10 tygodni × 5 dni × 24 wpisy = 1200. Przedziały rozdzielone co 3h;
  // student nie koliduje między salami. Wpisy utworzone przez ADMIN.
  for (let week = 0; week < 10; week++) {
    for (let day = 0; day < 5; day++) {
      const date = addDays(firstMonday, week * 7 + day);
      for (let i = 0; i < 24; i++) {
        const cancelled = i % 4 === 0;
        data.push({
          roomId: rooms[i % rooms.length]!.id,
          studentId: students[i % students.length]!.id,
          createdByUserId: admin.id,
          date,
          startHour: 7 + Math.floor(i / 5) * 3,
          durationSlots: 1 + (i % 2),
          createdAt: new Date(
            `${[addDays(date, -7), addDays(today, -2)].sort()[0]}T00:00:00Z`,
          ),
          status: cancelled ? 'CANCELLED' : 'ACTIVE',
          ...(cancelled
            ? {
                cancelledAt: new Date(
                  `${[addDays(date, -1), addDays(today, -1)].sort()[0]}T00:00:00Z`,
                ),
                cancelledByUserId: admin.id,
                cancelReason: 'ADMIN_CANCELLED',
              }
            : {}),
        });
      }
    }
  }
  await fixture.db.booking.createMany({ data });
  const reservationCount = await fixture.db.booking.count();
  assert.equal(reservationCount, 1200);
  assert.deepEqual(
    await fixture.db.$queryRawUnsafe('PRAGMA foreign_key_check'),
    [],
  );
  const conflicts = await fixture.db.$queryRawUnsafe<{ count: bigint }[]>(`
    SELECT COUNT(*) AS count FROM bookings a JOIN bookings b ON a.id < b.id AND a.date = b.date
    AND a.status = 'ACTIVE' AND b.status = 'ACTIVE' AND (a.room_id = b.room_id OR a.student_id = b.student_id)
    AND a.start_hour < b.start_hour + b.duration_slots AND b.start_hour < a.start_hour + a.duration_slots`);
  assert.equal(Number(conflicts[0]!.count), 0);
  const distribution = await fixture.db.booking.groupBy({
    by: ['status', 'durationSlots'],
    _count: true,
  });
  await fixture.db.$disconnect();

  child = fork(fileURLToPath(new URL('./server.ts', import.meta.url)), [], {
    cwd: repositoryRoot,
    execArgv: ['--import', 'tsx'],
    windowsHide: true,
    stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
  });
  const ready = new Promise<number>((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error('API perf: timeout startu.')),
      30_000,
    );
    child!.once('exit', () => {
      clearTimeout(timeout);
      reject(new Error('API perf nie wystartowało.'));
    });
    child!.once('message', (value: { port: number }) => {
      clearTimeout(timeout);
      resolve(value.port);
    });
  });
  child.send({
    databaseUrl: fixture.databaseUrl,
    secret: fixture.secret.toString('hex'),
  });
  const base = `http://127.0.0.1:${await ready}`;
  const cookies: string[] = [];
  for (let i = 0; i < clients; i++) {
    const authenticate = async () => {
      const response = await fetch(`${base}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: students[i % students.length]!.email,
          password: fixture.password,
        }),
        signal: AbortSignal.any([
          interruption.signal,
          AbortSignal.timeout(10_000),
        ]),
      });
      assert.equal(
        response.status,
        200,
        'Logowanie klienta perf nie powiodło się.',
      );
      await response.arrayBuffer();
      const cookie = response.headers.get('set-cookie')?.split(';')[0];
      assert(cookie, 'Brak cookie klienta perf.');
      return cookie;
    };
    let cookie = await authenticate();
    // Tokeny sesji tego samego konta w tej samej sekundzie są deterministyczne.
    // Dwa klienty na konto otrzymują odrębne tokeny, nie kopię jednej sesji.
    if (cookies.includes(cookie)) {
      await delay(1100);
      cookie = await authenticate();
    }
    assert(!cookies.includes(cookie), 'Sesje klientów muszą być odrębne.');
    cookies.push(cookie);
  }

  type Sample = { ms: number; status: number; error: string | null };
  async function read(client: number, iteration: number): Promise<Sample> {
    const begin = performance.now();
    let status = 0;
    try {
      const roomId = rooms[(iteration + client) % rooms.length]!.id;
      const weekStart = addDays(firstMonday, ((iteration + client) % 10) * 7);
      const response = await fetch(
        `${base}/api/availability?${new URLSearchParams({ roomId: String(roomId), weekStart })}`,
        {
          headers: { Cookie: cookies[client]! },
          signal: AbortSignal.any([
            interruption.signal,
            AbortSignal.timeout(5000),
          ]),
        },
      );
      status = response.status;
      const body = await response.text();
      if (status !== 200)
        return { ms: performance.now() - begin, status, error: 'http' };
      const value = JSON.parse(body);
      const valid =
        response.headers.get('content-type')?.includes('application/json') &&
        value.roomId === roomId &&
        value.weekStart === weekStart &&
        value.timeZone === 'Europe/Warsaw' &&
        Array.isArray(value.days) &&
        value.days.length === 5 &&
        value.days.every(
          (
            day: {
              date: string;
              slots: { startHour: number; status: string }[];
            },
            index: number,
          ) =>
            day.date === addDays(weekStart, index) &&
            Array.isArray(day.slots) &&
            day.slots.length === 16 &&
            day.slots.every(
              (slot, hour) =>
                slot.startHour === hour + 7 &&
                ['AVAILABLE', 'RESERVED', 'PAST'].includes(slot.status),
            ),
        );
      return {
        ms: performance.now() - begin,
        status,
        error: valid ? null : 'invalid-response',
      };
    } catch (error) {
      return {
        ms: performance.now() - begin,
        status,
        error:
          error instanceof Error && error.name === 'TimeoutError'
            ? 'timeout'
            : 'network-or-json',
      };
    }
  }
  // Oddzielny warm-up 5s, te same 10 pętli; każdy błąd przerywa przygotowanie.
  const warmupEnd = performance.now() + 5000;
  let warmupRequests = 0;
  await Promise.all(
    Array.from({ length: clients }, async (_, client) => {
      let iteration = 0;
      while (performance.now() < warmupEnd) {
        interruption.signal.throwIfAborted();
        const sample = await read(client, iteration++);
        assert.equal(sample.error, null, 'Błąd odczytu podczas warm-up.');
        warmupRequests++;
        await delay(50);
      }
    }),
  );
  const samples: Sample[] = [];
  const perClient = Array<number>(clients).fill(0);
  let started = 0;
  let outsideWindow = 0;
  const outsideStatuses: Record<string, number> = {};
  const outsideErrors: Record<string, number> = {};
  let inFlight = 0;
  let maxInFlight = 0;
  const startUtc = new Date().toISOString();
  const start = performance.now();
  const end = start + durationMs;
  console.info(
    `PERF ${smoke ? 'SMOKE (bez oceny WN-02)' : 'WN-02'}: ${reservationCount} rezerwacji, ${clients} odrębnych sesji, ${durationMs / 1000}s pomiaru.`,
  );
  const progress = setInterval(
    () =>
      console.info(
        `PERF: ${Math.min(durationMs, performance.now() - start).toFixed(0)} ms, zakończone w oknie: ${samples.length}.`,
      ),
    30_000,
  );
  try {
    await Promise.all(
      Array.from({ length: clients }, async (_, client) => {
        let iteration = 0;
        while (performance.now() < end) {
          interruption.signal.throwIfAborted();
          started++;
          inFlight++;
          maxInFlight = Math.max(maxInFlight, inFlight);
          const sample = await read(client, iteration++);
          inFlight--;
          if (performance.now() < end) {
            samples.push(sample);
            perClient[client]!++;
          } else {
            outsideWindow++;
            outsideStatuses[sample.status] =
              (outsideStatuses[sample.status] ?? 0) + 1;
            if (sample.error)
              outsideErrors[sample.error] =
                (outsideErrors[sample.error] ?? 0) + 1;
          }
          // 50ms czasu namysłu po zakończeniu: model zamknięty, brak limitu RPS.
          await delay(50);
        }
      }),
    );
  } finally {
    clearInterval(progress);
  }
  const observedMs = performance.now() - start;
  interruption.signal.throwIfAborted();
  const valid = samples
    .filter((sample) => sample.error === null)
    .map((sample) => sample.ms)
    .sort((a, b) => a - b);
  const percentile = (p: number) =>
    valid.length ? valid[Math.ceil(valid.length * p) - 1]! : null;
  const statuses: Record<string, number> = {};
  const errors: Record<string, number> = {};
  for (const sample of samples) {
    statuses[sample.status] = (statuses[sample.status] ?? 0) + 1;
    if (sample.error) errors[sample.error] = (errors[sample.error] ?? 0) + 1;
  }
  const p95 = percentile(0.95);
  const passed =
    samples.length > 0 &&
    samples.length === valid.length &&
    p95 !== null &&
    p95 <= 2000 &&
    maxInFlight === clients &&
    perClient.every((n) => n > 0) &&
    observedMs >= durationMs;
  const npmVersion = process.env.npm_execpath
    ? spawnSync(process.execPath, [process.env.npm_execpath, '--version'], {
        encoding: 'utf8',
        windowsHide: true,
      })
    : null;
  report = {
    mode: smoke ? 'SMOKE' : 'WN-02',
    result: smoke ? (passed ? 'SMOKE_PASS' : 'FAIL') : passed ? 'PASS' : 'FAIL',
    startUtc,
    endUtc: new Date(Date.parse(startUtc) + durationMs).toISOString(),
    measurementMs: durationMs,
    observedIncludingDrainMs: observedMs,
    environment: {
      os: version(),
      release: release(),
      platform: platform(),
      arch: arch(),
      cpu: cpus()[0]?.model,
      logicalCpus: cpus().length,
      totalRamBytes: totalmem(),
      freeRamBytes: freemem(),
      node: process.version,
      npm: npmVersion?.status === 0 ? npmVersion.stdout.trim() : 'NIEODCZYTANO',
      api: 'TypeScript / tsx, osobny proces, bez watchera',
    },
    accounts: 6,
    students: students.length,
    clients,
    distinctSessions: new Set(cookies).size,
    reservationCount,
    distribution,
    firstMonday,
    lastFriday: addDays(firstMonday, 67),
    warmupMs: 5000,
    warmupRequests,
    thinkTimeMs: 50,
    timeoutMs: 5000,
    started,
    completedInWindow: samples.length,
    completedOutsideWindow: outsideWindow,
    outsideStatuses,
    outsideErrors,
    perClient,
    maxInFlight,
    statuses,
    errors,
    successful: valid.length,
    errorRate: samples.length ? 1 - valid.length / samples.length : 1,
    medianMs: percentile(0.5),
    p95Ms: p95,
    p99Ms: percentile(0.99),
    throughputPerSecond: samples.length / (durationMs / 1000),
    criterion:
      '600s, >=1000 rezerwacji, 10 odrębnych sesji/klientów, p95 nearest-rank poprawnych HTTP 200 <=2000ms, zero błędów; smoke nie zalicza WN-02',
  };
  if (!passed) process.exitCode = 1;
} finally {
  if (child && child.exitCode === null && child.signalCode === null) {
    const stopped = once(child, 'exit');
    if (child.connected) child.disconnect();
    const timeout = setTimeout(() => child?.kill(), 5000);
    await stopped;
    clearTimeout(timeout);
  }
  await fixture.close();
  process.removeListener('SIGINT', interrupt);
  process.removeListener('SIGTERM', interrupt);
}
// Tylko zredagowane statystyki. Żadnych cookie, haseł, tokenów ani surowego HTTP.
if (report) {
  await mkdir(join(repositoryRoot, 'test-results'), { recursive: true });
  await writeFile(
    join(
      repositoryRoot,
      'test-results',
      smoke ? 'performance-smoke.json' : 'performance-summary.json',
    ),
    JSON.stringify(report, null, 2) + '\n',
  );
  console.info(JSON.stringify(report, null, 2));
}
