import type { ErrorRequestHandler } from 'express';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export const errorHandler: ErrorRequestHandler = (
  error: unknown,
  _req,
  res,
  _next,
) => {
  void _next; // Express rozpoznaje middleware błędów po czterech argumentach.
  if (error instanceof ApiError) {
    res
      .status(error.status)
      .json({ error: { code: error.code, message: error.message } });
    return;
  }
  const type =
    typeof error === 'object' && error !== null && 'type' in error
      ? error.type
      : undefined;
  if (type === 'entity.parse.failed') {
    res
      .status(400)
      .json({ error: { code: 'INVALID_JSON', message: 'Niepoprawny JSON.' } });
    return;
  }
  if (
    [
      'entity.too.large',
      'encoding.unsupported',
      'charset.unsupported',
      'request.aborted',
      'request.size.invalid',
    ].includes(String(type))
  ) {
    res.status(400).json({
      error: {
        code: 'INVALID_BODY',
        message: 'Niepoprawna lub zbyt duża treść żądania.',
      },
    });
    return;
  }
  res.status(500).json({
    error: { code: 'INTERNAL_ERROR', message: 'Wewnętrzny błąd serwera.' },
  });
};
