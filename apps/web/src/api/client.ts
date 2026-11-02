export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
export async function request<T>(
  path: string,
  decode: (value: unknown) => value is T,
  options: { signal: AbortSignal; body?: object; onUnauthorized?: () => void },
): Promise<T> {
  const signal = AbortSignal.any([options.signal, AbortSignal.timeout(15_000)]);
  let response: Response;
  let value: unknown;
  try {
    response = await fetch(`/api${path}`, {
      method: options.body === undefined ? 'GET' : 'POST',
      credentials: 'same-origin',
      signal,
      ...(options.body === undefined
        ? {}
        : {
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(options.body),
          }),
    });
    if (response.status === 401 && !options.signal.aborted)
      options.onUnauthorized?.();
    value =
      response.status === 204
        ? undefined
        : await response.json().catch(() => null);
  } catch {
    options.signal.throwIfAborted();
    throw new ApiError(
      0,
      'NETWORK_ERROR',
      'Nie udało się połączyć z API. Sprawdź połączenie i ponów odczyt.',
    );
  }
  options.signal.throwIfAborted();
  if (!response.ok) {
    const error = isRecord(value) && isRecord(value.error) ? value.error : null;
    throw new ApiError(
      response.status,
      typeof error?.code === 'string' ? error.code : 'INVALID_RESPONSE',
      typeof error?.message === 'string' && error.message.length <= 1000
        ? error.message
        : 'API nie mogło wykonać operacji. Spróbuj ponownie odczytać dane.',
    );
  }
  if (!decode(value))
    throw new ApiError(
      response.status,
      'INVALID_RESPONSE',
      'API zwróciło nieprawidłowe dane. Ponów odczyt.',
    );
  return value;
}
export function errorMessage(error: unknown) {
  return error instanceof ApiError
    ? error.message
    : 'Nie udało się odczytać danych. Spróbuj ponownie.';
}
