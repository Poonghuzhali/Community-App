const { ApiError, asyncHandler } = require('../utils/errors');
const { verifyToken } = require('../utils/tokens');

/**
 * JWT authentication + role guards.
 * `users` is any object exposing `findById(id)` -> user row (or null).
 */
function createAuthMiddleware({ users }) {
  const requireAuth = asyncHandler(async (req, res, next) => {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : (req.query.token || null);
    if (!token) throw ApiError.unauthorized('Missing access token');

    const payload = verifyToken(token);
    const user = await users.findById(payload.sub);
    if (!user || user.is_active === false) {
      throw ApiError.unauthorized('Account is inactive or no longer exists');
    }
    req.user = {
      id: user.id,
      role: user.role,
      phone: user.phone,
      name: user.full_name || '',
      flatId: user.flat_id || null,
      flatLabel: user.flat_label || '',
      isActive: user.is_active !== false,
    };
    next();
  });

  const requireRole = (...roles) => (req, res, next) => {
    if (!req.user) return next(ApiError.unauthorized());
    if (!roles.includes(req.user.role)) {
      return next(ApiError.forbidden(`This area is restricted to: ${roles.join(', ')}`));
    }
    return next();
  };

  const optionalAuth = asyncHandler(async (req, res, next) => {
    const header = req.headers.authorization || '';
    if (!header.startsWith('Bearer ')) return next();
    try {
      const payload = verifyToken(header.slice(7));
      const user = await users.findById(payload.sub);
      if (user && user.is_active !== false) {
        req.user = {
          id: user.id, role: user.role, phone: user.phone, name: user.full_name || '',
          flatId: user.flat_id || null, flatLabel: user.flat_label || '',
        };
      }
    } catch (err) { /* anonymous */ }
    return next();
  });

  return { requireAuth, requireRole, optionalAuth };
}

module.exports = { createAuthMiddleware };
