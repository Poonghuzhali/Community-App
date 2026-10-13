const path = require('path');
require('dotenv').config();

const env = process.env;
const serverRoot = path.join(__dirname, '..', '..');
const isProd = (env.NODE_ENV || 'development') === 'production';

const config = {
  env: env.NODE_ENV || 'development',
  port: parseInt(env.PORT || '4000', 10),
  jwtSecret: env.JWT_SECRET || 'community-connect-dev-secret-change-me',
  jwtExpiresIn: env.JWT_EXPIRES_IN || '7d',
  sqlitePath: path.resolve(serverRoot, env.SQLITE_PATH || 'data/community.db'),
  otpTtlMinutes: parseInt(env.OTP_TTL_MINUTES || '5', 10),
  otpMaxAttempts: parseInt(env.OTP_MAX_ATTEMPTS || '5', 10),
  // Development convenience: force a fixed OTP so the demo is easy.
  // Set FIXED_DEV_OTP in any environment (including production hosted demos)
  // to keep the fixed-OTP flow; when unset, production generates real codes
  // that are never returned to the client.
  fixedDevOtp: env.FIXED_DEV_OTP || (isProd ? '' : '123456'),
  uploadDir: env.UPLOAD_DIR || path.join(serverRoot, 'uploads'),
  maxUploadBytes: parseInt(env.MAX_UPLOAD_BYTES || String(5 * 1024 * 1024), 10),
  publicBaseUrl: env.PUBLIC_BASE_URL || '',
  corsOrigins: (env.CORS_ORIGINS || '*').split(',').map((s) => s.trim()),
  firebase: {
    projectId: env.FIREBASE_PROJECT_ID || '',
    clientEmail: env.FIREBASE_CLIENT_EMAIL || '',
    privateKey: (env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
  },
};

config.firebaseEnabled = Boolean(
  config.firebase.projectId && config.firebase.clientEmail && config.firebase.privateKey
);

if (isProd && config.jwtSecret === 'community-connect-dev-secret-change-me') {
  throw new Error('JWT_SECRET must be set to a strong value in production');
}

module.exports = config;
