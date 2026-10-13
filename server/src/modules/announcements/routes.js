const express = require('express');
const { asyncHandler } = require('../../utils/errors');
const { validate } = require('../../middleware/validate');
const { singleUpload } = require('../../middleware/upload');
const v = require('../../utils/validators');
const { CATEGORIES } = require('./service');

const announcementSchema = v.shape({
  title: v.str({ required: true, max: 160, label: 'Title' }),
  body: v.str({ required: true, min: 5, max: 5000, label: 'Message' }),
  category: v.oneOf(CATEGORIES, { fallback: 'general', label: 'Category' }),
  is_pinned: v.bool({ fallback: false }),
  audience: v.oneOf(['all', 'resident', 'security', 'admin'], { fallback: 'all', label: 'Audience' }),
});

function createAnnouncementRoutes({ announcements, authMw }) {
  const router = express.Router();
  const { requireAuth, requireRole } = authMw;

  router.get(
    '/',
    requireAuth,
    asyncHandler(async (req, res) => {
      const data = await announcements.list(req.user, {
        category: req.query.category, page: req.query.page, limit: req.query.limit,
      });
      res.json({ success: true, data });
    })
  );

  router.get(
    '/:id',
    requireAuth,
    asyncHandler(async (req, res) => {
      res.json({ success: true, data: await announcements.get(req.params.id) });
    })
  );

  // ------------------------------------------------------------- Admin
  const adminRouter = express.Router();
  adminRouter.use(requireAuth, requireRole('admin'));

  adminRouter.post(
    '/',
    singleUpload('image'),
    validate(announcementSchema),
    asyncHandler(async (req, res) => {
      const input = { ...req.body, isPinned: req.body.is_pinned === true || req.body.is_pinned === 'true' };
      if (req.file) input.imageUrl = `/uploads/${req.file.filename}`;
      res.status(201).json({ success: true, data: await announcements.create(req.user, input) });
    })
  );

  adminRouter.patch(
    '/:id',
    validate(announcementSchema),
    asyncHandler(async (req, res) => {
      const patch = { ...req.body };
      if (patch.is_pinned !== undefined) patch.isPinned = patch.is_pinned === true || patch.is_pinned === 'true';
      res.json({ success: true, data: await announcements.update(req.params.id, patch) });
    })
  );

  adminRouter.delete(
    '/:id',
    asyncHandler(async (req, res) => {
      res.json({ success: true, data: await announcements.remove(req.params.id) });
    })
  );

  return { router, adminRouter };
}

module.exports = { createAnnouncementRoutes };
