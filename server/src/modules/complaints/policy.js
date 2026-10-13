const { ApiError } = require('../../utils/errors');

const STATUSES = ['submitted', 'in_progress', 'resolved'];

const TRANSITIONS = {
  submitted: ['in_progress'],
  in_progress: ['resolved', 'submitted'],
  resolved: ['in_progress'],
};

function canTransition(from, to) {
  return (TRANSITIONS[from] || []).includes(to);
}

function assertTransition(from, to) {
  if (!STATUSES.includes(to)) throw ApiError.badRequest(`Unknown status "${to}"`);
  if (!canTransition(from, to)) {
    throw ApiError.badRequest(`A complaint cannot move from ${from} to ${to}`);
  }
  return true;
}

/** Residents can only see/edit their own complaints. */
function assertOwner(complaint, actor) {
  if (complaint.raised_by !== actor.id && !['admin'].includes(actor.role)) {
    throw ApiError.forbidden('This complaint belongs to another resident');
  }
  return true;
}

function assertStaff(actor) {
  if (!['admin', 'security'].includes(actor.role)) {
    throw ApiError.forbidden('Only admins can manage complaints');
  }
  return true;
}

function nextReference(date = new Date(), seq = null) {
  const ymd = date.toISOString().slice(0, 10).replace(/-/g, '');
  const suffix = seq !== null ? String(seq).padStart(4, '0') : '0000';
  return `CC-${ymd}-${suffix}`;
}

module.exports = { STATUSES, TRANSITIONS, canTransition, assertTransition, assertOwner, assertStaff, nextReference };
