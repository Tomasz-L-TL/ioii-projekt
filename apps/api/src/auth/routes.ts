import { Router } from 'express';
import { ApiError } from '../http/errors.js';
import { normalizeEmail } from './normalization.js';
import { validPasswordLength } from './password.js';
import type { AuthService } from './service.js';
import { requireAuth } from './middleware.js';
import {
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
  cookieOptions,
  createSessionToken,
  type SessionOptions,
} from './session.js';

function loginInput(body: unknown): { email: string; password: string } {
  if (
    typeof body !== 'object' ||
    body === null ||
    Array.isArray(body) ||
    !('email' in body) ||
    !('password' in body) ||
    Object.keys(body).some((key) => !['email', 'password'].includes(key)) ||
    typeof body.email !== 'string' ||
    typeof body.password !== 'string'
  ) {
    throw new ApiError(
      422,
      'INVALID_CREDENTIALS_INPUT',
      'Podaj poprawny e-mail i hasło.',
    );
  }
  const email = normalizeEmail(body.email);
  if (
    body.email.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email) ||
    !validPasswordLength(body.password)
  ) {
    throw new ApiError(
      422,
      'INVALID_CREDENTIALS_INPUT',
      'Podaj poprawny e-mail i hasło.',
    );
  }
  return { email, password: body.password };
}

export function authRouter(auth: AuthService, session: SessionOptions): Router {
  const router = Router();
  router.post('/login', async (req, res) => {
    const { email, password } = loginInput(req.body);
    const user = await auth.login(email, password);
    if (!user)
      throw new ApiError(
        401,
        'LOGIN_FAILED',
        'Nieprawidłowy e-mail lub hasło.',
      );
    res.cookie(SESSION_COOKIE, createSessionToken(user.id, session.secret), {
      ...cookieOptions(session),
      maxAge: SESSION_TTL_SECONDS * 1000,
    });
    res.json(user);
  });
  router.get('/me', requireAuth(auth), (_req, res) =>
    res.json(res.locals.user),
  );
  router.post('/logout', (_req, res) => {
    res.clearCookie(SESSION_COOKIE, cookieOptions(session));
    res.status(204).end();
  });
  return router;
}
