const { strict: assert } = require('node:assert');
const { test } = require('node:test');

const { createAuthMiddleware } = require('../src/middleware/auth');
const { signToken } = require('../src/utils/tokens');
const { ApiError } = require('../src/utils/errors');

const USER = {
  id: 'u-1', phone: '9000000003', full_name: 'Rahul Verma', role: 'resident',
  flat_id: 'f-1', flat_label: 'B-202', is_active: true,
};

const users = { findById: async (id) => (id === USER.id ? USER : null) };
const { requireAuth, requireRole, optionalAuth } = createAuthMiddleware({ users });

function run(middleware, { headers = {} } = {}) {
  return new Promise((resolve) => {
    const req = { headers, query: {} };
    const res = {};
    middleware(req, res, (err) => resolve({ err, req }));
  });
}

test('requireAuth: rejects a missing token', async () => {
  const { err } = await run(requireAuth);
  assert.ok(err instanceof ApiError);
  assert.equal(err.status, 401);
});

test('requireAuth: rejects a garbage token', async () => {
  const { err } = await run(requireAuth, { headers: { authorization: 'Bearer not.a.jwt' } });
  assert.equal(err.status, 401);
});

test('requireAuth: accepts a valid token and loads the user', async () => {
  const token = signToken(USER);
  const { err, req } = await run(requireAuth, { headers: { authorization: `Bearer ${token}` } });
  assert.equal(err, undefined);
  assert.equal(req.user.id, 'u-1');
  assert.equal(req.user.role, 'resident');
  assert.equal(req.user.flatLabel, 'B-202');
});

test('requireAuth: rejects a token for a deleted/inactive account', async () => {
  const ghost = { ...USER, id: 'u-ghost' };
  const token = signToken(ghost);
  const { err } = await run(requireAuth, { headers: { authorization: `Bearer ${token}` } });
  assert.equal(err.status, 401);
});

test('requireAuth: a deactivated resident is locked out', async () => {
  const inactiveUsers = { findById: async () => ({ ...USER, is_active: false }) };
  const mw = createAuthMiddleware({ users: inactiveUsers }).requireAuth;
  const { err } = await run(mw, { headers: { authorization: `Bearer ${signToken(USER)}` } });
  assert.equal(err.status, 401);
  assert.match(err.message, /inactive/i);
});

test('requireRole: allows listed roles and blocks others', async () => {
  const adminGuard = requireRole('admin');
  const residentReq = { user: { ...USER, role: 'resident' } };
  let out = null;
  adminGuard(residentReq, {}, (err) => { out = err; });
  assert.equal(out.status, 403);

  out = null;
  adminGuard({ user: { ...USER, role: 'admin' } }, {}, (err) => { out = err; });
  assert.equal(out, undefined, 'admin passes');
});

test('requireRole: 401 when the request never authenticated', async () => {
  let out = null;
  requireRole('admin')({}, {}, (err) => { out = err; });
  assert.equal(out.status, 401);
});

test('optionalAuth: anonymous requests continue without a user', async () => {
  const { err, req } = await run(optionalAuth);
  assert.equal(err, undefined);
  assert.equal(req.user, undefined);
});
