const { ApiError } = require('../../utils/errors');
const { createOtpCode, verifyOtpCode, hashSecret } = require('../../utils/otp');
const { signToken } = require('../../utils/tokens');
const config = require('../../config');

/**
 * Mobile-OTP login.
 * 1. requestOtp(phone)  -> creates a hashed 6 digit code (5 minute TTL)
 * 2. verifyOtp(phone, code) -> issues a JWT, creates the resident on first login
 */
function createAuthService({ db, users, notifications }) {
  async function requestOtp(phone, purpose = 'login') {
    const recent = await db.scalar(
      `SELECT COUNT(*) FROM otp_codes
        WHERE phone = $1 AND purpose = $2 AND created_at > NOW() - INTERVAL '15 minutes'`,
      [phone, purpose]
    );
    if (Number(recent) >= 5) {
      throw new ApiError(429, 'Too many OTP requests. Please try again later.', 'rate_limited');
    }

    const { code, hash } = createOtpCode(phone);
    const row = await db.one(
      `INSERT INTO otp_codes (phone, code, purpose, expires_at)
       VALUES ($1, $2, $3, NOW() + ($4 || ' minutes')::interval)
       RETURNING id, expires_at`,
      [phone, hash, purpose, config.otpTtlMinutes]
    );

    // SMS gateways (MSG91 / Twilio) plug in here. In dev the code is returned
    // so the demo works end-to-end without a paid SMS provider.
    if (config.env !== 'production') {
      return { sent: true, expiresIn: config.otpTtlMinutes, devOtp: code, expiresAt: row.expires_at };
    }
    await sendSms(phone, `Your Community Connect verification code is ${code}`);
    return { sent: true, expiresIn: config.otpTtlMinutes, expiresAt: row.expires_at };
  }

  async function verifyOtp(phone, code, { fcmToken, platform } = {}) {
    const record = await db.one(
      `SELECT * FROM otp_codes
        WHERE phone = $1 AND purpose = 'login' AND consumed_at IS NULL
        ORDER BY created_at DESC LIMIT 1`,
      [phone]
    );

    if (!record) throw ApiError.badRequest('Please request a new OTP');
    if (new Date(record.expires_at) < new Date()) throw ApiError.badRequest('OTP expired. Please request a new one.');
    if (record.attempts >= config.otpMaxAttempts) {
      throw new ApiError(429, 'Too many wrong attempts. Please request a new OTP.', 'rate_limited');
    }

    if (!verifyOtpCode(phone, code, record.code)) {
      await db.query('UPDATE otp_codes SET attempts = attempts + 1 WHERE id = $1', [record.id]);
      throw ApiError.badRequest('Incorrect OTP');
    }

    await db.query('UPDATE otp_codes SET consumed_at = NOW() WHERE id = $1', [record.id]);
    const user = await users.login(phone);
    if (fcmToken) await notifications.registerDevice(user.id, fcmToken, platform || 'android');

    return {
      token: signToken(user),
      user: publicUser(user),
      isNewUser: user.full_name === 'New Resident',
    };
  }

  async function logout(userId, fcmToken) {
    if (fcmToken) await users.removeDeviceToken(userId, fcmToken);
    return { ok: true };
  }

  return { requestOtp, verifyOtp, logout };
}

function publicUser(user) {
  return {
    id: user.id,
    phone: user.phone,
    fullName: user.full_name,
    email: user.email,
    role: user.role,
    flatId: user.flat_id,
    flatLabel: user.flat_label,
    avatarUrl: user.avatar_url,
    joinedOn: user.joined_on,
    isActive: user.is_active,
  };
}

async function sendSms(phone, text) {
  console.log(`[sms] to ${phone}: ${text}`);
}

module.exports = { createAuthService, publicUser, hashSecret };
