import {
  test,
  expect,
  login,
  goToWeek,
  slot,
  openBooking,
  saveBooking,
} from './fixtures';

test('bez sesji bezpośrednie hashe nie ujawniają danych, motyw pozostaje', async ({
  page,
}) => {
  const reads: string[] = [];
  page.on('request', (request) => {
    const path = new URL(request.url()).pathname;
    if (path.startsWith('/api/')) reads.push(path);
  });
  for (const hash of ['UI-02', 'UI-03', 'UI-04', 'UI-07']) {
    await page.goto(`/#${hash}`);
    await expect(
      page.getByRole('button', { name: 'Zaloguj', exact: true }),
    ).toBeVisible();
    await expect(page.locator('.calendar-table')).toHaveCount(0);
    await expect(page.getByRole('navigation').getByRole('link')).toHaveCount(0);
  }
  expect((await page.request.get('/api/auth/me')).status()).toBe(401);
  expect(reads.every((path) => path === '/api/auth/me')).toBe(true);
  await page.getByRole('button', { name: 'Włącz ciemny motyw' }).click();
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  expect(await page.evaluate(() => Object.keys(localStorage))).toEqual([
    'roombook-theme',
  ]);
  expect(await page.evaluate(() => Object.keys(sessionStorage))).toEqual([]);
});

test('błędny login, prawdziwa sesja po reload, historia i ochrona roli', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByLabel('Login / e-mail').fill('anna.nowak@roombook.test');
  await page
    .getByLabel('Hasło', { exact: true })
    .fill('incorrect-test-password');
  await page.getByRole('button', { name: 'Zaloguj', exact: true }).click();
  await expect(
    page
      .getByRole('alert')
      .filter({ hasText: 'Nieprawidłowy e-mail lub hasło.' }),
  ).toBeVisible();
  await expect(page.getByLabel('Hasło', { exact: true })).toHaveValue('');
  const adminRequests: string[] = [];
  page.on('request', (r) => {
    if (new URL(r.url()).pathname.startsWith('/api/admin'))
      adminRequests.push(r.url());
  });
  await login(page);
  await page.reload();
  await expect(page.locator('.calendar-table td')).toHaveCount(80);
  const cookies = await page.context().cookies();
  const session = cookies.find((cookie) => cookie.name === 'roombook_session');
  expect(session?.httpOnly).toBe(true);
  expect(session?.path).toBe('/api');
  await page
    .getByRole('navigation')
    .getByRole('link', { name: 'Moje rezerwacje' })
    .click();
  await expect(page.locator('.page-heading h2')).toBeFocused();
  await page.goBack();
  await expect(page.locator('.page-heading h2')).toHaveText(
    'Kalendarz studenta',
  );
  for (const hash of ['UI-04', 'UI-05', 'UI-06', 'UI-07', 'UI-01']) {
    await page.evaluate((hash) => {
      window.location.hash = hash;
    }, hash);
    await expect(page).toHaveURL(/#UI-02$/);
    await expect(page.locator('.page-heading h2')).toHaveText(
      'Kalendarz studenta',
    );
    await expect(page.getByLabel('Hasło', { exact: true })).toHaveCount(0);
  }
  expect(adminRequests).toEqual([]);
  expect((await page.request.get('/api/admin/bookings')).status()).toBe(403);
});

