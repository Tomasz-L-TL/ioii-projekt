import type { APIRequestContext, Page } from '@playwright/test';
import { test, expect, login, slot } from './fixtures';
import { addDays, monday, warsawToday } from '../../apps/web/src/dates';
import type {
  AdminBookingDto,
  BookingDto,
  ImpactDto,
} from '../../apps/web/src/api/types';

async function seedBooking(
  request: APIRequestContext,
  roomId: number,
  studentId: number,
  date: string,
  startHour = 10,
  durationSlots = 1,
) {
  const response = await request.post('/api/bookings', {
    data: { roomId, studentId, date, startHour, durationSlots },
  });
  expect(response.status()).toBe(201);
  return (await response.json()) as BookingDto;
}
async function chooseWeek(page: Page, date: string) {
  await page.getByLabel('Tydzień zawierający datę').fill(monday(date));
  await expect(page.locator(`td[data-date="${date}"]`)).toHaveCount(16);
}
async function bookings(request: APIRequestContext) {
  return (await (
    await request.get('/api/admin/bookings')
  ).json()) as AdminBookingDto[];
}

test('sale: dodanie, trwała edycja z opisem i odmowa duplikatu', async ({
  page,
  data,
}) => {
  await login(page, 'admin@roombook.test', true);
  await page.getByRole('button', { name: 'Dodaj salę', exact: true }).click();
  const number = `E2E-${Date.now()}`;
  await page.getByLabel('Numer sali', { exact: true }).fill(number);
  await page
    .getByLabel('Nazwa sali', { exact: true })
    .fill('Test administracji');
  await page.getByLabel('Liczba miejsc').fill('7');
  await page.getByLabel('Opis sali').fill('Opis do zachowania');
  await page.getByRole('button', { name: 'Zapisz salę', exact: true }).click();
  const row = page.locator('[data-room-id]').filter({ hasText: number });
  await expect(row).toContainText('Opis do zachowania');
  await row.getByRole('button', { name: 'Edytuj', exact: true }).click();
  await expect(page.getByLabel('Opis sali')).toHaveValue('Opis do zachowania');
  await page.getByLabel('Liczba miejsc').fill('9');
  await page.getByRole('button', { name: 'Zapisz salę', exact: true }).click();
  await expect(row).toContainText('9');
  await page.reload();
  await expect(row).toContainText('Opis do zachowania');
  await page.getByRole('button', { name: 'Dodaj salę', exact: true }).click();
  await page
    .getByLabel('Numer sali', { exact: true })
    .fill(data.rooms[0]!.roomNumber);
  await page.getByRole('button', { name: 'Zapisz salę', exact: true }).click();
  await expect(
    page.getByRole('alert').filter({ hasText: /numer|istnieje|unikal/i }),
  ).toBeVisible();
});

test('dezaktywacja: te same liczby i inne ID wymagają nowego podglądu i zgody', async ({
  page,
  request,
  data,
}) => {
  const room = data.rooms[0]!;
  const first = await seedBooking(request, room.id, data.studentId, data.date);
  await login(page, 'admin@roombook.test');
  const row = page.locator(`[data-room-id="${room.id}"]`);
  const previewResponse = page.waitForResponse((r) =>
    r.url().includes('/deactivation-preview'),
  );
  await row.getByRole('button', { name: 'Podgląd dezaktywacji' }).click();
  const preview = (await (await previewResponse).json()) as ImpactDto;
  expect(preview.expectedCancellationIds).toEqual([first.id]);
  await expect(page.getByRole('dialog')).toContainText('do anulowania: 1');
  expect((await bookings(request)).find((b) => b.id === first.id)?.status).toBe(
    'ACTIVE',
  );
  expect(
    (
      await request.post(`/api/bookings/${first.id}/cancel`, { data: {} })
    ).status(),
  ).toBe(200);
  const second = await seedBooking(
    request,
    room.id,
    data.studentId,
    data.date,
    12,
  );
  const stale = page.waitForResponse((r) => r.request().method() === 'PATCH');
  await page.getByRole('button', { name: 'Potwierdź dezaktywację' }).click();
  expect((await stale).status()).toBe(409);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(
    page.getByRole('alert').filter({ hasText: 'nowy podgląd' }),
  ).toBeVisible();
  expect(
    (await bookings(request)).find((b) => b.id === second.id)?.status,
  ).toBe('ACTIVE');
  await row.getByRole('button', { name: 'Podgląd dezaktywacji' }).click();
  const saved = page.waitForResponse((r) => r.request().method() === 'PATCH');
  await page.getByRole('button', { name: 'Potwierdź dezaktywację' }).click();
  const response = await saved;
  expect(response.status()).toBe(200);
  expect(response.request().postDataJSON()).toMatchObject({
    confirmed: true,
    expectedCancellationIds: [second.id],
  });
  expect(response.request().postDataJSON().confirmationToken).not.toBe(
    preview.confirmationToken,
  );
  await expect(row).toContainText('Nieaktywna');
  await row.getByRole('button', { name: 'Aktywuj', exact: true }).click();
  await page.getByRole('button', { name: 'Potwierdź aktywację' }).click();
  await expect(
    row.getByRole('button', { name: 'Podgląd dezaktywacji' }),
  ).toBeVisible();
  expect(
    (await bookings(request)).find((b) => b.id === second.id),
  ).toMatchObject({
    status: 'CANCELLED',
    cancelReason: 'ROOM_DEACTIVATED',
    cancelledBy: { role: 'ADMIN' },
  });
});

