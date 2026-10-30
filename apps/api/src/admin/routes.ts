import { Router, json } from 'express';
import type { AuthService } from '../auth/service.js';
import {
  protectSessionMutation,
  requireAuth,
  requireRole,
} from '../auth/middleware.js';
import { invalid } from '../bookings/time.js';
import { pathId } from '../bookings/validation.js';
import { fields } from './validation.js';
import type { AdminService } from './service.js';

export function adminRouter(
  auth: AuthService,
  service: AdminService,
  allowedOrigins: readonly string[],
) {
  const router = Router();
  router.use(requireAuth(auth), requireRole('ADMIN'));
  router.use((req, res, next) => {
    if (req.method !== 'GET') {
      return protectSessionMutation(allowedOrigins, req.method !== 'DELETE')(
        req,
        res,
        next,
      );
    }
    next();
  });
  router.use((req, _res, next) => {
    if (req.path !== '/blocks/preview' || req.method !== 'GET') {
      if (Object.keys(req.query).length) invalid('Niedozwolone parametry.');
    }
    next();
  });
  router.use(json({ limit: '4kb', strict: true, inflate: false }));
  router.get('/students', async (_req, res) =>
    res.json(await service.students(res.locals.user!)),
  );
  router.get('/bookings', async (_req, res) =>
    res.json(await service.bookings(res.locals.user!)),
  );
  router.post('/rooms', async (req, res) =>
    res.status(201).json(await service.createRoom(res.locals.user!, req.body)),
  );
  router.patch('/rooms/:id', async (req, res) =>
    res.json(
      await service.patchRoom(
        res.locals.user!,
        pathId(req.params.id),
        req.body,
      ),
    ),
  );
  router.get('/rooms/:id/deactivation-preview', async (req, res) =>
    res.json(
      await service.previewDeactivation(
        res.locals.user!,
        pathId(req.params.id),
      ),
    ),
  );
  router.get('/blocks', async (_req, res) =>
    res.json(await service.blocks(res.locals.user!)),
  );
  router.get('/blocks/preview', async (req, res) => {
    fields(req.query, [
      'roomId',
      'date',
      'startHour',
      'durationSlots',
      'reason',
    ]);
    if (
      typeof req.query.date !== 'string' ||
      ('reason' in req.query && typeof req.query.reason !== 'string')
    )
      invalid();
    res.json(
      await service.previewBlock(res.locals.user!, {
        roomId: pathId(req.query.roomId),
        date: req.query.date,
        startHour: pathId(req.query.startHour),
        durationSlots: pathId(req.query.durationSlots),
        ...('reason' in req.query ? { reason: req.query.reason } : {}),
      }),
    );
  });
  router.post('/blocks', async (req, res) =>
    res.status(201).json(await service.createBlock(res.locals.user!, req.body)),
  );
  router.delete('/blocks/:id', async (req, res) => {
    if (
      req.body !== undefined ||
      (req.get('content-length') && req.get('content-length') !== '0') ||
      req.get('transfer-encoding')
    )
      invalid('DELETE nie przyjmuje treści.');
    await service.deleteBlock(res.locals.user!, pathId(req.params.id));
    res.status(204).end();
  });
  return router;
}
