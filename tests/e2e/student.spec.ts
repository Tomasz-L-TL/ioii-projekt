import { test, expect, login, goToWeek, slot, openBooking } from './fixtures';
import type { BookingDto } from '../../apps/web/src/api/types';

test('nieaktualny snapshot: rzeczywisty 409 i świeża dostępność bez sukcesu', async ({
  page,
  data,
  jan,
}) => {
  await login(page);
  await goToWeek(page, data.date);
  await openBooking(page, data.date, 12, 1);
  expect(
    (
      await jan.post('/api/bookings', {
        data: {
          roomId: data.rooms[0]!.id,
          date: data.date,
          startHour: 12,
          durationSlots: 1,
        },
      })
    ).status(),
  ).toBe(201);
  const response = page.waitForResponse(
    (r) =>
      new URL(r.url()).pathname === '/api/bookings' &&
      r.request().method() === 'POST',
  );
  await page
    .getByRole('button', { name: 'Potwierdź rezerwację', exact: true })
    .click();
  const result = await response;
  expect(result.status()).toBe(409);
  expect(
    ((await result.json()) as { error: { code: string } }).error.code,
  ).toBe('SLOT_CONFLICT');
  await expect(
    page.getByRole('alert').filter({ hasText: /Termin|konflikt|zajęt/i }),
  ).toBeVisible();
  await expect(page.getByText(/Zapisano rezerwację #/)).toHaveCount(0);
  await expect(slot(page, data.date, 12)).toHaveAccessibleName(/Zarezerwowany/);
});

test('limit po podglądzie daje rzeczywiste 422, wpisy administratora są własnymi', async ({
  page,
  data,
  request,
}) => {
  await login(page);
  await goToWeek(page, data.date);
  for (const startHour of [7, 8, 9]) {
    expect(
      (
        await request.post('/api/bookings', {
          data: {
            roomId: data.rooms[0]!.id,
            studentId: data.studentId,
            date: data.date,
            startHour,
            durationSlots: 1,
          },
        })
      ).status(),
    ).toBe(201);
  }
  await openBooking(page, data.date, 13, 1);
  const response = page.waitForResponse(
    (r) =>
      new URL(r.url()).pathname === '/api/bookings' &&
      r.request().method() === 'POST',
  );
  await page
    .getByRole('button', { name: 'Potwierdź rezerwację', exact: true })
    .click();
  const result = await response;
  expect(result.status()).toBe(422);
  expect(
    ((await result.json()) as { error: { code: string } }).error.code,
  ).toBe('BOOKING_LIMIT');
  await expect(
    page
      .getByRole('alert')
      .filter({ hasText: 'Osiągnięto limit trzech przyszłych rezerwacji.' }),
  ).toBeVisible();
  await page
    .getByRole('navigation')
    .getByRole('link', { name: 'Moje rezerwacje' })
    .click();
  await expect(page.locator('tr[data-booking-id]')).toHaveCount(3);
  await expect(page.locator('tr[data-booking-id]').first()).toContainText(
    'Administrator',
  );
});

test('wylogowanie wymaga 204, Back i reload nie ujawniają poprzedniej listy', async ({
  page,
  data,
  request,
}) => {
  const created = await request.post('/api/bookings', {
    data: {
      roomId: data.rooms[0]!.id,
      studentId: data.studentId,
      date: data.date,
      startHour: 16,
      durationSlots: 1,
    },
  });
  expect(created.status()).toBe(201);
  const booking = (await created.json()) as BookingDto;
  await login(page);
  await page
    .getByRole('navigation')
    .getByRole('link', { name: 'Moje rezerwacje' })
    .click();
  await expect(
    page.locator(`tr[data-booking-id="${booking.id}"]`),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Włącz ciemny motyw' }).click();
  // Uzupełniający błąd sieci; ścieżka sukcesu nadal używa prawdziwego API.
  await page.route('**/api/auth/logout', (route) => route.abort('failed'));
  await page.getByRole('button', { name: 'Wyloguj', exact: true }).click();
  await expect(
    page
      .getByRole('alert')
      .filter({ hasText: 'Nie udało się połączyć z API.' }),
  ).toBeVisible();
  expect((await page.request.get('/api/auth/me')).status()).toBe(200);
  await expect(
    page.locator(`tr[data-booking-id="${booking.id}"]`),
  ).toBeVisible();
  await page.unroute('**/api/auth/logout');
  const response = page.waitForResponse((r) =>
    r.url().endsWith('/api/auth/logout'),
  );
  await page.getByRole('button', { name: 'Wyloguj', exact: true }).click();
  expect((await response).status()).toBe(204);
  await expect(
    page.getByRole('button', { name: 'Zaloguj', exact: true }),
  ).toBeVisible();
  await page.goBack();
  await page.reload();
  await expect(
    page.getByRole('button', { name: 'Zaloguj', exact: true }),
  ).toBeVisible();
  await expect(page.locator('tr[data-booking-id]')).toHaveCount(0);
  expect((await page.request.get('/api/auth/me')).status()).toBe(401);
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  expect(await page.evaluate(() => Object.keys(localStorage))).toEqual([
    'roombook-theme',
  ]);
  await login(page, 'jan.kowalski@roombook.test');
  await page
    .getByRole('navigation')
    .getByRole('link', { name: 'Moje rezerwacje' })
    .click();
  await expect(page.locator(`tr[data-booking-id="${booking.id}"]`)).toHaveCount(
    0,
  );
});

test('401 podczas pracy usuwa dane i pokazuje wygaśnięcie sesji', async ({
  page,
}) => {
  await login(page);
  await expect(page.locator('.calendar-table td')).toHaveCount(80);
  await page.context().clearCookies();
  const response = page.waitForResponse(
    (r) => new URL(r.url()).pathname.startsWith('/api/') && r.status() === 401,
  );
  await page
    .getByRole('button', { name: 'Odśwież kalendarz', exact: true })
    .click();
  await response;
  await expect(
    page.getByRole('button', { name: 'Zaloguj', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('status').filter({ hasText: 'Sesja wygasła.' }),
  ).toBeVisible();
  await expect(page.locator('.calendar-table')).toHaveCount(0);
});

test('błąd sprawdzania sesji oraz nieprawidłowy odczyt mają ponowienie', async ({
  page,
}) => {
  await page.route('**/api/auth/me', (route) =>
    route.fulfill({
      status: 503,
      contentType: 'text/html',
      body: '<html>private-service-path</html>',
    }),
  );
  await page.goto('/#UI-02');
  await expect(
    page.getByRole('button', { name: 'Ponów sprawdzenie sesji' }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Zaloguj', exact: true }),
  ).toHaveCount(0);
  await expect(page.getByText('private-service-path')).toHaveCount(0);
  await page.unroute('**/api/auth/me');
  await page.getByRole('button', { name: 'Ponów sprawdzenie sesji' }).click();
  await expect(
    page.getByRole('button', { name: 'Zaloguj', exact: true }),
  ).toBeVisible();
  await page.route('**/api/rooms', (route) =>
    route.fulfill({ status: 200, json: { unexpected: true } }),
  );
  await login(page);
  await expect(
    page.getByRole('button', { name: 'Ponów odczyt sal' }),
  ).toBeVisible();
  await expect(page.locator('.calendar-table')).toHaveCount(0);
  await page.unroute('**/api/rooms');
  await page.getByRole('button', { name: 'Ponów odczyt sal' }).click();
  await expect(page.locator('.calendar-table td')).toHaveCount(80);
});

test('sala dezaktywowana po podglądzie: odmowa i ponowny odczyt sal', async ({
  page,
  data,
  request,
}) => {
  await login(page);
  await goToWeek(page, data.date);
  await openBooking(page, data.date, 17, 1);
  const room = data.rooms[0]!;
  const preview = await request.get(
    `/api/admin/rooms/${room.id}/deactivation-preview`,
  );
  expect(preview.status()).toBe(200);
  const impact = (await preview.json()) as {
    expectedCancellationIds: number[];
    confirmationToken: string;
  };
  expect(
    (
      await request.patch(`/api/admin/rooms/${room.id}`, {
        data: {
          isActive: false,
          confirmed: true,
          expectedCancellationIds: impact.expectedCancellationIds,
          confirmationToken: impact.confirmationToken,
        },
      })
    ).status(),
  ).toBe(200);
  const response = page.waitForResponse(
    (r) =>
      new URL(r.url()).pathname === '/api/bookings' &&
      r.request().method() === 'POST',
  );
  await page
    .getByRole('button', { name: 'Potwierdź rezerwację', exact: true })
    .click();
  expect((await response).status()).toBe(409);
  await expect(
    page.getByRole('alert').filter({ hasText: 'Sala jest nieaktywna.' }),
  ).toBeVisible();
  await expect(
    page.getByLabel('Aktywna sala').locator(`option[value="${room.id}"]`),
  ).toHaveCount(0);
});

test('podwójne zatwierdzenie wysyła tylko jeden zapis i zachowuje wynik w SQLite', async ({
  page,
  data,
}) => {
  await login(page);
  await goToWeek(page, data.date);
  await openBooking(page, data.date, 18, 1);
  let writes = 0;
  page.on('request', (r) => {
    if (new URL(r.url()).pathname === '/api/bookings' && r.method() === 'POST')
      writes++;
  });
  // Spowolnienie jednego prawdziwego żądania daje czas na drugie kliknięcie.
  await page.route('**/api/bookings', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 200));
    await route.continue();
  });
  await page
    .getByRole('button', { name: 'Potwierdź rezerwację', exact: true })
    .evaluate((button: HTMLButtonElement) => {
      button.click();
      button.click();
    });
  await expect(page.getByText(/Zapisano rezerwację #/)).toBeVisible();
  expect(writes).toBe(1);
  await page.reload();
  await page
    .getByRole('navigation')
    .getByRole('link', { name: 'Moje rezerwacje' })
    .click();
  const own = (await (
    await page.request.get('/api/bookings/mine')
  ).json()) as BookingDto[];
  const matches = own.filter(
    (row) =>
      row.date === data.date && row.startHour === 18 && row.status === 'ACTIVE',
  );
  expect(matches).toHaveLength(1);
  await expect(
    page.locator(`tr[data-booking-id="${matches[0]!.id}"]`),
  ).toBeVisible();
});