test('blokada 120 minut: podgląd dokładnych parametrów, anulowania, usunięcie bez przywracania', async ({
  page,
  request,
  data,
}) => {
  const room = data.rooms[0]!;
  const booking = await seedBooking(
    request,
    room.id,
    data.studentId,
    data.date,
    10,
    2,
  );
  await login(page, 'admin@roombook.test');
  await page.goto('/#UI-06');
  await page.getByLabel('Sala do blokady').selectOption(String(room.id));
  await page.getByLabel('Długość blokady').selectOption('2');
  await page
    .getByLabel('Powód blokady (opcjonalnie)')
    .fill('Remont & sprawdzenie');
  await chooseWeek(page, data.date);
  await slot(page, data.date, 10).click();
  await expect(page.locator('td.selected')).toHaveCount(2);
  await expect(slot(page, data.date, 22)).toBeDisabled();
  const previewResponse = page.waitForResponse((r) =>
    r.url().includes('/blocks/preview?'),
  );
  await page.getByRole('button', { name: 'Podgląd skutków blokady' }).click();
  const preview = (await (await previewResponse).json()) as ImpactDto;
  await expect(page.getByRole('dialog')).toContainText('do anulowania: 1');
  await expect(page.getByRole('dialog')).toContainText('120 min');
  await expect(page.getByRole('dialog')).toContainText('Remont & sprawdzenie');
  const saved = page.waitForResponse(
    (r) =>
      r.request().method() === 'POST' &&
      new URL(r.url()).pathname === '/api/admin/blocks',
  );
  await page
    .getByRole('button', { name: 'Potwierdź utworzenie blokady' })
    .click();
  const response = await saved;
  expect(response.status()).toBe(201);
  expect(response.request().postDataJSON()).toEqual({
    roomId: room.id,
    date: data.date,
    startHour: 10,
    durationSlots: 2,
    reason: 'Remont & sprawdzenie',
    confirmed: true,
    expectedCancellationIds: [booking.id],
    confirmationToken: preview.confirmationToken,
  });
  const block = (await response.json()) as { id: number };
  const row = page.locator(`[data-block-id="${block.id}"]`);
  await row.getByRole('button', { name: 'Usuń blokadę' }).click();
  await page.getByRole('button', { name: 'Potwierdź usunięcie' }).click();
  await expect(row).toHaveCount(0);
  expect(
    (await bookings(request)).find((b) => b.id === booking.id),
  ).toMatchObject({ status: 'CANCELLED', cancelReason: 'TIME_BLOCKED' });
});

test('podgląd zerowy można zamknąć Escape i nie wysyła on mutacji', async ({
  page,
  data,
  request,
}) => {
  await login(page, 'admin@roombook.test');
  const row = page.locator(`[data-room-id="${data.rooms[0]!.id}"]`);
  const calls: string[] = [];
  page.on('request', (r) => {
    if (r.method() === 'PATCH') calls.push(r.url());
  });
  const trigger = row.getByRole('button', { name: 'Podgląd dezaktywacji' });
  await trigger.click();
  await expect(page.getByRole('dialog')).toContainText('do anulowania: 0');
  await page.keyboard.press('Escape');
  await expect(trigger).toBeFocused();
  expect(calls).toEqual([]);
  const rooms = (await (await request.get('/api/rooms')).json()) as {
    id: number;
    isActive: boolean;
  }[];
  expect(rooms.find((r) => r.id === data.rooms[0]!.id)?.isActive).toBe(true);
});

