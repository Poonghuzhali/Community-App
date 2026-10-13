const { ApiError } = require('../utils/errors');

/**
 * Wraps a `shape(...)` schema so handlers always receive a cleaned body.
 * Throws 422 with per-field details when anything is invalid.
 */
function validate(schema) {
  return (req, res, next) => {
    try {
      req.valid = schema(req.body || {});
      if (req.valid && typeof req.valid === 'object' && !Array.isArray(req.valid)) {
        req.body = { ...(req.body || {}), ...req.valid };
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}

/** Merge query params into a validated object (query values are always strings). */
function validateQuery(schema) {
  return (req, res, next) => {
    try {
      req.query = { ...req.query, ...schema(req.query || {}) };
      next();
    } catch (err) {
      next(err instanceof ApiError ? err : ApiError.badRequest(err.message));
    }
  };
}

module.exports = { validate, validateQuery };
