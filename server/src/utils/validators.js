const { ApiError } = require('./errors');

const PHONE_RE = /^[6-9]\d{9}$/;

function normalizePhone(value) {
  if (value === undefined || value === null) return null;
  let p = String(value).replace(/[\s\-().]/g, '');
  if (p.startsWith('+91')) p = p.slice(3);
  if (p.startsWith('91') && p.length === 12) p = p.slice(2);
  if (p.startsWith('0') && p.length === 11) p = p.slice(1);
  return p;
}

function isPhone(value) {
  return PHONE_RE.test(normalizePhone(value) || '');
}

/**
 * Tiny declarative validator.
 *   { name: str({ required: true, max: 120 }), age: int({ min: 18 }) }
 * Returns a cleaned object; throws 422 with per-field messages.
 */
function str({ required = false, max = 500, min = 0, trim = true, label = 'value' } = {}) {
  return (raw) => {
    if (raw === undefined || raw === null || raw === '') {
      if (required) throw ApiError.unprocessable(`${label} is required`);
      return null;
    }
    const v = trim ? String(raw).trim() : String(raw);
    if (v.length < min) throw ApiError.unprocessable(`${label} must be at least ${min} characters`);
    if (v.length > max) throw ApiError.unprocessable(`${label} must be under ${max} characters`);
    return v;
  };
}

function int({ required = false, min = -Infinity, max = Infinity, label = 'value', fallback = null } = {}) {
  return (raw) => {
    if (raw === undefined || raw === null || raw === '') {
      if (required) throw ApiError.unprocessable(`${label} is required`);
      return fallback;
    }
    const n = Number(raw);
    if (!Number.isFinite(n) || !Number.isInteger(n)) throw ApiError.unprocessable(`${label} must be a whole number`);
    if (n < min) throw ApiError.unprocessable(`${label} must be at least ${min}`);
    if (n > max) throw ApiError.unprocessable(`${label} must be at most ${max}`);
    return n;
  };
}

function num({ required = false, min = -Infinity, max = Infinity, label = 'value', fallback = null } = {}) {
  return (raw) => {
    if (raw === undefined || raw === null || raw === '') {
      if (required) throw ApiError.unprocessable(`${label} is required`);
      return fallback;
    }
    const n = Number(raw);
    if (!Number.isFinite(n)) throw ApiError.unprocessable(`${label} must be a number`);
    if (n < min) throw ApiError.unprocessable(`${label} must be at least ${min}`);
    if (n > max) throw ApiError.unprocessable(`${label} must be at most ${max}`);
    return n;
  };
}

function bool({ required = false, fallback = undefined } = {}) {
  return (raw) => {
    if (raw === undefined || raw === null || raw === '') {
      if (required) throw ApiError.unprocessable('Value is required');
      return fallback;
    }
    if (typeof raw === 'boolean') return raw;
    if (['true', '1', 'yes'].includes(String(raw).toLowerCase())) return true;
    if (['false', '0', 'no'].includes(String(raw).toLowerCase())) return false;
    throw ApiError.unprocessable('Value must be true or false');
  };
}

function oneOf(values, { required = false, label = 'value', fallback = null } = {}) {
  return (raw) => {
    if (raw === undefined || raw === null || raw === '') {
      if (required) throw ApiError.unprocessable(`${label} is required`);
      return fallback;
    }
    const v = String(raw);
    if (!values.includes(v)) throw ApiError.unprocessable(`${label} must be one of: ${values.join(', ')}`);
    return v;
  };
}

function phone({ required = false, label = 'mobile number' } = {}) {
  return (raw) => {
    if (raw === undefined || raw === null || raw === '') {
      if (required) throw ApiError.unprocessable(`${label} is required`);
      return null;
    }
    const p = normalizePhone(raw);
    if (!PHONE_RE.test(p)) throw ApiError.unprocessable(`${label} must be a valid 10-digit Indian mobile number`);
    return p;
  };
}

function isoDate({ required = false, label = 'date' } = {}) {
  return (raw) => {
    if (raw === undefined || raw === null || raw === '') {
      if (required) throw ApiError.unprocessable(`${label} is required`);
      return null;
    }
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) throw ApiError.unprocessable(`${label} must be a valid date/time`);
    return d.toISOString();
  };
}

function shape(schema) {
  return (body = {}) => {
    const out = {};
    const errors = [];
    for (const [key, rule] of Object.entries(schema)) {
      try {
        out[key] = rule(body[key]);
      } catch (err) {
        errors.push({ field: key, message: err.message });
      }
    }
    if (errors.length) throw ApiError.unprocessable('Please check the highlighted fields', errors);
    return out;
  };
}

module.exports = {
  str, int, num, bool, oneOf, phone, isoDate, shape,
  normalizePhone, isPhone,
};
