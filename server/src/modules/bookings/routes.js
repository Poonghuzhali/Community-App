const express = require('express');
const { asyncHandler, ApiError } = require('../../utils/errors');
const { validate } = require('../../middleware/validate');
const v = require('../../utils/validators');

function createBookingRoutes({ bookings, authMw }) {
  const router = express.Router();
  const { requireAuth, requireRole } = authMw;

  router.get(
    '/amenities',
    requireAuth,
    asyncHandler(async (req, res) => {
      res.json({ success: true, data: await bookings.listAmenities() });
    })
  );

  /** Slots for one day: GET /bookings/slots?amenityId=1&date=2026-10-10 */
  router.get(
    '/slots',
    requireAuth,
    asyncHandler(async (req, res) => {
      const amenityId = Number(req.query.amenityId);
      const date = req.query.date;
      if (!amenityId || !date) throw ApiError.badRequest('amenityId and date are required');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw ApiError.badRequest('date must be YYYY-MM-DD');
      const data = await bookings.listSlots(amenityId, date, {
        viewerId: req.user.id,
        onlyAvailable: req.query.onlyAvailable === 'true',
      });
      res.json({ success: true, data });
    })
  );

  router.post(
    '/book',
    requireAuth,
    validate(
      v.shape({
        slotId: v.int({ required: true, min: 1, label: 'Slot' }),
        attendees: v.int({ min: 1, max: 50, fallback: 1, label: 'Attendees' }),
        notes: v.str({ max: 200, label: 'Notes' }),
      })
    ),
    asyncHandler(async (req, res) => {
      const booking = await bookings.book(req.user, Number(req.body.slotId), {
        attendees: Number(req.body.attendees) || 1,
        notes: req.body.notes || null,
      });
      res.status(201).json({ success: true, data: booking });
    })
  );

  router.get(
    '/',
    requireAuth,
    asyncHandler(async (req, res) => {
      const data = await bookings.history(req.user, {
        status: req.query.status, page: req.query.page, limit: req.query.limit,
      });
      res.json({ success: true, data });
    })
  );

  router.get(
    '/upcoming',
    requireAuth,
    asyncHandler(async (req, res) => {
      res.json({ success: true, data: await bookings.upcoming(req.user) });
    })
  );

  router.delete(
    '/:id',
    requireAuth,
    asyncHandler(async (req, res) => {
      res.json({ success: true, data: await bookings.cancel(req.user, req.params.id) });
    })
  );

  /** Admin helpers live under /admin/amenities (see admin routes). */
  return router;
}

function createAdminAmenityRoutes({ bookings, authMw }) {
  const router = express.Router();
  const { requireAuth, requireRole } = authMw;

  router.use(requireAuth, requireRole('admin'));

  router.post(
    '/:id/generate-slots',
    validate(
      v.shape({
        from: v.str({ required: true, max: 10, label: 'From date' }),
        to: v.str({ required: true, max: 10, label: 'To date' }),
      })
    ),
    asyncHandler(async (req, res) => {
      const data = await bookings.generateSlots(Number(req.params.id), req.body.from, req.body.to);
      res.json({ success: true, data });
    })
  );

  router.patch(
    '/slots/:slotId/block',
    validate(
      v.shape({
        blocked: v.bool({ fallback: true }),
        reason: v.str({ max: 120, label: 'Reason' }),
      })
    ),
    asyncHandler(async (req, res) => {
      const data = await bookings.blockSlot(Number(req.params.slotId), {
        blocked: req.body.blocked !== false,
        reason: req.body.reason,
      });
      res.json({ success: true, data });
    })
  );

  router.get(
    '/bookings',
    asyncHandler(async (req, res) => {
      const data = await bookings.listAllBookings({
        status: req.query.status,
        amenityId: req.query.amenityId ? Number(req.query.amenityId) : null,
        page: req.query.page,
        limit: req.query.limit,
      });
      res.json({ success: true, data });
    })
  );

  return router;
}

module.exports = { createBookingRoutes, createAdminAmenityRoutes };
