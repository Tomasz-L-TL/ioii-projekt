import { createHmac, timingSafeEqual } from 'node:crypto';
import type { CookieOptions, Request } from 'express';

export const SESSION_COOKIE = 'roombook_session';
export const SESSION_TTL_SECONDS = 8 * 60 * 60;
export type SessionOptions = { secret: Buffer; secure: boolean };

export function cookieOptions(session: SessionOptions): CookieOptions {
  return {
    httpOnly: true,
    sameSite: 'lax',
    path: '/api',
    secure: session.secure,
  };
}

function signature(payload: string, secret: Buffer): Buffer {
  return createHmac('sha256', secret).update(payload).digest();
}

export function createSessionToken(
  userId: number,
  secret: Buffer,
  now = Date.now(),
): string {
  const payload = Buffer.from(
    JSON.stringify({
      sub: userId,
      exp: Math.floor(now / 1000) + SESSION_TTL_SECONDS,
    }),
  ).toString('base64url');
  return `${payload}.${signature(payload, secret).toString('base64url')}`;
}

export function verifySessionToken(
  token: string,
  secret: Buffer,
  now = Date.now(),
): number | null {
  if (token.length > 512 || !/^[\w-]+\.[\w-]{43}$/u.test(token)) return null;
  const [payload, mac] = token.split('.');
  if (!payload || !mac) return null;
  const supplied = Buffer.from(mac, 'base64url');
  const expected = signature(payload, secret);
  if (
    supplied.length !== expected.length ||
    !timingSafeEqual(supplied, expected) ||
    supplied.toString('base64url') !== mac
  )
    return null;
  try {
    const data: unknown = JSON.parse(
      Buffer.from(payload, 'base64url').toString('utf8'),
    );
    if (
      typeof data !== 'object' ||
      data === null ||
      !('sub' in data) ||
      !('exp' in data)
    )
      return null;
    const { sub, exp } = data;
    if (
      typeof sub !== 'number' ||
      !Number.isSafeInteger(sub) ||
      sub < 1 ||
      sub > 2147483647 ||
      typeof exp !== 'number' ||
      !Number.isSafeInteger(exp) ||
      exp <= Math.floor(now / 1000) ||
      exp > Math.floor(now / 1000) + SESSION_TTL_SECONDS
    )
      return null;
    return sub;
  } catch {
    return null;
  }
}

export function readSessionCookie(req: Request): string | null {
  const matches = (req.headers.cookie ?? '')
    .split(';')
    .map((entry) => entry.trim())
    .filter((entry) => entry.startsWith(`${SESSION_COOKIE}=`));
  return matches.length === 1
    ? matches[0]!.slice(SESSION_COOKIE.length + 1)
    : null;
}
