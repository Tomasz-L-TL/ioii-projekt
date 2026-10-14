import { expect, test } from '@playwright/test';

test('wyświetla szkielet RoomBook i udostępnia API przez proxy', async ({
  page,
  request,
}) => {
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: 'RoomBook', level: 1 }),
  ).toBeVisible();
  await expect(
    page.getByText('Funkcje biznesowe nie są jeszcze dostępne.'),
  ).toBeVisible();

  const response = await request.get('/api/health');
  expect(response.status()).toBe(200);
  expect(await response.json()).toEqual({ status: 'ok' });
});
