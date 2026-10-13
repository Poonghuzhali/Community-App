const { createAuthMiddleware } = require('./auth');
const { errorHandler, notFoundHandler, ApiError, asyncHandler } = require('../utils/errors');
const { singleUpload } = require('./upload');
const { otpLimiter, apiLimiter } = require('./rateLimit');

module.exports = {
  createAuthMiddleware,
  errorHandler,
  notFoundHandler,
  ApiError,
  asyncHandler,
  singleUpload,
  otpLimiter,
  apiLimiter,
};
