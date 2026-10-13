const { strict: assert } = require('node:assert');
const { test } = require('node:test');

const visitorPolicy = require('../src/modules/visitors/policy');
const complaintPolicy = require('../src/modules/complaints/policy');
const bookingPolicy = require('../src/modules/bookings/policy');
const { ApiError } = require('../src/utils/errors');

const HOST = 'user-host';
const OTHER = 'user-other';

const pass = (over = {}) => ({
  id: 'p1', host_id: HOST, status: 'approved',
  valid_from: '2026-10-08T00:00:00.000Z',
  valid_until: '2026-10-08T23:59:00.000Z',
  ...over,
});

// ---------------------------------------------------------------- visitors
test('visitor: legal status transitions', () => {
  assert.equal(visitorPolicy.canTransition('pending', 'approved'), true);
  assert.equal(visitorPolicy.canTransition('pending', 'rejected'), true);
  assert.equal(visitorPolicy.canTransition('approved', 'checked_in'), true);
  assert.equal(visitorPolicy.canTransition('checked_in', 'checked_out'), true);
  assert.equal(visitorPolicy.canTransition('checked_out', 'checked_in'), false);
  assert.equal(visitorPolicy.canTransition('rejected', 'approved'), false);
});

test('visitor: only the host may approve/reject', () => {
  assert.equal(visitorPolicy.assertHostCanAct(pass({ status: 'pending' }), 'approve', HOST), true);
  assert.throws(() => visitorPolicy.assertHostCanAct(pass({ status: 'pending' }), 'approve', OTHER), (e) => e.status === 403);
  assert.throws(
    () => visitorPolicy.assertHostCanAct(pass({ status: 'checked_in' }), 'approve', HOST),
    (e) => e.status === 400
  );
});

test('visitor: gate entry rules', () => {
  const now = new Date('2026-10-08T12:00:00.000Z');
  assert.equal(visitorPolicy.assertEntryAllowed(pass(), now), true);

  assert.throws(() => visitorPolicy.assertEntryAllowed(pass({ status: 'pending' }), now), /resident approval/);
  assert.throws(() => visitorPolicy.assertEntryAllowed(pass({ status: 'checked_in' }), now), /already checked in/);
  assert.throws(() => visitorPolicy.assertEntryAllowed(pass({ status: 'checked_out' }), now), /cannot be used/);
  assert.throws(() => visitorPolicy.assertEntryAllowed(pass({ status: 'rejected' }), now), /cannot be used/);
  assert.throws(() => visitorPolicy.assertEntryAllowed(pass(), new Date('2026-10-09T12:00:00.000Z')), /expired/);
  assert.throws(() => visitorPolicy.assertEntryAllowed(pass(), new Date('2026-10-07T12:00:00.000Z')), /not valid yet/);
});

test('visitor: exit only allowed while checked in', () => {
  assert.equal(visitorPolicy.assertExitAllowed(pass({ status: 'checked_in' })), true);
  assert.throws(() => visitorPolicy.assertExitAllowed(pass({ status: 'approved' })), /not checked in/);
});

test('visitor: verifyAtGate rejects a missing/rejected pass', () => {
  assert.throws(() => visitorPolicy.assertVerifiable(null), (e) => e.status === 404);
  assert.throws(() => visitorPolicy.assertVerifiable(pass({ status: 'rejected' })), /rejected/);
  assert.throws(() => visitorPolicy.assertVerifiable(pass({ status: 'expired' })), /expired/);
});

// -------------------------------------------------------------- complaints
test('complaint: status may not skip stages', () => {
  assert.equal(complaintPolicy.canTransition('submitted', 'in_progress'), true);
  assert.equal(complaintPolicy.canTransition('in_progress', 'resolved'), true);
  assert.equal(complaintPolicy.canTransition('resolved', 'in_progress'), true); // reopen
  assert.throws(() => complaintPolicy.assertTransition('submitted', 'resolved'), /cannot move/);
  assert.throws(() => complaintPolicy.assertTransition('resolved', 'submitted'), /cannot move/);
  assert.throws(() => complaintPolicy.assertTransition('submitted', 'closed'), /Unknown status/);
});

