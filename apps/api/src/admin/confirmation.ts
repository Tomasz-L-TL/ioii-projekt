import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { ApiError } from '../http/errors.js';

export function stale(): never {
  throw new ApiError(
    409,
    'PREVIEW_STALE',
    'Podgląd jest nieaktualny. Pobierz go ponownie i potwierdź skutki.',
  );
}

// Stały porządek pól kontekstu ustala usługa; token zawiera podpisany skrót
// pełnego kontekstu, aby nie powielać potencjalnie długiej listy ID w body.
export class ImpactConfirmation {
  private readonly key: Buffer;
  static readonly ttlMs = 5 * 60_000;

  constructor(secret: Buffer) {
    if (secret.length < 32) throw new Error('Niepoprawny sekret potwierdzeń.');
    this.key = createHmac('sha256', secret)
      .update('roombook:admin-impact:v1')
      .digest();
  }

  private binding(context: unknown) {
    return createHash('sha256').update(JSON.stringify(context)).digest('hex');
  }

  private sign(payload: string) {
    return createHmac('sha256', this.key).update(payload).digest();
  }

  issue(context: unknown, now: Date) {
    const payload = Buffer.from(
      JSON.stringify({
        version: 1,
        expiresAt: now.getTime() + ImpactConfirmation.ttlMs,
        binding: this.binding(context),
      }),
    ).toString('base64url');
    return `${payload}.${this.sign(payload).toString('base64url')}`;
  }

  verify(token: string, context: unknown, now: Date) {
    const invalid = () => {
      throw new ApiError(
        422,
        'INVALID_CONFIRMATION',
        'Niepoprawny token potwierdzenia.',
      );
    };
    if (!/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{43}$/u.test(token)) invalid();
    const [payload, signature] = token.split('.') as [string, string];
    const signed = Buffer.from(signature, 'base64url');
    if (
      signed.length !== 32 ||
      signed.toString('base64url') !== signature ||
      !timingSafeEqual(signed, this.sign(payload))
    )
      invalid();
    let data: unknown;
    try {
      data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    } catch {
      invalid();
    }
    if (
      !data ||
      typeof data !== 'object' ||
      !('version' in data) ||
      data.version !== 1 ||
      !('expiresAt' in data) ||
      typeof data.expiresAt !== 'number' ||
      !Number.isSafeInteger(data.expiresAt) ||
      !('binding' in data) ||
      typeof data.binding !== 'string'
    )
      return invalid();
    if (
      data.expiresAt <= now.getTime() ||
      data.binding !== this.binding(context)
    )
      stale();
  }
}
