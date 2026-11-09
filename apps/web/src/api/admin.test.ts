import { afterEach, expect, it, vi } from 'vitest';
import { createApi, isImpact } from './index';

afterEach(() => vi.unstubAllGlobals());
const room = {
  id: 1,
  roomNumber: 'A',
  capacity: 4,
  name: null,
  description: 'Opis',
  isActive: false,
};
const impact = {
  roomId: 1,
  cancellationCount: 2,
  expectedCancellationIds: [3, 8],
  confirmationToken: 'opaque.signature',
};
const api = () => createApi(new AbortController().signal, vi.fn());
const signal = () => new AbortController().signal;

it('odrzuca podgląd z niezgodną liczbą, duplikatem lub nieuporządkowanymi ID', () => {
  expect(isImpact(impact)).toBe(true);
  for (const changes of [
    { cancellationCount: 1 },
    { expectedCancellationIds: [3, 3] },
    { expectedCancellationIds: [8, 3] },
    { confirmationToken: '' },
  ])
    expect(isImpact({ ...impact, ...changes })).toBe(false);
  expect(
    isImpact({ ...impact, cancellationCount: 0, expectedCancellationIds: [] }),
  ).toBe(true);
});
it('PATCH przekazuje dokładny token i ID z podglądu, bez dodatkowego GET ani ponowienia', async () => {
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(Response.json(impact))
    .mockResolvedValueOnce(Response.json(room));
  vi.stubGlobal('fetch', fetch);
  const client = api();
  const preview = await client.deactivationPreview(1, signal());
  await client.saveRoom(
    1,
    {
      isActive: false,
      confirmed: true,
      expectedCancellationIds: preview.expectedCancellationIds,
      confirmationToken: preview.confirmationToken,
    },
    signal(),
  );
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(fetch.mock.calls[1]?.[1]).toMatchObject({
    method: 'PATCH',
    credentials: 'same-origin',
  });
  expect(JSON.parse(fetch.mock.calls[1]?.[1].body)).toEqual({
    isActive: false,
    confirmed: true,
    expectedCancellationIds: [3, 8],
    confirmationToken: 'opaque.signature',
  });
});
it('DELETE blokady nie wysyła body ani Content-Type', async () => {
  const fetch = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
  vi.stubGlobal('fetch', fetch);
  await api().deleteBlock(5, signal());
  expect(fetch.mock.calls[0]?.[0]).toBe('/api/admin/blocks/5');
  expect(fetch.mock.calls[0]?.[1]).toMatchObject({ method: 'DELETE' });
  expect(fetch.mock.calls[0]?.[1]).not.toHaveProperty('body');
  expect(fetch.mock.calls[0]?.[1]).not.toHaveProperty('headers');
});
it('podgląd koduje powód blokady jako jeden parametr kontraktu', async () => {
  const fetch = vi.fn().mockResolvedValue(Response.json(impact));
  vi.stubGlobal('fetch', fetch);
  await api().blockPreview(
    {
      roomId: 1,
      date: '2026-11-10',
      startHour: 21,
      durationSlots: 2,
      reason: 'Remont & próba?',
    },
    signal(),
  );
  const url = new URL(fetch.mock.calls[0]?.[0], 'http://test');
  expect(url.searchParams.get('reason')).toBe('Remont & próba?');
  expect([...url.searchParams.keys()].sort()).toEqual([
    'date',
    'durationSlots',
    'reason',
    'roomId',
    'startHour',
  ]);
});
it('PREVIEW_STALE i 403 nie wywołują automatycznych zapisów lub podglądów', async () => {
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(
      Response.json(
        { error: { code: 'PREVIEW_STALE', message: 'Podgląd nieaktualny' } },
        { status: 409 },
      ),
    )
    .mockResolvedValueOnce(
      Response.json(
        { error: { code: 'FORBIDDEN', message: 'Brak uprawnień' } },
        { status: 403 },
      ),
    );
  vi.stubGlobal('fetch', fetch);
  const client = api();
  await expect(
    client.saveRoom(
      1,
      {
        isActive: false,
        confirmed: true,
        expectedCancellationIds: [3, 8],
        confirmationToken: impact.confirmationToken,
      },
      signal(),
    ),
  ).rejects.toMatchObject({ code: 'PREVIEW_STALE' });
  await expect(client.bookings(signal())).rejects.toMatchObject({
    status: 403,
  });
  expect(fetch).toHaveBeenCalledTimes(2);
});
