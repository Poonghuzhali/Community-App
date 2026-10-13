const { ApiError } = require('../../utils/errors');

const STATUSES = ['pending', 'approved', 'rejected', 'checked_in', 'checked_out', 'expired'];
const PASS_TYPES = ['preapproved', 'walkin', 'delivery'];

const TRANSITIONS = {
  pending: ['approved', 'rejected', 'expired'],
  approved: ['checked_in', 'expired', 'rejected'],
  checked_in: ['checked_out'],
  checked_out: [],
  rejected: [],
  expired: [],
};

function canTransition(from, to) {
  return (TRANSITIONS[from] || []).includes(to);
}

/** Host (resident) actions on their own pass. */
function assertHostCanAct(pass, action, actorId) {
  if (pass.host_id !== actorId) throw ApiError.forbidden('This visitor pass belongs to another resident');
  if (action === 'approve' && !canTransition(pass.status, 'approved')) {
    throw ApiError.badRequest(`Cannot approve a pass that is ${pass.status}`);
  }
  if (action === 'reject' && !canTransition(pass.status, 'rejected')) {
    throw ApiError.badRequest(`Cannot reject a pass that is ${pass.status}`);
  }
  return true;
}

/**
 * Gate rules for the security team.
 * A pass is usable for entry when approved (or pre-approved walk-in) and inside
 * its validity window.
 */
function assertEntryAllowed(pass, now = new Date()) {
  if (['checked_out', 'rejected', 'expired'].includes(pass.status)) {
    throw ApiError.badRequest(`Pass is ${pass.status} and cannot be used for entry`);
  }
  if (pass.status === 'checked_in') throw ApiError.badRequest('Visitor is already checked in');
  if (new Date(pass.valid_from) > now) throw ApiError.badRequest('This pass is not valid yet');
  if (new Date(pass.valid_until) < now) throw ApiError.badRequest('This pass has expired');
  if (pass.status === 'pending') throw ApiError.badRequest('Pass is still awaiting resident approval');
  return true;
}

function assertExitAllowed(pass) {
  if (pass.status !== 'checked_in') throw ApiError.badRequest('Visitor is not checked in');
  return true;
}

function isExpired(pass, now = new Date()) {
  return new Date(pass.valid_until) < now && !['checked_out', 'rejected'].includes(pass.status);
}

/** Route a gate verification result to the right error/response. */
function assertVerifiable(pass) {
  if (!pass) throw ApiError.notFound('No visitor pass matches this OTP/QR');
  if (pass.status === 'rejected') throw ApiError.forbidden('This pass was rejected by the resident');
  if (pass.status === 'expired') throw ApiError.badRequest('This pass has expired');
  return pass;
}

module.exports = {
  STATUSES,
  PASS_TYPES,
  TRANSITIONS,
  canTransition,
  assertHostCanAct,
  assertEntryAllowed,
  assertExitAllowed,
  assertVerifiable,
  isExpired,
};
