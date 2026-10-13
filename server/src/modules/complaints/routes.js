const express = require('express');
const { asyncHandler } = require('../../utils/errors');
const { validate } = require('../../middleware/validate');
const { singleUpload } = require('../../middleware/upload');
const v = require('../../utils/validators');
const policy = require('./policy');

function createComplaintRoutes({ complaints, authMw }) {
  const router = express.Router();
  const { requireAuth, requireRole } = authMw;

  router.get(
    '/categories',
    requireAuth,
    asyncHandler(async (req, res) => {
      res.json({ success: true, data: await complaints.listCategories() });
    })
  );

  /** Create with an optional image (multipart field name: image). */
  router.post(
    '/',
    requireAuth,
    singleUpload('image'),
    validate(
      v.shape({
        title: v.str({ required: true, max: 140, label: 'Title' }),
        description: v.str({ required: true, min: 10, max: 2000, label: 'Description' }),
        categoryId: v.int({ required: true, min: 1, label: 'Category' }),
        priority: v.oneOf(['low', 'medium', 'high'], { fallback: 'medium', label: 'Priority' }),
      })
    ),
    asyncHandler(async (req, res) => {
      const input = { ...req.body, categoryId: Number(req.body.categoryId) };
      if (req.file) input.imageUrl = `/uploads/${req.file.filename}`;
      const complaint = await complaints.create(req.user, input);
      res.status(201).json({ success: true, data: complaint });
    })
  );

  router.get(
    '/',
    requireAuth,
    asyncHandler(async (req, res) => {
      const data = await complaints.listMine(req.user, {
        status: req.query.status, page: req.query.page, limit: req.query.limit,
      });
      res.json({ success: true, data });
    })
  );

  /** Admin/security: every complaint in the community. */
  router.get(
    '/all',
    requireAuth,
    requireRole('admin', 'security'),
    asyncHandler(async (req, res) => {
      const data = await complaints.listAll({
        status: req.query.status,
        categoryId: req.query.categoryId ? Number(req.query.categoryId) : null,
        q: req.query.q,
        page: req.query.page,
        limit: req.query.limit,
      });
      res.json({ success: true, data });
    })
  );

  router.get(
    '/:id',
    requireAuth,
    asyncHandler(async (req, res) => {
      const complaint = await complaints.get(req.params.id);
      policy.assertOwner(complaint, req.user);
      res.json({ success: true, data: complaint });
    })
  );

  /** Admin: status transition + note, which notifies the resident. */
  router.patch(
    '/:id/status',
    requireAuth,
    requireRole('admin'),
    validate(
      v.shape({
        status: v.oneOf(policy.STATUSES, { required: true, label: 'Status' }),
        note: v.str({ max: 500, label: 'Note' }),
      })
    ),
    asyncHandler(async (req, res) => {
      const data = await complaints.updateStatus(req.params.id, req.user, req.body.status, req.body.note);
      res.json({ success: true, data });
    })
  );

  return router;
}

module.exports = { createComplaintRoutes };
