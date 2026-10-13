const jwt = require('jsonwebtoken');
const config = require('../config');
const { ApiError } = require('./errors');

function signToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      role: user.role,
      phone: user.phone,
      name: user.full_name || '',
      flat: user.flat_label || '',
    },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn }
  );
}

function verifyToken(token) {
  try {
    return jwt.verify(token, config.jwtSecret);
  } catch (err) {
    throw ApiError.unauthorized('Session expired or invalid. Please log in again.');
  }
}

function decodeToken(token) {
  try {
    return jwt.decode(token);
  } catch {
    return null;
  }
}

module.exports = { signToken, verifyToken, decodeToken };
