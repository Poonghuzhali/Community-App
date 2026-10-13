const rateLimit = require('express-rate-limit');
const config = require('../config');

/** Basic brute-force protection for OTP endpoints. */
const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: config.env === 'test' ? 10000 : 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { code: 'rate_limited', message: 'Too many attempts. Try again in a few minutes.' } },
});

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: config.env === 'test' ? 10000 : 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { code: 'rate_limited', message: 'Too many requests. Slow down.' } },
});

module.exports = { otpLimiter, apiLimiter };
