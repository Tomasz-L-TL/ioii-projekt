import type { RequestHandler } from 'express';
import { ApiError } from '../http/errors.js';
import type { AuthService, Role, UserDto } from './service.js';
import { readSessionCookie } from './session.js';

declare module 'express-serve-static-core' {
  interface Locals {
    user?: UserDto;
  }
}

export const requireAuth =
  (auth: AuthService): RequestHandler =>
  async (req, res, next) => {
    const token = readSessionCookie(req);
    const user = token ? await auth.authenticate(token) : null;
    if (!user)
      throw new ApiError(401, 'UNAUTHENTICATED', 'Wymagane zalogowanie.');
    res.locals.user = user;
    next();
  };

export const requireRole =
  (role: Role): RequestHandler =>
  (_req, res, next) => {
    if (!res.locals.user)
      throw new ApiError(401, 'UNAUTHENTICATED', 'Wymagane zalogowanie.');
    if (res.locals.user.role !== role)
      throw new ApiError(403, 'FORBIDDEN', 'Brak uprawnień.');
    next();
  };

export const protectSessionMutation =
  (allowedOrigins: readonly string[], requireJson = true): RequestHandler =>
  (req, _res, next) => {
    // Same-site obejmuje też obcy port: Origin musi należeć do jawnej listy.
    const origin = req.get('origin');
    const site = req.get('sec-fetch-site');
    if (
      (origin && !allowedOrigins.includes(origin)) ||
      (site && !['same-origin', 'same-site', 'none'].includes(site)) ||
      (!origin && site && site !== 'none')
    ) {
      throw new ApiError(
        403,
        'UNTRUSTED_ORIGIN',
        'Niedozwolone źródło żądania.',
      );
    }
    if (requireJson && !req.is('application/json'))
      throw new ApiError(
        400,
        'EXPECTED_JSON',
        'Wymagany Content-Type application/json.',
      );
    next();
  };