test('kalendarz 5 × 16, prawdziwe stany, sale i czytanie poza horyzontem', async ({
  page,
  data,
  request,
  jan,
}) => {
  const room = data.rooms[0]!;
  expect(
    (
      await jan.post('/api/bookings', {
        data: {
          roomId: room.id,
          date: data.date,
          startHour: 7,
          durationSlots: 1,
        },
      })
    ).status(),
  ).toBe(201);
  const preview = await request.get('/api/admin/blocks/preview', {
    params: {
      roomId: room.id,
      date: data.date,
      startHour: 8,
      durationSlots: 2,
    },
  });
  expect(preview.status()).toBe(200);
  const impact = (await preview.json()) as {
    expectedCancellationIds: number[];
    confirmationToken: string;
  };
  expect(
    (
      await request.post('/api/admin/blocks', {
        data: {
          roomId: room.id,
          date: data.date,
          startHour: 8,
          durationSlots: 2,
          confirmed: true,
          expectedCancellationIds: impact.expectedCancellationIds,
          confirmationToken: impact.confirmationToken,
        },
      })
    ).status(),
  ).toBe(201);
  await login(page);
  await goToWeek(page, data.date);
  await expect(page.getByLabel('Aktywna sala').locator('option')).toHaveCount(
    data.rooms.length,
  );
  await expect(page.locator('.calendar-table tbody tr')).toHaveCount(16);
  await expect(slot(page, data.date, 7)).toHaveAccessibleName(/Zarezerwowany/);
  await expect(slot(page, data.date, 8)).toHaveAccessibleName(/Zablokowany/);
  await page.getByLabel('Czas zajęć').selectOption('2');
  await expect(slot(page, data.date, 22)).toBeDisabled();
  await slot(page, data.date, 10).click();
  await expect(page.locator('td.selected')).toHaveCount(2);
  await page.getByLabel('Aktywna sala').selectOption(String(data.rooms[1]!.id));
  await expect(page.locator('td.selected')).toHaveCount(0);
  await expect(slot(page, data.date, 7)).toHaveAccessibleName(/Wolny/);
  for (let n = 0; n < 4; n++)
    await page.getByRole('button', { name: 'Następny tydzień' }).click();
  await expect(page.locator('.calendar-table td')).toHaveCount(80);
  await expect(
    page.getByText('Terminy przeszłe i poza horyzontem', { exact: false }),
  ).toBeVisible();
  await expect(page.locator('.calendar-table td button:enabled')).toHaveCount(
    0,
  );
  for (let n = 0; n < 6; n++)
    await page.getByRole('button', { name: 'Poprzedni tydzień' }).click();
  await expect(page.locator('td[data-status="PAST"]')).toHaveCount(80);
});

test('klawiatura: login, 45/90 min, potwierdzenie, anulowanie i wolny termin', async ({
  page,
  data,
  jan,
}) => {
  await login(page, undefined, true);
  await goToWeek(page, data.date);
  await openBooking(page, data.date, 11, 1, true);
  await expect(
    page.getByRole('button', { name: 'Wróć', exact: true }),
  ).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(
    page.getByRole('button', { name: 'Potwierdź rezerwację', exact: true }),
  ).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(
    page.getByRole('button', { name: 'Wróć', exact: true }),
  ).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Zarezerwuj termin' }),
  ).toBeFocused();
  await page.keyboard.press('Enter');
  const first = await saveBooking(page, true);
  await expect(slot(page, data.date, 11)).toHaveAccessibleName(/Zarezerwowany/);
  await openBooking(page, data.date, 14, 2, true);
  const second = await saveBooking(page, true);
  await expect(slot(page, data.date, 15)).toHaveAccessibleName(/Zarezerwowany/);
  const own = (await (await page.request.get('/api/bookings/mine')).json()) as {
    id: number;
  }[];
  expect(
    own.filter((row) => [first.id, second.id].includes(row.id)),
  ).toHaveLength(2);
  const others = (await (await jan.get('/api/bookings/mine')).json()) as {
    id: number;
  }[];
  expect(
    others.some((row) => row.id === first.id || row.id === second.id),
  ).toBe(false);
  const nav = page
    .getByRole('navigation')
    .getByRole('link', { name: 'Moje rezerwacje' });
  await nav.focus();
  await page.keyboard.press('Enter');
  const cancel = page
    .locator(`tr[data-booking-id="${first.id}"]`)
    .getByRole('button', { name: 'Anuluj', exact: true });
  await cancel.focus();
  await page.keyboard.press('Enter');
  await page.keyboard.press('Escape');
  await expect(cancel).toBeFocused();
  await page.keyboard.press('Enter');
  await page.keyboard.press('Shift+Tab');
  const response = page.waitForResponse(
    (r) =>
      r.url().endsWith(`/api/bookings/${first.id}/cancel`) &&
      r.request().method() === 'POST',
  );
  await page.keyboard.press('Enter');
  expect((await response).status()).toBe(200);
  const row = page.locator(`tr[data-booking-id="${first.id}"]`);
  await expect(row).toContainText('CANCELLED');
  await row.getByText('Historia anulowania', { exact: true }).focus();
  await page.keyboard.press('Space');
  await expect(row).toContainText('STUDENT_CANCELLED');
  await page.reload();
  await page.getByRole('button', { name: 'Anulowane', exact: true }).click();
  await expect(page.locator(`tr[data-booking-id="${first.id}"]`)).toContainText(
    'CANCELLED',
  );
  await page
    .getByRole('navigation')
    .getByRole('link', { name: 'Kalendarz' })
    .focus();
  await page.keyboard.press('Enter');
  await goToWeek(page, data.date);
  await expect(slot(page, data.date, 11)).toHaveAccessibleName(/Wolny/);
});

