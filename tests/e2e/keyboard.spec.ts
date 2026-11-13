import type { Locator, Page } from '@playwright/test';
import { test, expect, slot } from './fixtures';
import type { BookingDto } from '../../apps/web/src/api/types';
import { addDays, monday } from '../../apps/web/src/dates';

// Docieramy do kontrolek prawdziwym Tab. Bez locator.focus(), kliknięć,
// selectOption(), zmiany DOM czy wywoływania handlerów w evaluate().
async function tabTo(page: Page, target: Locator) {
  await expect(target).toBeVisible();
  await expect(target).toBeEnabled();
  const focusPath = new Set<string>();
  for (let i = 0; i < 220; i++) {
    if (
      await target.evaluate((element) => element === document.activeElement)
    ) {
      await expect(target).toBeFocused();
      expect(
        await target.evaluate((element) => {
          const style = getComputedStyle(element);
          return (
            element.matches(':focus-visible') &&
            style.outlineStyle !== 'none' &&
            parseFloat(style.outlineWidth) >= 2
          );
        }),
        'Widoczny fokus po Tab',
      ).toBe(true);
      return;
    }
    // Nie polegaj na zawijaniu Tab na końcu dokumentu w silniku headless.
    // Do wcześniejszego elementu wracamy rzeczywistym Shift+Tab.
    const key = await target.evaluate((element) =>
      document.activeElement !== document.body &&
      Boolean(
        element.compareDocumentPosition(document.activeElement!) &
        Node.DOCUMENT_POSITION_FOLLOWING,
      )
        ? 'Shift+Tab'
        : 'Tab',
    );
    await page.keyboard.press(key);
    focusPath.add(
      await page.evaluate(() => {
        const element = document.activeElement;
        return `${element?.tagName}:${element?.getAttribute('href') ?? ''}:${element?.getAttribute('type') ?? ''}`;
      }),
    );
  }
  throw new Error(
    `Kontrolka nieosiągalna przez Tab; odwiedzone: ${[...focusPath].join(', ')}.`,
  );
}
async function activate(page: Page, target: Locator) {
  await tabTo(page, target);
  await page.keyboard.press('Enter');
}
async function type(page: Page, target: Locator, text: string) {
  await tabTo(page, target);
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.insertText(text);
}
async function confirm(page: Page, label: string) {
  await expect(
    page.getByRole('button', { name: 'Wróć', exact: true }),
  ).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(
    page.getByRole('button', { name: label, exact: true }),
  ).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog')).toHaveCount(0);
}
async function chooseSlot(page: Page, date: string, hour: number) {
  const desired = monday(date);
  await expect(page.locator('.calendar-table td')).toHaveCount(80);
  const firstCell = page.locator('.calendar-table td').first();
  let current = (await firstCell.getAttribute('data-date'))!;
  for (let i = 0; i < 3 && current !== desired; i++) {
    const forward = current < desired;
    await activate(
      page,
      page.getByRole('button', {
        name: forward ? 'Następny tydzień' : 'Poprzedni tydzień',
      }),
    );
    current = addDays(current, forward ? 7 : -7);
    await expect(firstCell).toHaveAttribute('data-date', current);
    await expect(page.locator(`td[data-date="${current}"]`)).toHaveCount(16);
  }
  await expect(firstCell).toHaveAttribute('data-date', desired);
  await tabTo(page, slot(page, date, hour));
  await page.keyboard.press('Space');
}
async function keyboardLogin(page: Page, admin: boolean) {
  await page.goto('/');
  await type(
    page,
    page.getByLabel('Login / e-mail'),
    admin ? 'admin@roombook.test' : 'anna.nowak@roombook.test',
  );
  await page.keyboard.press('Tab');
  await expect(page.getByLabel('Hasło', { exact: true })).toBeFocused();
  const password = process.env.ROOMBOOK_E2E_PASSWORD;
  if (!password) throw new Error('Uruchom przez runner E2E.');
  await page.keyboard.insertText(password);
  await page.keyboard.press('Enter');
  await expect(page.locator('.page-heading h2')).toHaveText(
    admin ? 'Zarządzanie salami' : 'Kalendarz studenta',
  );
}

test('TC-24 STUDENT: pełna ścieżka samymi klawiszami i widoczny fokus', async ({
  page,
  data,
}) => {
  test.setTimeout(90_000);
  await keyboardLogin(page, false);
  await tabTo(page, page.getByLabel('Czas zajęć'));
  await page.keyboard.press('Home');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect(page.getByLabel('Czas zajęć')).toHaveValue('2');
  await chooseSlot(page, data.date, 10);
  await activate(
    page,
    page.getByRole('button', { name: 'Zarezerwuj termin', exact: true }),
  );
  await page.keyboard.press('Escape');
  await expect(
    page.getByRole('button', { name: 'Zarezerwuj termin', exact: true }),
  ).toBeFocused();
  await page.keyboard.press('Enter');
  const response = page.waitForResponse(
    (r) =>
      new URL(r.url()).pathname === '/api/bookings' &&
      r.request().method() === 'POST',
  );
  await confirm(page, 'Potwierdź rezerwację');
  expect((await response).status()).toBe(201);
  const booking = (await (await response).json()) as BookingDto;
  await activate(
    page,
    page.getByRole('link', { name: 'Moje rezerwacje', exact: true }),
  );
  const row = page.locator(`[data-booking-id="${booking.id}"]`);
  await activate(
    page,
    row.getByRole('button', { name: 'Anuluj', exact: true }),
  );
  await confirm(page, 'Potwierdź anulowanie');
  await expect(row).toContainText('CANCELLED');
  const own = (await (
    await page.request.get('/api/bookings/mine')
  ).json()) as BookingDto[];
  expect(own.find((b) => b.id === booking.id)).toMatchObject({
    status: 'CANCELLED',
    cancelReason: 'STUDENT_CANCELLED',
  });
  await activate(
    page,
    page.getByRole('button', { name: 'Wyloguj', exact: true }),
  );
  await expect(
    page.getByRole('button', { name: 'Zaloguj', exact: true }),
  ).toBeVisible();
  expect((await page.request.get('/api/auth/me')).status()).toBe(401);
});