test('rezerwacja dla studenta poza +14 dni i limitem 3; podgląd i anulowanie administracyjne', async ({
  page,
  request,
  data,
}) => {
  const room = data.rooms[0]!;
  for (const hour of [7, 8, 9])
    await seedBooking(request, room.id, data.studentId, data.date, hour);
  let date = addDays(warsawToday(), 30);
  while ([0, 6].includes(new Date(`${date}T12:00:00Z`).getUTCDay()))
    date = addDays(date, 1);
  await login(page, 'admin@roombook.test');
  await page.goto('/#UI-07');
  await page.getByLabel('Aktywna sala').selectOption(String(room.id));
  await page
    .getByLabel('Student — właściciel')
    .selectOption(String(data.studentId));
  await page.getByLabel('Czas zajęć').selectOption('2');
  await chooseWeek(page, date);
  await slot(page, date, 21).click();
  await expect(slot(page, date, 22)).toBeDisabled();
  await page.getByRole('button', { name: 'Zarezerwuj dla studenta' }).click();
  await expect(page.getByRole('dialog')).toContainText(
    'Właściciel: Anna Nowak',
  );
  const saved = page.waitForResponse(
    (r) =>
      r.request().method() === 'POST' &&
      new URL(r.url()).pathname === '/api/bookings',
  );
  await page
    .getByRole('button', { name: 'Potwierdź rezerwację', exact: true })
    .click();
  const response = await saved;
  expect(response.status()).toBe(201);
  const booking = (await response.json()) as BookingDto;
  expect(booking).toMatchObject({
    studentId: data.studentId,
    createdBy: { role: 'ADMIN' },
    durationSlots: 2,
  });
  await page.goto('/#UI-05');
  await page.getByLabel('Szukaj rezerwacji').fill(String(booking.id));
  const row = page.locator(`[data-booking-id="${booking.id}"]`);
  await expect(row).toContainText('Anna Nowak');
  await row.getByRole('button', { name: 'Anuluj rezerwację' }).click();
  await page.getByRole('button', { name: 'Potwierdź anulowanie' }).click();
  await expect(row).toContainText('Anulowana');
  await row.getByText('Historia anulowania').click();
  await expect(row).toContainText('Anulowanie przez administratora');
  expect(
    (await bookings(request)).find((item) => item.id === booking.id)
      ?.cancelReason,
  ).toBe('ADMIN_CANCELLED');
  await expect(
    row.getByRole('button', { name: 'Anuluj rezerwację' }),
  ).toHaveCount(0);
});

test('administracja: błąd odczytu z ponowieniem, odmowa 403 i wygaśnięcie sesji 401', async ({
  page,
  data,
}) => {
  await page.route('**/api/rooms', (route) =>
    route.fulfill({
      status: 500,
      json: {
        error: { code: 'INTERNAL_ERROR', message: 'Próba błędu odczytu' },
      },
    }),
  );
  await login(page, 'admin@roombook.test');
  await expect(
    page.getByRole('alert').filter({ hasText: 'Próba błędu' }),
  ).toBeVisible();
  await page.unroute('**/api/rooms');
  await page.getByRole('button', { name: 'Ponów odczyt: sale' }).click();
  const row = page.locator(`[data-room-id="${data.rooms[0]!.id}"]`);
  await expect(row).toBeVisible();
  await page.route('**/deactivation-preview', (route) =>
    route.fulfill({
      status: 403,
      json: { error: { code: 'FORBIDDEN', message: 'Brak uprawnień' } },
    }),
  );
  await row.getByRole('button', { name: 'Podgląd dezaktywacji' }).click();
  await expect(
    page.getByRole('alert').filter({ hasText: 'Brak uprawnień' }),
  ).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.route('**/api/admin/bookings', (route) =>
    route.fulfill({
      status: 401,
      json: { error: { code: 'UNAUTHENTICATED', message: 'Sesja wygasła' } },
    }),
  );
  await page.goto('/#UI-05');
  await expect(
    page.getByRole('button', { name: 'Zaloguj', exact: true }),
  ).toBeVisible();
  await expect(page.locator('[data-room-id]')).toHaveCount(0);
  await expect(page.locator('[data-booking-id]')).toHaveCount(0);
});