test('ADMIN widzi rzeczywiste dane i chronioną nawigację', async ({ page }) => {
  await login(page, 'admin@roombook.test');
  await expect(page.locator('[data-room-id]').first()).toBeVisible();
  for (const hash of ['UI-04', 'UI-05', 'UI-06', 'UI-07']) {
    await page.goto(`/#${hash}`);
    await expect(page.locator('.page-heading h2')).toBeVisible();
    await expect(page.locator('.prototype-info')).toHaveCount(0);
  }
  await page.getByRole('button', { name: 'Wyloguj', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Zaloguj', exact: true }),
  ).toBeVisible();
});

test('siedem ekranów według ról, 375/1280 px i oba motywy bez przewijania strony', async ({
  page,
}) => {
  test.setTimeout(90_000);
  for (const width of [375, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    for (const theme of ['light', 'dark']) {
      await page.goto('/');
      if ((await page.locator('html').getAttribute('data-theme')) !== theme)
        await page.getByRole('button', { name: /Włącz .* motyw/ }).click();
      await page.reload();
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
      for (const role of ['student', 'admin']) {
        await login(page, role === 'admin' ? 'admin@roombook.test' : undefined);
        for (const screen of role === 'admin'
          ? ['UI-04', 'UI-05', 'UI-06', 'UI-07']
          : ['UI-02', 'UI-03']) {
          await page.goto(`/#${screen}`);
          await expect(page.locator('.page-heading h2')).toBeVisible();
          if (screen === 'UI-04')
            await expect(page.locator('[data-room-id]').first()).toBeVisible();
          if (screen === 'UI-02' || screen === 'UI-06' || screen === 'UI-07')
            await expect(page.locator('.calendar-table td')).toHaveCount(80);
          await expect(page.locator('html')).toHaveAttribute(
            'data-theme',
            theme,
          );
          await page.reload();
          await expect(page.locator('.page-heading h2')).toBeVisible();
          await expect(page.locator('html')).toHaveAttribute(
            'data-theme',
            theme,
          );
          expect(
            await page.evaluate(
              () =>
                document.documentElement.scrollWidth <=
                document.documentElement.clientWidth,
            ),
            `${screen}, ${theme}, ${width}px`,
          ).toBe(true);
        }
        await page
          .getByRole('button', { name: 'Wyloguj', exact: true })
          .click();
        await expect(
          page.getByRole('button', { name: 'Zaloguj', exact: true }),
        ).toBeVisible();
        await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
        expect(
          await page.evaluate(
            () =>
              document.documentElement.scrollWidth <=
              document.documentElement.clientWidth,
          ),
        ).toBe(true);
      }
    }
  }
});
