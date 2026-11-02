import { afterEach, expect, it, vi } from 'vitest';
import { ApiError, request } from './client';
const isString = (v: unknown): v is string => typeof v === 'string';
afterEach(() => vi.unstubAllGlobals());
it('wysyła JSON i cookie na względny adres bez ręcznego Origin', async () => {
  const fetch = vi
    .fn()
    .mockResolvedValue(new Response('"ok"', { status: 201 }));
  vi.stubGlobal('fetch', fetch);
  await expect(
    request('/bookings', isString, {
      signal: new AbortController().signal,
      body: { roomId: 1 },
    }),
  ).resolves.toBe('ok');
  expect(fetch.mock.calls[0]?.[0]).toBe('/api/bookings');
  expect(fetch.mock.calls[0]?.[1]).toMatchObject({
    credentials: 'same-origin',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  expect(fetch.mock.calls[0]?.[1].headers).not.toHaveProperty('Origin');
});
it('obsługuje 204 bez parsowania pustego JSON', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(new Response(null, { status: 204 })),
  );
  await expect(
    request('/auth/logout', (v): v is undefined => v === undefined, {
      signal: new AbortController().signal,
      body: {},
    }),
  ).resolves.toBeUndefined();
});
it('zachowuje rzeczywisty kod i komunikat odmowy serwera', async () => {
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockResolvedValue(
        Response.json(
          { error: { code: 'SLOT_CONFLICT', message: 'Termin zajęty.' } },
          { status: 409 },
        ),
      ),
  );
  await expect(
    request('/bookings', isString, { signal: new AbortController().signal }),
  ).rejects.toMatchObject({
    status: 409,
    code: 'SLOT_CONFLICT',
    message: 'Termin zajęty.',
  });
});
it('nie ujawnia HTML ani nie przyjmuje nieprawidłowego DTO sukcesu', async () => {
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockResolvedValueOnce(
        new Response('<html>szczegóły środowiska</html>', { status: 502 }),
      )
      .mockResolvedValueOnce(Response.json({ wrong: true })),
  );
  await expect(
    request('/rooms', isString, { signal: new AbortController().signal }),
  ).rejects.toMatchObject({
    code: 'INVALID_RESPONSE',
    message: expect.not.stringContaining('szczegóły'),
  });
  await expect(
    request('/rooms', isString, { signal: new AbortController().signal }),
  ).rejects.toBeInstanceOf(ApiError);
});
it('401 unieważnia sesję, 403 jej nie kończy', async () => {
  const onUnauthorized = vi.fn();
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockResolvedValueOnce(new Response('', { status: 401 }))
      .mockResolvedValueOnce(new Response('', { status: 403 })),
  );
  for (let index = 0; index < 2; index++)
    await request('/rooms', isString, {
      signal: new AbortController().signal,
      onUnauthorized,
    }).catch(() => undefined);
  expect(onUnauthorized).toHaveBeenCalledTimes(1);
});
it('odrzuca spóźnioną odpowiedź poprzedniej sesji', async () => {
  const controller = new AbortController();
  const onUnauthorized = vi.fn();
  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation(async () => {
      controller.abort();
      return new Response('', { status: 401 });
    }),
  );
  await expect(
    request('/rooms', isString, { signal: controller.signal, onUnauthorized }),
  ).rejects.toMatchObject({ name: 'AbortError' });
  expect(onUnauthorized).not.toHaveBeenCalled();
});
it('błąd sieci daje czytelny komunikat i nie ponawia zapisu', async () => {
  const fetch = vi
    .fn()
    .mockRejectedValue(new TypeError('private network details'));
  vi.stubGlobal('fetch', fetch);
  await expect(
    request('/bookings', isString, {
      signal: new AbortController().signal,
      body: {},
    }),
  ).rejects.toMatchObject({ status: 0, code: 'NETWORK_ERROR' });
  expect(fetch).toHaveBeenCalledTimes(1);
});
