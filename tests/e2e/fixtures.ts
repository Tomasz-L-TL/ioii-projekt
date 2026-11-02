import {
  test as base,
  expect,
  type APIRequestContext,
  type Page,
} from '@playwright/test';
import type { BookingDto, RoomDto } from '../../apps/web/src/api/types';
import { addDays, monday, warsawToday } from '../../apps/web/src/dates';

export { expect };
export const studentEmail = 'anna.nowak@roombook.test';
export async function apiLogin(request: APIRequestContext, email: string) {
  const password = process.env.ROOMBOOK_E2E_PASSWORD;
  if (!password)
    throw new Error(
      'Uruchom E2E przez npm run test:e2e (izolowana baza i hasło).',
    );
  const response = await request.post('/api/auth/login', {
    data: { email, password },
  });
  expect(response.status()).toBe(200);
}
export async function login(
  page: Page,
  email = studentEmail,
  keyboard = false,
) {
  const password = process.env.ROOMBOOK_E2E_PASSWORD;
  if (!password) throw new Error('Brak konfiguracji runnera E2E.');
  await page.goto('/#UI-01');
  await expect(
    page.getByRole('button', { name: 'Zaloguj', exact: true }),
  ).toBeVisible();
  if (keyboard) {
    await page.getByLabel('Login / e-mail').focus();
    await page.keyboard.insertText(email);
    await page.keyboard.press('Tab');
    await page.keyboard.insertText(password);
    await page.keyboard.press('Enter');
  } else {
    await page.getByLabel('Login / e-mail').fill(email);
    await page.getByLabel('Hasło', { exact: true }).fill(password);
    await page.getByRole('button', { name: 'Zaloguj', exact: true }).click();
  }
  await expect(page.locator('.page-heading h2')).toHaveText(
    email === 'admin@roombook.test'
      ? 'Zarządzanie salami'
      : 'Kalendarz studenta',
  );
}
export async function goToWeek(page: Page, date: string) {
  const count = Math.round(
    (Date.parse(`${monday(date)}T12:00:00Z`) -
      Date.parse(`${monday()}T12:00:00Z`)) /
      604800000,
  );
  for (let index = 0; index < Math.abs(count); index++)
    await page
      .getByRole('button', {
        name: count > 0 ? 'Następny tydzień' : 'Poprzedni tydzień',
      })
      .click();
  await expect(page.locator('.calendar-table tbody td')).toHaveCount(80);
}
export const slot = (page: Page, date: string, hour: number) =>
  page.locator(`td[data-date="${date}"][data-hour="${hour}"] button`);
export async function openBooking(
  page: Page,
  date: string,
  hour: number,
  duration: 1 | 2,
  keyboard = false,
) {
  await page.getByLabel('Czas zajęć').selectOption(String(duration));
  const button = slot(page, date, hour);
  await expect(button).toBeEnabled();
  if (keyboard) {
    await button.focus();
    await page.keyboard.press('Space');
  } else await button.click();
  await expect(page.locator('td.selected')).toHaveCount(duration);
  const reserve = page.getByRole('button', { name: 'Zarezerwuj termin' });
  if (keyboard) {
    await reserve.focus();
    await page.keyboard.press('Enter');
  } else await reserve.click();
  await expect(page.getByRole('dialog')).toBeVisible();
}
export async function saveBooking(page: Page, keyboard = false) {
  const response = page.waitForResponse(
    (r) =>
      new URL(r.url()).pathname === '/api/bookings' &&
      r.request().method() === 'POST',
  );
  if (keyboard) {
    await page.keyboard.press('Shift+Tab');
    await expect(
      page.getByRole('button', { name: 'Potwierdź rezerwację', exact: true }),
    ).toBeFocused();
    await page.keyboard.press('Enter');
  } else
    await page
      .getByRole('button', { name: 'Potwierdź rezerwację', exact: true })
      .click();
  const result = await response;
  expect(result.status()).toBe(201);
  expect(Object.keys(result.request().postDataJSON()).sort()).toEqual([
    'date',
    'durationSlots',
    'roomId',
    'startHour',
  ]);
  const booking = (await result.json()) as BookingDto;
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(
    page
      .getByRole('status')
      .filter({ hasText: `Zapisano rezerwację #${booking.id}:` }),
  ).toBeVisible();
  return booking;
}

type Data = { rooms: RoomDto[]; date: string; studentId: number };
export const test = base.extend<{ data: Data; jan: APIRequestContext }>({
  data: [
    async ({ request }, use) => {
      await apiLogin(request, 'admin@roombook.test');
      // Jeden worker i odtworzenie stanu przez rzeczywiste API przed scenariuszem.
      const bookings = (await (
        await request.get('/api/admin/bookings')
      ).json()) as BookingDto[];
      for (const booking of bookings.filter((row) => row.canCancel))
        expect(
          (
            await request.post(`/api/bookings/${booking.id}/cancel`, {
              data: {},
            })
          ).status(),
        ).toBe(200);
      const blocks = (await (
        await request.get('/api/admin/blocks')
      ).json()) as { id: number }[];
      for (const block of blocks)
        expect(
          (await request.delete(`/api/admin/blocks/${block.id}`)).status(),
        ).toBe(204);
      // Test dezaktywacji może zostawić nieaktywną salę; przywracamy ją bez usuwania historii.
      const allRooms = (await (
        await request.get('/api/rooms')
      ).json()) as (RoomDto & { isActive: boolean })[];
      for (const room of allRooms.filter((row) => !row.isActive))
        expect(
          (
            await request.patch(`/api/admin/rooms/${room.id}`, {
              data: { isActive: true },
            })
          ).status(),
        ).toBe(200);
      const rooms = (await (
        await request.get('/api/rooms')
      ).json()) as RoomDto[];
      const students = (await (
        await request.get('/api/admin/students')
      ).json()) as { id: number; email: string }[];
      let date = addDays(warsawToday(), 1);
      while ([0, 6].includes(new Date(`${date}T12:00:00Z`).getUTCDay()))
        date = addDays(date, 1);
      await use({
        rooms,
        date,
        studentId: students.find((row) => row.email === studentEmail)!.id,
      });
    },
    { auto: true },
  ],
  jan: async ({ playwright, baseURL }, use) => {
    const context = await playwright.request.newContext({ baseURL });
    try {
      await apiLogin(context, 'jan.kowalski@roombook.test');
      await use(context);
    } finally {
      await context.dispose();
    }
  },
});
