import express from 'express';
import { healthRouter } from './routes/health.js';
import { AuthService } from './auth/service.js';
import { authRouter } from './auth/routes.js';
import { protectSessionMutation } from './auth/middleware.js';
import type { SessionOptions } from './auth/session.js';
import type { PrismaClient } from './generated/prisma/client.js';
import { errorHandler } from './http/errors.js';
import { BookingService } from './bookings/service.js';
import { BookingReads } from './bookings/reads.js';
import { bookingRouter } from './bookings/routes.js';
import { adminRouter } from './admin/routes.js';
import { AdminService } from './admin/service.js';

export async function createApp(options: {
  db: PrismaClient;
  session: SessionOptions;
  allowedOrigins: readonly string[];
}) {
  const app = express();
  const auth = await AuthService.create(options.db, options.session.secret);
  app.disable('x-powered-by');
  app.use('/api', (_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });
  app.use('/api', healthRouter);
  app.use('/api/auth', (req, res, next) => {
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method))
      return protectSessionMutation(options.allowedOrigins)(req, res, next);
    next();
  });
  app.use(
    '/api/auth',
    express.json({ limit: '4kb', strict: true, inflate: false }),
    authRouter(auth, options.session),
  );
  app.use(
    '/api/admin',
    adminRouter(
      auth,
      new AdminService(options.db, options.session.secret),
      options.allowedOrigins,
    ),
  );
  app.use(
    '/api',
    bookingRouter(
      auth,
      new BookingService(options.db),
      new BookingReads(options.db),
      options.allowedOrigins,
    ),
  );
  app.use('/api', (_req, res) =>
    res.status(404).json({
      error: { code: 'NOT_FOUND', message: 'Nie znaleziono zasobu.' },
    }),
  );
  app.use(errorHandler);
  return { app, auth };
}
