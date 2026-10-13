const express = require('express');
const { asyncHandler, ApiError } = require('../../utils/errors');
const { validate } = require('../../middleware/validate');
const v = require('../../utils/validators');

const passSchema = v.shape({
  visitorName: v.str({ required: true, max: 120, label: 'Visitor name' }),
  visitorPhone: v.phone({ label: 'Visitor mobile' }),
  visitorCount: v.int({ min: 1, max: 20, fallback: 1, label: 'Visitor count' }),
  purpose: v.str({ max: 60, fallback: 'Guest', label: 'Purpose' }),
  vehicleNumber: v.str({ max: 20, label: 'Vehicle number' }),
  passType: v.oneOf(['preapproved', 'walkin', 'delivery'], { fallback: 'preapproved', label: 'Pass type' }),
  deliveryVendor: v.str({ max: 60, label: 'Vendor' }),
  remarks: v.str({ max: 300, label: 'Remarks' }),
  validUntil: v.isoDate({ label: 'Valid until' }),
  hostId: v.str({ label: 'Host id' }),
});

function createVisitorRoutes({ visitors, authMw }) {
  const router = express.Router();
  const { requireAuth, requireRole } = authMw;

  /** Resident pre-approves a guest; security may log walk-ins & deliveries. */
  router.post(
    '/',
    requireAuth,
    validate(passSchema),
    asyncHandler(async (req, res) => {
      const input = { ...req.body };
      if (req.user.role === 'resident' && input.passType !== 'preapproved') {
        throw ApiError.forbidden('Residents can only pre-approve visitors');
      }
      const pass = await visitors.createPass(req.user, input);
      res.status(201).json({ success: true, data: pass });
    })
  );

  /** My passes (resident) or everyone's (admin/security). */
  router.get(
    '/',
    requireAuth,
    asyncHandler(async (req, res) => {
      const { status, page, limit, scope } = req.query;
      if (['admin', 'security'].includes(req.user.role) && scope === 'all') {
        const data = await visitors.listAll({
          status, q: req.query.q, page, limit, from: req.query.from, to: req.query.to,
        });
        return res.json({ success: true, data });
      }
      const data = await visitors.listForHost(req.user.id, { status, page, limit });
      return res.json({ success: true, data });
    })
  );

  router.get(
    '/inside',
    requireAuth,
    requireRole('admin', 'security'),
    asyncHandler(async (req, res) => {
      res.json({ success: true, data: await visitors.currentInside() });
    })
  );

  router.get(
    '/:id',
    requireAuth,
    asyncHandler(async (req, res) => {
      const pass = await visitors.getPass(req.params.id);
      if (pass.host_id !== req.user.id && !['admin', 'security'].includes(req.user.role)) {
        throw ApiError.forbidden('Not your visitor pass');
      }
      // Never leak the gate OTP in list-style responses for non-hosts.
      if (pass.host_id !== req.user.id && req.user.role !== 'admin') delete pass.otp_code;
      res.json({ success: true, data: pass });
    })
  );

  router.get(
    '/:id/logs',
    requireAuth,
    asyncHandler(async (req, res) => {
      const pass = await visitors.getPass(req.params.id);
      if (pass.host_id !== req.user.id && !['admin', 'security'].includes(req.user.role)) {
        throw ApiError.forbidden('Not your visitor pass');
      }
      res.json({ success: true, data: await visitors.getLogs(req.params.id) });
    })
  );

  router.post(
    '/:id/approve',
    requireAuth,
    asyncHandler(async (req, res) => {
      res.json({ success: true, data: await visitors.decide(req.params.id, req.user, 'approve') });
    })
  );

  router.post(
    '/:id/reject',
    requireAuth,
    asyncHandler(async (req, res) => {
      res.json({ success: true, data: await visitors.decide(req.params.id, req.user, 'reject') });
    })
  );

  router.post(
    '/:id/cancel',
    requireAuth,
    asyncHandler(async (req, res) => {
      res.json({ success: true, data: await visitors.cancel(req.params.id, req.user) });
    })
  );

  return router;
}

/** Gate module used by the security team. */
function createSecurityRoutes({ visitors, authMw }) {
  const router = express.Router();
  const { requireAuth, requireRole } = authMw;

  router.use(requireAuth);

  // Gate actions belong to on-duty security staff only; admins keep read access.
  const securityOnly = requireRole('security');
  const gateStaff = requireRole('security', 'admin');

  router.post(
    '/verify',
    securityOnly,
    validate(
      v.shape({
        code: v.str({ required: true, max: 64, label: 'OTP/QR code' }),
        channel: v.oneOf(['otp', 'qr'], { fallback: 'otp', label: 'Channel' }),
      })
    ),
    asyncHandler(async (req, res) => {
      const pass = await visitors.verifyAtGate(req.body, req.user);
      res.json({ success: true, data: pass });
    })
  );

  router.post(
    '/entry/:id',
    securityOnly,
    validate(v.shape({ remarks: v.str({ max: 300, label: 'Remarks' }) })),
    asyncHandler(async (req, res) => {
      res.json({ success: true, data: await visitors.recordEntry(req.params.id, req.user, req.body.remarks) });
    })
  );

  router.post(
    '/exit/:id',
    securityOnly,
    validate(v.shape({ remarks: v.str({ max: 300, label: 'Remarks' }) })),
    asyncHandler(async (req, res) => {
      res.json({ success: true, data: await visitors.recordExit(req.params.id, req.user, req.body.remarks) });
    })
  );

  router.post(
    '/deny/:id',
    securityOnly,
    validate(v.shape({ remarks: v.str({ max: 300, label: 'Remarks' }) })),
    asyncHandler(async (req, res) => {
      res.json({ success: true, data: await visitors.denyEntry(req.params.id, req.user, req.body.remarks) });
    })
  );

  router.get(
    '/inside',
    gateStaff,
    asyncHandler(async (req, res) => {
      res.json({ success: true, data: await visitors.currentInside() });
    })
  );

  router.get(
    '/stats',
    gateStaff,
    asyncHandler(async (req, res) => {
      res.json({ success: true, data: await visitors.stats() });
    })
  );

  return router;
}

module.exports = { createVisitorRoutes, createSecurityRoutes };
