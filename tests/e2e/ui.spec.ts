import { expect, test } from '@playwright/test';

test('nawigacja podglądu, historia i trwały motyw bez sesji', async ({
  page,
}) => {
  const businessRequests: string[] = [];
  page.on('request', (request) => {
    if (new URL(request.url()).pathname.startsWith('/api/'))
      businessRequests.push(request.url());
  });
  await page.goto('/');
  await expect(page.getByLabel('Login / e-mail')).toHaveAttribute(
    'readonly',
    '',
  );
  await page.getByRole('link', { name: 'Podgląd studenta →' }).click();
  await page
    .getByRole('navigation')
    .getByRole('link', { name: 'Moje rezerwacje' })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Moje rezerwacje', exact: true }),
  ).toBeFocused();
  await page.goBack();
  await expect(
    page.getByRole('heading', { name: 'Kalendarz studenta', exact: true }),
  ).toBeVisible();
  await page.getByLabel('Tryb podglądu').selectOption('admin');
  await expect(
    page.getByRole('heading', { name: 'Zarządzanie salami', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Włącz ciemny motyw' }).click();
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  expect(await page.evaluate(() => Object.keys(localStorage))).toEqual([
    'roombook-theme',
  ]);
  expect(businessRequests).toEqual([]);
});

test('kalendarz 5 × 16, dwa sloty i dialog obsługiwany klawiaturą', async ({
  page,
}) => {
  await page.goto('/#UI-02');
  await expect(page.locator('.calendar-table tbody tr')).toHaveCount(16);
  await expect(page.locator('.calendar-table tbody td')).toHaveCount(80);
  await expect(page.locator('td.reserved')).toHaveCount(2);
  await expect(
    page.getByLabel('Aktywna sala').locator('option[value="C-302"]'),
  ).toHaveCount(0);
  const slot = page.getByRole('button', {
    name: 'Czwartek, 22.10.2026, 14:00: Wolny',
    exact: true,
  });
  await slot.focus();
  await page.keyboard.press('Space');
  await expect(page.locator('td.selected')).toHaveCount(2);
  await expect(
    page.getByRole('button', { name: /Piątek, 23.10.2026, 22:00:/ }),
  ).toBeDisabled();
  const preview = page.getByRole('button', {
    name: 'Podgląd potwierdzenia',
    exact: true,
  });
  await preview.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Shift+Tab');
  await expect(
    page.getByRole('button', { name: 'Potwierdź — tylko podgląd' }),
  ).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(
    page.getByRole('button', { name: 'Zamknij panel' }),
  ).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(preview).toBeFocused();
  await page.getByLabel('Czas zajęć').selectOption('45');
  await page
    .getByRole('button', {
      name: 'Piątek, 23.10.2026, 22:00: Wolny',
      exact: true,
    })
    .click();
  await expect(page.locator('td.selected')).toHaveCount(1);
  await expect(page.locator('.summary-card')).toContainText('22:00–22:45');
});

test('siedem ekranów w obu motywach przy 375 i 1280 px bez przewijania strony w poziomie', async ({
  page,
}) => {
  for (const width of [375, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    for (const theme of ['light', 'dark']) {
      await page.goto('/');
      if ((await page.locator('html').getAttribute('data-theme')) !== theme)
        await page.getByRole('button', { name: /Włącz .* motyw/ }).click();
      for (let index = 1; index <= 7; index++) {
        await page.goto(`/#UI-0${index}`);
        await expect(page.locator('.page-heading h2')).toBeVisible();
        await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= window.innerWidth,
          ),
          `UI-0${index}, ${theme}, ${width}px`,
        ).toBe(true);
      }
    }
  }
});
