import { Router, json } from 'express';
import type { AuthService } from '../auth/service.js';
import {
  requireAuth,
  requireRole,
  protectSessionMutation,
} from '../auth/middleware.js';
import { BookingService } from './service.js';
import { BookingReads } from './reads.js';
import { bookingInput, emptyInput, pathId } from './validation.js';
import { calendarDate, invalid } from './time.js';

export function bookingRouter(
  auth: AuthService,
  service: BookingService,
  reads: BookingReads,
  allowedOrigins: readonly string[],
) {
  const router = Router();
  const authenticated = requireAuth(auth);
  router.get('/rooms', authenticated, (req, res) => {
    if (Object.keys(req.query).length) invalid('Niedozwolone parametry.');
    return reads.rooms(res.locals.user!).then((rooms) => res.json(rooms));
  });
  router.get('/availability', authenticated, async (req, res) => {
    if (
      Object.keys(req.query).some(
        (key) => !['roomId', 'weekStart'].includes(key),
      )
    )
      invalid('Niedozwolone parametry.');
    const roomId = pathId(req.query.roomId);
    calendarDate(req.query.weekStart);
    res.json(
      await reads.availability(
        res.locals.user!,
        roomId,
        req.query.weekStart as string,
      ),
    );
  });
  router.get(
    '/bookings/mine',
    authenticated,
    requireRole('STUDENT'),
    async (req, res) => {
      if (Object.keys(req.query).length)
        invalid('Właściciel wynika wyłącznie z sesji.');
      res.json(await service.mine(res.locals.user!));
    },
  );
  const mutation = [
    protectSessionMutation(allowedOrigins),
    json({ limit: '4kb', strict: true, inflate: false }),
  ];
  router.post('/bookings', authenticated, ...mutation, async (req, res) => {
    if (Object.keys(req.query).length) invalid('Niedozwolone parametry.');
    const actor = res.locals.user!;
    res
      .status(201)
      .json(
        await service.createBooking(actor, bookingInput(req.body, actor.role)),
      );
  });
  router.post(
    '/bookings/:id/cancel',
    authenticated,
    requireRole('STUDENT'),
    ...mutation,
    async (req, res) => {
      if (Object.keys(req.query).length) invalid('Niedozwolone parametry.');
      const id = pathId(req.params.id);
      emptyInput(req.body);
      res.json(await service.cancelBooking(res.locals.user!, id));
    },
  );
  return router;
}
