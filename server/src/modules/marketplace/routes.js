const express = require('express');
const { asyncHandler, ApiError } = require('../../utils/errors');
const { validate } = require('../../middleware/validate');
const { singleUpload } = require('../../middleware/upload');
const v = require('../../utils/validators');
const policy = require('./policy');

const createSchema = v.shape({
  title: v.str({ required: true, max: 140, label: 'Title' }),
  description: v.str({ required: true, min: 10, max: 2000, label: 'Description' }),
  category: v.oneOf(policy.CATEGORIES, { required: true, label: 'Category' }),
  price: v.num({ min: 0, max: 1000000, fallback: 0, label: 'Price' }),
  priceUnit: v.str({ max: 30, fallback: 'one-time', label: 'Price unit' }),
  contactPhone: v.phone({ label: 'Contact number' }),
});

function createMarketplaceRoutes({ marketplace, authMw }) {
  const router = express.Router();
  const { requireAuth, requireRole } = authMw;

  /** Resident search (approved listings only). */
  router.get(
    '/',
    requireAuth,
    asyncHandler(async (req, res) => {
      const data = await marketplace.search({
        q: req.query.q,
        category: req.query.category,
        minPrice: req.query.minPrice,
        maxPrice: req.query.maxPrice,
        sort: req.query.sort,
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
      const data = await marketplace.listMine(req.user, {
        status: req.query.status, page: req.query.page, limit: req.query.limit,
      });
      res.json({ success: true, data });
    })
  );

  router.get(
    '/enquiries',
    requireAuth,
    asyncHandler(async (req, res) => {
      res.json({ success: true, data: await marketplace.myEnquiries(req.user) });
    })
  );

  router.post(
    '/',
    requireAuth,
    singleUpload('image'),
    validate(createSchema),
    asyncHandler(async (req, res) => {
      const input = { ...req.body, price: Number(req.body.price) || 0 };
      if (req.file) input.imageUrl = `/uploads/${req.file.filename}`;
      const listing = await marketplace.create(req.user, input);
      res.status(201).json({ success: true, data: listing });
    })
  );

  router.get(
    '/:id',
    requireAuth,
    asyncHandler(async (req, res) => {
      res.json({ success: true, data: await marketplace.get(req.params.id, req.user) });
    })
  );

  router.post(
    '/:id/contact',
    requireAuth,
    validate(v.shape({ message: v.str({ max: 500, label: 'Message' }) })),
    asyncHandler(async (req, res) => {
      const data = await marketplace.contactSeller(req.params.id, req.user, req.body.message);
      res.json({ success: true, data });
    })
  );

  router.delete(
    '/:id',
    requireAuth,
    asyncHandler(async (req, res) => {
      res.json({ success: true, data: await marketplace.remove(req.params.id, req.user) });
    })
  );

  // ------------------------------------------------------------- Admin
  const adminRouter = express.Router();
  adminRouter.use(requireAuth, requireRole('admin'));

  adminRouter.get(
    '/',
    asyncHandler(async (req, res) => {
      const data = await marketplace.listAll({
        status: req.query.status, q: req.query.q, page: req.query.page, limit: req.query.limit,
      });
      res.json({ success: true, data });
    })
  );

  adminRouter.patch(
    '/:id',
    validate(
      v.shape({
        status: v.oneOf(['approved', 'rejected', 'sold', 'inactive'], { required: true, label: 'Status' }),
        reason: v.str({ max: 200, label: 'Reason' }),
      })
    ),
    asyncHandler(async (req, res) => {
      const data = await marketplace.moderate(req.params.id, req.user, {
        status: req.body.status,
        reason: req.body.reason,
      });
      res.json({ success: true, data });
    })
  );

  return { router, adminRouter };
}

module.exports = { createMarketplaceRoutes };
