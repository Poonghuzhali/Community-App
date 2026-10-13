const crypto = require('crypto');
const config = require('../config');

/** Numeric OTP of `len` digits (never starts with 0). */
function generateOtp(len = 6) {
  const max = 10 ** len;
  let n;
  do {
    n = crypto.randomInt(1, max);
  } while (String(n).length !== len);
  return String(n).padStart(len, '0');
}

function hashSecret(code, salt) {
  return crypto.createHash('sha256').update(`${salt}:${code}`).digest('hex');
}

/** OTPs are stored hashed, scoped to the phone number they were issued for. */
function createOtpCode(phone) {
  const code = config.fixedDevOtp || generateOtp(6);
  return { code, hash: hashSecret(code, phone) };
}

function verifyOtpCode(phone, code, expectedHash) {
  if (!code || !expectedHash) return false;
  const a = Buffer.from(hashSecret(String(code).trim(), phone), 'hex');
  const b = Buffer.from(expectedHash, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

module.exports = { generateOtp, hashSecret, createOtpCode, verifyOtpCode };
