class ApiError extends Error {
  constructor(status, message, code = null, details = null) {
    super(message);
    this.status = status;
    this.code = code || statusToCode(status);
    this.details = details;
  }

  static badRequest(message, details) { return new ApiError(400, message, 'bad_request', details); }
  static unauthorized(message = 'Authentication required') { return new ApiError(401, message, 'unauthorized'); }
  static forbidden(message = 'You do not have permission to do this') { return new ApiError(403, message, 'forbidden'); }
  static notFound(message = 'Resource not found') { return new ApiError(404, message, 'not_found'); }
  static conflict(message) { return new ApiError(409, message, 'conflict'); }
  static unprocessable(message, details) { return new ApiError(422, message, 'validation_error', details); }
}

function statusToCode(status) {
  return ({
    400: 'bad_request', 401: 'unauthorized', 403: 'forbidden', 404: 'not_found',
    409: 'conflict', 422: 'validation_error', 429: 'rate_limited',
  })[status] || 'error';
}

const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

function notFoundHandler(req, res, next) {
  next(ApiError.notFound(`No route for ${req.method} ${req.originalUrl}`));
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (err instanceof ApiError) {
    return res.status(err.status).json({
      success: false,
      error: { code: err.code, message: err.message, details: err.details || undefined },
    });
  }
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ success: false, error: { code: 'bad_request', message: 'Invalid JSON body' } });
  }
  if (err.code === '23505') {
    return res.status(409).json({ success: false, error: { code: 'conflict', message: 'This record already exists' } });
  }
  console.error('[error]', err);
  return res.status(500).json({
    success: false,
    error: { code: 'server_error', message: 'Something went wrong on the server' },
  });
}

module.exports = { ApiError, asyncHandler, errorHandler, notFoundHandler };