test('complaint: owner check protects other residents complaints', () => {
  const complaint = { raised_by: HOST };
  assert.equal(complaintPolicy.assertOwner(complaint, { id: HOST, role: 'resident' }), true);
  assert.equal(complaintPolicy.assertOwner(complaint, { id: OTHER, role: 'admin' }), true);
  assert.throws(() => complaintPolicy.assertOwner(complaint, { id: OTHER, role: 'resident' }), (e) => e.status === 403);
  assert.throws(() => complaintPolicy.assertOwner(complaint, { id: OTHER, role: 'security' }), (e) => e.status === 403);
});

test('complaint: reference numbers look like CC-YYYYMMDD-0007', () => {
  const ref = complaintPolicy.nextReference(new Date('2026-10-08T10:00:00Z'), 7);
  assert.equal(ref, 'CC-20261008-0007');
});

// ---------------------------------------------------------------- bookings
test('bookings: generateSlots builds a complete day grid', () => {
  const slots = bookingPolicy.generateSlots(
    { openTime: '06:00', closeTime: '10:00', slotMinutes: 60 },
    '2026-10-10'
  );
  assert.deepEqual(slots, [
    { date: '2026-10-10', startTime: '06:00', endTime: '07:00' },
    { date: '2026-10-10', startTime: '07:00', endTime: '08:00' },
    { date: '2026-10-10', startTime: '08:00', endTime: '09:00' },
    { date: '2026-10-10', startTime: '09:00', endTime: '10:00' },
  ]);
});

test('bookings: generateSlots never overflows the closing time', () => {
  const slots = bookingPolicy.generateSlots(
    { openTime: '06:30', closeTime: '08:00', slotMinutes: 60 },
    '2026-10-10'
  );
  assert.equal(slots.length, 1);
  assert.equal(slots[0].endTime, '07:30');
});

test('bookings: assertBookable blocks taken/blocked/past slots', () => {
  const now = new Date('2026-10-08T12:00:00.000Z');
  const slot = {
    slot_date: '2026-10-10', start_time: '07:00:00', end_time: '08:00:00',
    is_blocked: false, booked_user_id: null, amenity_id: 1, id: 11,
  };

  assert.equal(bookingPolicy.assertBookable(slot, { now, userId: HOST }), true);
  assert.throws(() => bookingPolicy.assertBookable(null, { now }), (e) => e.status === 404);
  assert.throws(() => bookingPolicy.assertBookable({ ...slot, is_blocked: true }, { now }), /blocked/);
  assert.throws(
    () => bookingPolicy.assertBookable({ ...slot, booked_user_id: OTHER }, { now, userId: HOST }),
    (e) => e.status === 409
  );
  assert.throws(
    () => bookingPolicy.assertBookable({ ...slot, booked_user_id: HOST }, { now, userId: HOST }),
    /already booked/
  );
  assert.throws(
    () => bookingPolicy.assertBookable({ ...slot, slot_date: '2026-10-07' }, { now }),
    /already started/
  );
});

test('bookings: cancellations close 30 minutes before the slot', () => {
  const now = new Date('2026-10-08T12:00:00.000Z');
  const booking = { status: 'confirmed', slot_date: '2026-10-10', start_time: '07:00:00' };
  assert.equal(bookingPolicy.assertCancellable(booking, { now }), true);

  assert.throws(
    () => bookingPolicy.assertCancellable({ ...booking, slot_date: '2026-10-01', start_time: '06:15:00' }, { now }),
    /up to 30 minutes/
  );
  assert.throws(
    () => bookingPolicy.assertCancellable({ ...booking, status: 'cancelled' }, { now }),
    /Only confirmed/
  );
  assert.equal(
    bookingPolicy.assertCancellable(booking, { now, noticeMinutes: 0 }),
    true,
    'admins cancel with zero notice'
  );
});
