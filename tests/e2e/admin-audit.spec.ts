import { test, expect, login, slot } from './fixtures';
import type {
  BlockDto,
  BookingDto,
  ImpactDto,
} from '../../apps/web/src/api/types';
import { monday } from '../../apps/web/src/dates';

// Audyt ścieżek, których zwykły sukces operacji nie sprawdza.
test('blokada: nowa kolizja po podglądzie wymaga nowej zgody i wiąże zmieniony powód', async ({
  page,
  request,
  data,
}) => {
  const room = data.rooms[0]!;
  await login(page, 'admin@roombook.test');
  await page.getByRole('link', { name: 'Blokady sal', exact: true }).click();
  await page.getByLabel('Sala do blokady').selectOption(String(room.id));
  await page.getByLabel('Tydzień zawierający datę').fill(monday(data.date));
  await slot(page, data.date, 12).click();
  await page.getByLabel('Powód blokady (opcjonalnie)').fill('Pierwszy powód');
  await page.getByRole('button', { name: 'Podgląd skutków blokady' }).click();
  await expect(page.getByRole('dialog')).toContainText('do anulowania: 0');
  const bookingResponse = await request.post('/api/bookings', {
    data: {
      roomId: room.id,
      studentId: data.studentId,
      date: data.date,
      startHour: 12,
      durationSlots: 1,
    },
  });
  expect(bookingResponse.status()).toBe(201);
  const booking = (await bookingResponse.json()) as BookingDto;
  const failed = page.waitForResponse(
    (r) =>
      new URL(r.url()).pathname === '/api/admin/blocks' &&
      r.request().method() === 'POST',
  );
  await page
    .getByRole('button', { name: 'Potwierdź utworzenie blokady' })
    .click();
  expect((await failed).status()).toBe(409);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(
    page.getByRole('alert').filter({ hasText: 'nowy podgląd' }),
  ).toBeVisible();
  expect(await (await request.get('/api/admin/blocks')).json()).toEqual([]);
  await page
    .getByLabel('Powód blokady (opcjonalnie)')
    .fill('Nowy powód & kontrola');
  await slot(page, data.date, 12).click();
  const previewResponse = page.waitForResponse((r) =>
    r.url().includes('/blocks/preview?'),
  );
  await page.getByRole('button', { name: 'Podgląd skutków blokady' }).click();
  const preview = (await (await previewResponse).json()) as ImpactDto;
  await expect(page.getByRole('dialog')).toContainText('do anulowania: 1');
  await expect(page.getByRole('dialog')).toContainText('Nowy powód & kontrola');
  const saved = page.waitForResponse(
    (r) =>
      new URL(r.url()).pathname === '/api/admin/blocks' &&
      r.request().method() === 'POST',
  );
  await page
    .getByRole('button', { name: 'Potwierdź utworzenie blokady' })
    .click();
  const response = await saved;
  expect(response.status()).toBe(201);
  expect(response.request().postDataJSON()).toMatchObject({
    reason: 'Nowy powód & kontrola',
    confirmationToken: preview.confirmationToken,
    expectedCancellationIds: [booking.id],
  });
});

test('utrata odpowiedzi po rzeczywistym zapisie: ostrzeżenie, świeże dane i bez podwójnej mutacji', async ({
  page,
  data,
}) => {
  await login(page, 'admin@roombook.test');
  await page.getByRole('link', { name: 'Blokady sal', exact: true }).click();
  await page.getByLabel('Tydzień zawierający datę').fill(monday(data.date));
  await slot(page, data.date, 13).click();
  await page.getByRole('button', { name: 'Podgląd skutków blokady' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  let writes = 0;
  let savedId = 0;
  await page.route('**/api/admin/blocks', async (route) => {
    if (route.request().method() !== 'POST') {
      await route.fallback();
      return;
    }
    writes++;
    const response = await route.fetch();
    expect(response.status()).toBe(201);
    savedId = ((await response.json()) as BlockDto).id;
    await route.abort('connectionreset');
  });
  await page
    .getByRole('button', { name: 'Potwierdź utworzenie blokady' })
    .click();
  await expect(
    page.getByRole('alert').filter({ hasText: 'Wynik zapisu jest nieznany' }),
  ).toBeVisible();
  await expect(page.locator('[data-block-id]')).toHaveCount(1);
  await expect(page.locator('[data-block-id]')).toHaveAttribute(
    'data-block-id',
    String(savedId),
  );
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(writes).toBe(1);
});

test('ADMIN nie nadpisuje konfliktu studenta w innej sali po otwarciu potwierdzenia', async ({
  page,
  request,
  data,
}) => {
  await login(page, 'admin@roombook.test');
  await page
    .getByRole('link', { name: 'Rezerwacja dla studenta', exact: true })
    .click();
  await page.getByLabel('Aktywna sala').selectOption(String(data.rooms[0]!.id));
  await page
    .getByLabel('Student — właściciel')
    .selectOption(String(data.studentId));
  await page.getByLabel('Tydzień zawierający datę').fill(monday(data.date));
  await slot(page, data.date, 14).click();
  await page.getByRole('button', { name: 'Zarezerwuj dla studenta' }).click();
  const competing = await request.post('/api/bookings', {
    data: {
      roomId: data.rooms[1]!.id,
      studentId: data.studentId,
      date: data.date,
      startHour: 14,
      durationSlots: 1,
    },
  });
  expect(competing.status()).toBe(201);
  const failed = page.waitForResponse(
    (r) =>
      new URL(r.url()).pathname === '/api/bookings' &&
      r.request().method() === 'POST',
  );
  await page
    .getByRole('button', { name: 'Potwierdź rezerwację', exact: true })
    .click();
  expect((await failed).status()).toBe(409);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(
    page.getByRole('alert').filter({ hasText: /student|kolid|konflikt/i }),
  ).toBeVisible();
  const rows = (await (
    await request.get('/api/admin/bookings')
  ).json()) as BookingDto[];
  expect(
    rows.filter(
      (row) =>
        row.studentId === data.studentId &&
        row.date === data.date &&
        row.startHour === 14 &&
        row.status === 'ACTIVE',
    ),
  ).toHaveLength(1);
});

test('audyt wizualny: rzeczywiste widoki, brak błędów JS, desktop i telefon', async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await login(page, 'admin@roombook.test');
  for (const width of [1280, 375]) {
    await page.setViewportSize({ width, height: 900 });
    for (const [hash, label] of [
      ['UI-04', 'sale'],
      ['UI-05', 'rezerwacje'],
      ['UI-06', 'blokady'],
      ['UI-07', 'rezerwowanie'],
    ]) {
      await page.goto(`/#${hash}`);
      if (hash === 'UI-04')
        await expect(page.locator('[data-room-id]').first()).toBeVisible();
      if (hash === 'UI-05')
        await expect(
          page.getByRole('button', { name: 'Odśwież rezerwacje' }),
        ).toBeVisible();
      if (hash === 'UI-06' || hash === 'UI-07')
        await expect(page.locator('.calendar-table td')).toHaveCount(80);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);
      if (testInfo.project.name === 'chromium')
        await page.screenshot({
          path: testInfo.outputPath(`${label}-${width}.png`),
          fullPage: true,
        });
    }
  }
  expect(errors).toEqual([]);
});
