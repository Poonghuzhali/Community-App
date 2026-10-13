const express = require('express');
const { asyncHandler, ApiError } = require('../../utils/errors');
const v = require('../../utils/validators');

function createNotificationRoutes({ notifications, authMw }) {
  const router = express.Router();
  const { requireAuth } = authMw;
  router.use(requireAuth);

  router.get(
    '/',
    asyncHandler(async (req, res) => {
      const data = await notifications.list(req.user.id, {
        limit: req.query.limit,
        unreadOnly: req.query.unread === 'true',
        type: req.query.type || null,
      });
      res.json({ success: true, data });
    })
  );

  router.get(
    '/unread-count',
    asyncHandler(async (req, res) => {
      res.json({ success: true, data: { count: await notifications.unreadCount(req.user.id) } });
    })
  );

  router.post(
    '/:id/read',
    asyncHandler(async (req, res) => {
      const ok = await notifications.markRead(req.params.id, req.user.id);
      if (!ok) throw ApiError.notFound('Notification not found or already read');
      res.json({ success: true, data: { id: req.params.id, read: true } });
    })
  );

  router.post(
    '/read-all',
    asyncHandler(async (req, res) => {
      const count = await notifications.markAllRead(req.user.id);
      res.json({ success: true, data: { updated: count } });
    })
  );

  return router;
}

module.exports = { createNotificationRoutes, v };