test('TC-24 ADMIN: sale, aktywność, blokada, rezerwacja i logout samymi klawiszami', async ({
  page,
  data,
  request,
}) => {
  test.setTimeout(120_000);
  await keyboardLogin(page, true);
  const room = data.rooms[0]!;
  const row = page.locator(`[data-room-id="${room.id}"]`);
  await activate(
    page,
    row.getByRole('button', { name: 'Edytuj', exact: true }),
  );
  await expect(
    page.getByRole('heading', { name: 'Edycja sali' }),
  ).toBeFocused();
  await type(page, page.getByLabel('Liczba miejsc'), String(room.capacity + 1));
  await activate(
    page,
    page.getByRole('button', { name: 'Zapisz salę', exact: true }),
  );
  await expect(page.getByRole('heading', { name: 'Edycja sali' })).toHaveCount(
    0,
  );
  await activate(
    page,
    row.getByRole('button', { name: 'Podgląd dezaktywacji' }),
  );
  await expect(page.getByRole('dialog')).toContainText('do anulowania: 0');
  await page.keyboard.press('Escape');
  await expect(
    row.getByRole('button', { name: 'Podgląd dezaktywacji' }),
  ).toBeFocused();
  await page.keyboard.press('Enter');
  await confirm(page, 'Potwierdź dezaktywację');
  await expect(row).toContainText('Nieaktywna');
  await activate(
    page,
    row.getByRole('button', { name: 'Aktywuj', exact: true }),
  );
  await confirm(page, 'Potwierdź aktywację');
  await expect(
    row.getByRole('button', { name: 'Podgląd dezaktywacji' }),
  ).toBeVisible();
  await activate(
    page,
    page.getByRole('link', { name: 'Blokady sal', exact: true }),
  );
  await expect(page.locator('.page-heading h2')).toHaveText('Blokady sal');
  await chooseSlot(page, data.date, 10);
  await activate(
    page,
    page.getByRole('button', { name: 'Podgląd skutków blokady' }),
  );
  await expect(page.getByRole('dialog')).toContainText('do anulowania: 0');
  await confirm(page, 'Potwierdź utworzenie blokady');
  const blockRow = page.locator('[data-block-id]').first();
  await activate(page, blockRow.getByRole('button', { name: 'Usuń blokadę' }));
  await page.keyboard.press('Escape');
  await expect(
    blockRow.getByRole('button', { name: 'Usuń blokadę' }),
  ).toBeFocused();
  await page.keyboard.press('Enter');
  await confirm(page, 'Potwierdź usunięcie');
  await expect(page.locator('[data-block-id]')).toHaveCount(0);
  expect(await (await request.get('/api/admin/blocks')).json()).toEqual([]);
  await activate(
    page,
    page.getByRole('link', { name: 'Rezerwacja dla studenta', exact: true }),
  );
  await expect(page.locator('.page-heading h2')).toHaveText(
    'Rezerwacja w imieniu studenta',
  );
  await chooseSlot(page, data.date, 12);
  await activate(
    page,
    page.getByRole('button', { name: 'Zarezerwuj dla studenta', exact: true }),
  );
  await expect(page.getByRole('dialog')).toContainText('Właściciel:');
  await expect(page.getByRole('dialog')).toContainText('Inicjator:');
  const response = page.waitForResponse(
    (r) =>
      new URL(r.url()).pathname === '/api/bookings' &&
      r.request().method() === 'POST',
  );
  await confirm(page, 'Potwierdź rezerwację');
  expect((await response).status()).toBe(201);
  const booking = (await (await response).json()) as BookingDto;
  expect(booking.createdBy.role).toBe('ADMIN');
  expect(booking.createdBy.id).not.toBe(booking.studentId);
  await activate(
    page,
    page.getByRole('link', { name: 'Rezerwacje studentów', exact: true }),
  );
  const bookingRow = page.locator(`[data-booking-id="${booking.id}"]`);
  await activate(
    page,
    bookingRow.getByRole('button', { name: 'Anuluj rezerwację', exact: true }),
  );
  await confirm(page, 'Potwierdź anulowanie');
  const all = (await (
    await request.get('/api/admin/bookings')
  ).json()) as BookingDto[];
  expect(all.find((b) => b.id === booking.id)).toMatchObject({
    status: 'CANCELLED',
    cancelReason: 'ADMIN_CANCELLED',
  });
  await activate(
    page,
    page.getByRole('button', { name: 'Wyloguj', exact: true }),
  );
  await expect(
    page.getByRole('button', { name: 'Zaloguj', exact: true }),
  ).toBeVisible();
  expect((await page.request.get('/api/admin/bookings')).status()).toBe(401);
});
