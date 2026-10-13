const { strict: assert } = require('node:assert');
const { test } = require('node:test');

const { generateOtp, createOtpCode, verifyOtpCode, hashSecret } = require('../src/utils/otp');

test('generateOtp returns a 6 digit string that never starts with 0', () => {
  for (let i = 0; i < 50; i += 1) {
    const code = generateOtp(6);
    assert.match(code, /^[1-9]\d{5}$/);
  }
});

test('OTP is hashed per phone number so the same code differs per user', () => {
  const a = hashSecret('123456', '9000000001');
  const b = hashSecret('123456', '9000000002');
  assert.notEqual(a, b);
  assert.equal(a, hashSecret('123456', '9000000001'));
});

test('verifyOtpCode accepts the right code and rejects wrong ones', () => {
  const { code, hash } = createOtpCode('9000000003');
  assert.equal(verifyOtpCode('9000000003', code, hash), true);
  assert.equal(verifyOtpCode('9000000003', '000000', hash), false);
  assert.equal(verifyOtpCode('9000000003', code, null), false);
  assert.equal(verifyOtpCode('9000000003', `${code} `, hash), true, 'trims whitespace');
});

test('verifyOtpCode does not accept a hash issued for another phone', () => {
  const { code, hash } = createOtpCode('9000000003');
  assert.equal(verifyOtpCode('9000000099', code, hash), false);
});
