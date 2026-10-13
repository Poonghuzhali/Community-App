const express = require('express');
const { asyncHandler } = require('../../utils/errors');
const { validate } = require('../../middleware/validate');
const v = require('../../utils/validators');

const eventSchema = v.shape({
  title: v.str({ required: true, max: 160, label: 'Title' }),
  description: v.str({ max: 4000, label: 'Description' }),
  venue: v.str({ max: 140, label: 'Venue' }),
  starts_at: v.isoDate({ required: true, label: 'Starts at' }),
  ends_at: v.isoDate({ label: 'Ends at' }),
  capacity: v.int({ min: 1, max: 10000, label: 'Capacity' }),
  registration_deadline: v.isoDate({ label: 'Registration deadline' }),
  image_url: v.str({ max: 500, label: 'Image URL' }),
});

function createEventRoutes({ events, authMw }) {
  const router = express.Router();
  const { requireAuth, requireRole } = authMw;

  router.get(
    '/',
    requireAuth,
    asyncHandler(async (req, res) => {
      const data = await events.list(req.user, {
        upcoming: req.query.upcoming !== 'false',
        page: req.query.page,
        limit: req.query.limit,
      });
      res.json({ success: true, data });
    })
  );

  router.get(
    '/mine',
    requireAuth,
    asyncHandler(async (req, res) => {
      res.json({ success: true, data: await events.myRegistrations(req.user) });
    })
  );

  router.get(
    '/:id',
    requireAuth,
    asyncHandler(async (req, res) => {
      res.json({ success: true, data: await events.get(req.params.id, req.user) });
    })
  );

  router.post(
    '/:id/register',
    requireAuth,
    asyncHandler(async (req, res) => {
      res.json({ success: true, data: await events.register(req.user, req.params.id, { register: true }) });
    })
  );

  router.post(
    '/:id/unregister',
    requireAuth,
    asyncHandler(async (req, res) => {
      res.json({ success: true, data: await events.register(req.user, req.params.id, { register: false }) });
    })
  );

  // ------------------------------------------------------------- Admin
  const adminRouter = express.Router();
  adminRouter.use(requireAuth, requireRole('admin'));

  adminRouter.post(
    '/',
    validate(eventSchema),
    asyncHandler(async (req, res) => {
      const input = {
        title: req.body.title,
        description: req.body.description,
        venue: req.body.venue,
        startsAt: req.body.starts_at,
        endsAt: req.body.ends_at,
        capacity: req.body.capacity ? Number(req.body.capacity) : null,
        registrationDeadline: req.body.registration_deadline,
        imageUrl: req.body.image_url,
      };
      res.status(201).json({ success: true, data: await events.create(req.user, input) });
    })
  );

  adminRouter.patch(
    '/:id/status',
    validate(v.shape({ status: v.oneOf(['draft', 'published', 'cancelled', 'completed'], { required: true, label: 'Status' }) })),
    asyncHandler(async (req, res) => {
      res.json({ success: true, data: await events.updateStatus(req.params.id, req.body.status) });
    })
  );

  return { router, adminRouter };
}

module.exports = { createEventRoutes };
