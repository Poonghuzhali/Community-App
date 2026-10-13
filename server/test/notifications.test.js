const { strict: assert } = require('node:assert');
const { test } = require('node:test');

const { createNotificationService } = require('../src/services/notifications');

/** Minimal in-memory stand-in for the pg wrapper used by the service. */
function fakeDb({ tokens = [], activeUsers = [], scalarValue = 0 } = {}) {
  const calls = [];
  return {
    calls,
    async query(sql, params) {
      calls.push({ sql, params });
      return { rowCount: 1, rows: [] };
    },
    async many(sql, params) {
      calls.push({ sql, params });
      if (sql.includes('FROM device_tokens')) return tokens.map((t) => ({ token: t }));
      if (sql.includes('FROM users')) return activeUsers.map((id) => ({ id }));
      return [];
    },
    async one(sql, params) {
      calls.push({ sql, params });
      return { id: 'n-1' };
    },
    async scalar(sql, params) {
      calls.push({ sql, params });
      return scalarValue;
    },
  };
}

function fakePush() {
  const sent = [];
  return {
    sent,
    enabled: true,
    async send(tokens, payload) {
      sent.push({ tokens, payload });
      return { sent: tokens.length };
    },
  };
}

test('notify to a single user stores a row and pushes to their devices', async () => {
  const db = fakeDb({ tokens: ['device-a', 'device-b'] });
  const push = fakePush();
  const svc = createNotificationService({ db, push });

  const result = await svc.notify({
    userId: 'u-1',
    type: 'complaint',
    title: 'Complaint resolved',
    body: 'CC-20261008-0001 is fixed',
    data: { complaintId: 'c-1' },
  });

  assert.equal(result.notified, 1);
  const insert = db.calls.find((c) => c.sql.includes('INSERT INTO notifications'));
  assert.ok(insert, 'a notification row is written');
  assert.deepEqual(insert.params.slice(0, 3), ['u-1', 'complaint', 'Complaint resolved']);
  assert.equal(push.sent.length, 1);
  assert.deepEqual(push.sent[0].tokens, ['device-a', 'device-b']);
  assert.equal(push.sent[0].payload.title, 'Complaint resolved');
});

test('broadcast notify reaches every active user', async () => {
  const db = fakeDb({ activeUsers: ['u-1', 'u-2', 'u-3'], tokens: [] });
  const push = fakePush();
  const svc = createNotificationService({ db, push });

  const result = await svc.notify({
    broadcast: true,
    type: 'announcement',
    title: 'Water cut on Sunday',
    body: 'Store water on Saturday night',
  });

  assert.equal(result.notified, 3);
  const inserts = db.calls.filter((c) => c.sql.includes('INSERT INTO notifications'));
  assert.equal(inserts.length, 3);
  assert.deepEqual(inserts.map((i) => i.params[0]), ['u-1', 'u-2', 'u-3']);
});

test('notify by role only targets that role', async () => {
  const db = fakeDb();
  const push = fakePush();
  const svc = createNotificationService({ db, push });

  await svc.notify({ roles: ['security'], type: 'visitor', title: 'Gate', body: 'x' });
  const select = db.calls.find((c) => c.sql.includes('FROM users'));
  assert.match(select.sql, /role IN \(\$1\)/);
  assert.equal(select.params[0], 'security');
});

test('no device tokens means no push attempt', async () => {
  const db = fakeDb({ tokens: [] });
  const push = fakePush();
  const svc = createNotificationService({ db, push });
  const result = await svc.notify({ userId: 'u-1', type: 'system', title: 'Hi', body: '' });
  assert.equal(result.notified, 1);
  assert.equal(push.sent.length, 0);
});

test('unreadCount and markAllRead only touch the callers feed', async () => {
  const db = fakeDb({ scalarValue: 4 });
  const push = fakePush();
  const svc = createNotificationService({ db, push });

  assert.equal(await svc.unreadCount('u-1'), 4);
  const countCall = db.calls.find((c) => c.sql.includes('COUNT(*)'));
  assert.deepEqual(countCall.params, ['u-1']);

  await svc.markAllRead('u-1');
  const update = db.calls.find((c) => c.sql.includes('UPDATE notifications'));
  assert.match(update.sql, /user_id = \$1 OR user_id IS NULL/);
});

test('markRead ignores notifications that belong to somebody else', async () => {
  const db = fakeDb();
  db.one = async (sql, params) => {
    db.calls.push({ sql, params });
    return null; // no matching row for this user
  };
  const svc = createNotificationService({ db, push: fakePush() });
  assert.equal(await svc.markRead('99', 'u-2'), false);
});
