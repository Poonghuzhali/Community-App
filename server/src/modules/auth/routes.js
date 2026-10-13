const express = require('express');
const { asyncHandler, ApiError } = require('../../utils/errors');
const { validate } = require('../../middleware/validate');
const { otpLimiter } = require('../../middleware/rateLimit');
const v = require('../../utils/validators');
const { publicUser } = require('./service');

function createAuthRoutes({ auth, users, notifications, authMw }) {
  const router = express.Router();
  const { requireAuth } = authMw;

  // 1. Request OTP ------------------------------------------------------
  router.post(
    '/otp/request',
    otpLimiter,
    validate(v.shape({ phone: v.phone({ required: true }) })),
    asyncHandler(async (req, res) => {
      const result = await auth.requestOtp(req.body.phone);
      res.json({ success: true, data: result });
    })
  );

  // 2. Verify OTP -> JWT ------------------------------------------------
  router.post(
    '/otp/verify',
    otpLimiter,
    validate(
      v.shape({
        phone: v.phone({ required: true }),
        code: v.str({ required: true, max: 8, label: 'OTP' }),
        fcmToken: v.str({ max: 400 }),
        platform: v.str({ max: 20 }),
      })
    ),
    asyncHandler(async (req, res) => {
      const result = await auth.verifyOtp(req.body.phone, req.body.code, {
        fcmToken: req.body.fcmToken,
        platform: req.body.platform,
      });
      res.json({ success: true, data: result });
    })
  );

  // 3. Current profile --------------------------------------------------
  router.get(
    '/me',
    requireAuth,
    asyncHandler(async (req, res) => {
      const user = await users.findById(req.user.id);
      if (!user) throw ApiError.notFound('Account not found');
      res.json({ success: true, data: publicUser(user) });
    })
  );

  // 4. Update profile ---------------------------------------------------
  router.patch(
    '/me',
    requireAuth,
    validate(
      v.shape({
        full_name: v.str({ max: 120, label: 'Name' }),
        email: v.str({ max: 160, label: 'Email' }),
        avatar_url: v.str({ max: 500, label: 'Photo URL' }),
      })
    ),
    asyncHandler(async (req, res) => {
      const user = await users.updateProfile(req.user.id, {
        fullName: req.body.full_name,
        email: req.body.email,
        avatarUrl: req.body.avatar_url,
      });
      res.json({ success: true, data: publicUser(user) });
    })
  );

  // 5. Register push token ---------------------------------------------
  router.post(
    '/device',
    requireAuth,
    validate(
      v.shape({
        token: v.str({ required: true, max: 400, label: 'Device token' }),
        platform: v.str({ fallback: 'android' }),
      })
    ),
    asyncHandler(async (req, res) => {
      const row = await notifications.registerDevice(req.user.id, req.body.token, req.body.platform);
      res.json({ success: true, data: row });
    })
  );

  router.post(
    '/logout',
    requireAuth,
    validate(v.shape({ token: v.str({ max: 400 }) })),
    asyncHandler(async (req, res) => {
      res.json({ success: true, data: await auth.logout(req.user.id, req.body.token) });
    })
  );

  return router;
}

module.exports = { createAuthRoutes };
