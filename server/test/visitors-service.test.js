process.env.NODE_ENV = 'test';

const { strict: assert } = require('node:assert');
const { test } = require('node:test');

const { createVisitorsService } = require('../src/modules/visitors/service');
const { ApiError } = require('../src/utils/errors');

const officer = { id: 'u-security', role: 'security' };

function approvedPass() {
  return {
    id: 'v-1', host_id: 'u-resident', status: 'approved', visitor_name: 'Guest',
    otp_code: '123456',
    valid_from: new Date(Date.now() - 3600e3).toISOString(),
    valid_until: new Date(Date.now() + 3600e3).toISOString(),
  };
}

/** Minimal db stub that mimics the queries the visitor service issues. */
function makeDb({ verifyLog = null } = {}) {
  let current = approvedPass();
  const calls = [];
  return {
    calls,
    async one(sql) {
      if (/FROM visitor_passes/.test(sql)) return current;
      if (/FROM visitor_logs/.test(sql)) return verifyLog;
      if (/UPDATE visitor_passes/.test(sql)) {
        current = { ...current, status: 'checked_in' };
        return current;
      }
      return null;
    },
    async query(sql, params) {
      calls.push({ sql, params });
      return { rows: [], rowCount: 1 };
    },
    async many() { return []; },
    async scalar() { return 0; },
  };
}

function makeService(db) {
  return createVisitorsService({ db, notifications: { notify: async () => {} } });
}

test('verifyAtGate records an otp_verified log for an approved pass', async () => {
  const db = makeDb();
  const service = makeService(db);
  const pass = await service.verifyAtGate({ code: '123456', channel: 'otp' }, officer);
  assert.equal(pass.id, 'v-1');
  assert.ok(db.calls.some((c) => c.params[1] === 'otp_verified'), 'expected an otp_verified log');
});

test('recordEntry is refused until the officer verifies the pass', async () => {
  const service = makeService(makeDb({ verifyLog: null }));
  await assert.rejects(
    () => service.recordEntry('v-1', officer, 'walk in'),
    (err) => err instanceof ApiError && /Verify the visitor/.test(err.message)
  );
});

test('recordEntry succeeds after a recent verification by the same officer', async () => {
  const service = makeService(makeDb({ verifyLog: { id: 1 } }));
  const result = await service.recordEntry('v-1', officer, 'walk in');
  assert.equal(result.status, 'checked_in');
});
