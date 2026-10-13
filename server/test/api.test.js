process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret';

const { strict: assert } = require('node:assert');
const { test, before, after } = require('node:test');

const { createApp } = require('../src/app');
const { createAuthMiddleware } = require('../src/middleware/auth');
const { signToken } = require('../src/utils/tokens');
const { ApiError } = require('../src/utils/errors');

// ---------------------------------------------------------------------
// Hand-written container: same shape as src/container.js, no database.
// ---------------------------------------------------------------------
const resident = {
  id: 'u-resident', phone: '9000000003', full_name: 'Rahul Verma', role: 'resident',
  flat_id: 'f-2', flat_label: 'B-202', is_active: true, email: null, avatar_url: null, joined_on: '2024-03-10',
};
const admin = {
  id: 'u-admin', phone: '9000000001', full_name: 'Aarav Sharma', role: 'admin',
  flat_id: 'f-1', flat_label: 'A-101', is_active: true, email: null, avatar_url: null, joined_on: '2024-01-15',
};
const byId = { [resident.id]: resident, [admin.id]: admin };

const complaint = {
  id: 'c-1', reference_no: 'CC-20261008-0001', raised_by: resident.id, category_id: 1,
  title: 'Leaking tap in kitchen', status: 'submitted', updates: [],
};

function makeContainer() {
  const users = {
    findById: async (id) => byId[id] || null,
    listResidents: async ({ limit = 20, page = 1 } = {}) => ({
      items: [resident], total: 2, page: Number(page), limit: Number(limit),
    }),
    listFlats: async () => [{ id: 'f-1', block: 'A', flat_number: '101' }],
    updateProfile: async (id, patch) => ({ ...byId[id], ...patch }),
    login: async (phone) => (phone === admin.phone ? admin : resident),
  };

  const auth = {
    requestOtp: async (phone) => ({ sent: true, expiresIn: 5, devOtp: '123456', phone }),
    verifyOtp: async (phone, code) => {
      if (String(code) !== '123456') throw ApiError.badRequest('Incorrect OTP');
      const user = phone === admin.phone ? admin : resident;
      return { token: signToken(user), user, isNewUser: false };
    },
    logout: async () => ({ ok: true }),
  };

  const notifications = {
    registerDevice: async () => ({ id: 'd-1' }),
    list: async () => [{ id: 1, title: 'Welcome', read_at: null }],
    unreadCount: async () => 3,
    markRead: async () => true,
    markAllRead: async () => 3,
  };

  const visitors = {
    createPass: async (actor, input) => ({
      id: 'v-1', host_id: actor.id, status: 'pending', otp_code: '482913', ...input,
    }),
    listForHost: async () => ({ items: [], total: 0, page: 1, limit: 20 }),
    listAll: async () => ({ items: [], total: 0, page: 1, limit: 20 }),
    getPass: async (id) => ({
      id,
      host_id: id === 'v-other' ? 'u-someone-else' : resident.id,
      status: 'pending', otp_code: '482913',
      visitor_name: 'Guest', visitor_phone: '9812345678', purpose: 'Guest',
      valid_from: new Date().toISOString(), valid_until: new Date(Date.now() + 864e5).toISOString(),
    }),
    getLogs: async () => [],
    decide: async (id, actor, action) => {
      const pass = await visitors.getPass(id);
      if (pass.host_id !== actor.id) throw ApiError.forbidden('This visitor pass belongs to another resident');
      return { ...pass, status: action === 'approve' ? 'approved' : 'rejected' };
    },
    cancel: async (id) => ({ id, status: 'rejected' }),
    verifyAtGate: async ({ code, channel }) => {
      if (channel === 'qr' && code !== '482913-qr') throw ApiError.notFound('No visitor pass matches this OTP/QR');
      return visitors.getPass('v-1');
    },
    recordEntry: async (id) => ({ id, status: 'checked_in' }),
    recordExit: async (id) => ({ id, status: 'checked_out' }),
    denyEntry: async (id) => ({ id, status: 'denied' }),
    currentInside: async () => [],
    stats: async () => ({ byStatus: [], todayEntries: 0, currentlyInside: 0 }),
  };

  const complaints = {
    listCategories: async () => [{ id: 1, name: 'Plumbing', icon: 'water' }],
    create: async (actor, input) => ({ ...complaint, raised_by: actor.id, ...input }),
    get: async (id) => ({ ...complaint, id }),
    listMine: async () => ({ items: [complaint], total: 1, page: 1, limit: 20 }),
    listAll: async () => ({ items: [complaint], total: 1, page: 1, limit: 20 }),
    updateStatus: async (id, actor, status) => ({ ...complaint, id, status }),
    stats: async () => ({
      byStatus: [{ status: 'submitted', count: 1 }],
      byCategory: [{ name: 'Plumbing', count: 1 }],
      open: 1, avgResolutionHours: 0,
    }),
  };

  const bookings = {
    listAmenities: async () => [{ id: 1, name: 'Gym' }],
    listSlots: async () => [],
    book: async (actor, slotId) => ({ id: 'b-1', slot_id: slotId, user_id: actor.id, status: 'confirmed' }),
    getBooking: async (id) => ({ id, status: 'confirmed' }),
    cancel: async (actor, id) => ({ id, status: 'cancelled' }),
    history: async () => ({ items: [], total: 0, page: 1, limit: 20 }),
    upcoming: async () => [],
    generateSlots: async (id, from, to) => ({ created: 14, from, to, id }),
    blockSlot: async (id) => ({ id, is_blocked: true }),
    listAllBookings: async () => ({ items: [], total: 0, page: 1, limit: 20 }),
    stats: async () => ({ byAmenity: [], today: 0, upcoming: 0 }),
  };

  const marketplace = {
    search: async () => ({ items: [], total: 0, page: 1, limit: 20, categories: [] }),
    get: async (id) => ({ id, status: 'approved', seller_id: resident.id, title: 'Cookies' }),
    create: async (actor, input) => ({ id: 'm-1', seller_id: actor.id, status: 'pending', ...input }),
    listMine: async () => ({ items: [], total: 0, page: 1, limit: 20 }),
    listAll: async () => ({ items: [], total: 0, page: 1, limit: 20, counts: [{ status: 'pending', count: 1 }] }),
    moderate: async (id, actor, patch) => ({ id, ...patch }),
    remove: async (id) => ({ id, deleted: true }),
    contactSeller: async () => ({ enquiry: { id: 1 }, sellerPhone: '9000000003' }),
    myEnquiries: async () => [],
  };

  const announcements = {
    list: async () => ({ items: [{ id: 'a-1', title: 'Water cut' }], total: 1, page: 1, limit: 20 }),
    get: async (id) => ({ id, title: 'Water cut' }),
    create: async (actor, input) => ({ id: 'a-1', ...input }),
    update: async (id, input) => ({ id, ...input }),
    remove: async (id) => ({ id, deleted: true }),
    stats: async () => ({ total: 3, last7Days: 1 }),
  };

  const events = {
    list: async () => ({ items: [], total: 0, page: 1, limit: 20 }),
    get: async (id) => ({ id, title: 'Diwali Night', isRegistered: false, registrationOpen: true }),
    create: async (actor, input) => ({ id: 'e-1', ...input }),
    register: async (actor, id) => ({ id, isRegistered: true }),
    myRegistrations: async () => [],
    updateStatus: async (id, status) => ({ id, status }),
    stats: async () => ({ total: 3, upcoming: 3, registrations: 12 }),
  };

  return {
    users, auth, notifications, visitors, complaints, bookings,
    marketplace, announcements, events,
    authMw: createAuthMiddleware({ users }),
  };
}

// ---------------------------------------------------------------------
const container = makeContainer();
const app = createApp(container);
let server;
let base;

before(async () => {
  await new Promise((resolve) => { server = app.listen(0, resolve); });
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => server && server.close());

const call = async (method, path, { token, body, headers = {} } = {}) => {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try { json = await res.json(); } catch (err) { /* empty body */ }
  return { status: res.status, body: json };
};

const login = async (phone) => {
  const res = await call('POST', '/api/auth/otp/verify', { body: { phone, code: '123456' } });
  return res.body.data.token;
};

// ---------------------------------------------------------------------
test('health endpoint answers without auth', async () => {
  const res = await call('GET', '/health');
  assert.equal(res.status, 200);
  assert.equal(res.body.data.status, 'ok');
});

test('unknown routes return a structured 404', async () => {
  const res = await call('GET', '/api/nope');
  assert.equal(res.status, 404);
  assert.equal(res.body.error.code, 'not_found');
});

test('OTP request validates the mobile number', async () => {
  const bad = await call('POST', '/api/auth/otp/request', { body: { phone: '123' } });
  assert.equal(bad.status, 422);
  assert.equal(bad.body.error.code, 'validation_error');

  const ok = await call('POST', '/api/auth/otp/request', { body: { phone: '9000000003' } });
  assert.equal(ok.status, 200);
  assert.equal(ok.body.data.sent, true);
  assert.equal(ok.body.data.devOtp, '123456');
});

test('OTP verify issues a token, then /me returns the profile', async () => {
  const verify = await call('POST', '/api/auth/otp/verify', { body: { phone: '9000000003', code: '123456' } });
  assert.equal(verify.status, 200);
  const token = verify.body.data.token;
  assert.ok(token && token.split('.').length === 3);

  const me = await call('GET', '/api/auth/me', { token });
  assert.equal(me.status, 200);
  assert.equal(me.body.data.role, 'resident');
  assert.equal(me.body.data.flatLabel, 'B-202');
});

test('wrong OTP is rejected', async () => {
  const res = await call('POST', '/api/auth/otp/verify', { body: { phone: '9000000003', code: '999999' } });
  assert.equal(res.status, 400);
  assert.match(res.body.error.message, /Incorrect OTP/);
});

test('protected endpoints require a token', async () => {
  const res = await call('GET', '/api/complaints');
  assert.equal(res.status, 401);
  assert.equal(res.body.error.code, 'unauthorized');
});

test('residents cannot reach the admin panel endpoints', async () => {
  const token = await login('9000000003');
  const res = await call('GET', '/api/admin/reports', { token });
  assert.equal(res.status, 403);
  assert.equal(res.body.error.code, 'forbidden');
});

test('admins get the dashboard report', async () => {
  const token = await login('9000000001');
  const res = await call('GET', '/api/admin/reports', { token });
  assert.equal(res.status, 200);
  assert.ok(res.body.data.overview.residents >= 0);
  assert.ok(res.body.data.complaints.byStatus.length >= 0);
});

test('creating a complaint validates required fields', async () => {
  const token = await login('9000000003');
  const res = await call('POST', '/api/complaints', { token, body: { description: 'short' } });
  assert.equal(res.status, 422);
  const fields = res.body.error.details.map((d) => d.field);
  assert.ok(fields.includes('title'));
  assert.ok(fields.includes('categoryId'));
});

test('residents can create a complaint and list their own', async () => {
  const token = await login('9000000003');
  const created = await call('POST', '/api/complaints', {
    token,
    body: { title: 'Leaking tap', description: 'Water is dripping constantly in the kitchen sink', categoryId: 1 },
  });
  assert.equal(created.status, 201);
  assert.match(created.body.data.reference_no, /^CC-\d{8}-\d{4}$/);

  const list = await call('GET', '/api/complaints', { token });
  assert.equal(list.status, 200);
  assert.equal(list.body.data.total, 1);
});

test('admins can list every complaint; residents cannot', async () => {
  const residentToken = await login('9000000003');
  const denied = await call('GET', '/api/complaints/all', { token: residentToken });
  assert.equal(denied.status, 403);

  const adminToken = await login('9000000001');
  const res = await call('GET', '/api/complaints/all', { token: adminToken });
  assert.equal(res.status, 200);
  assert.ok(Array.isArray(res.body.data.items));
});

test('a resident can only approve their own visitor pass', async () => {
  const token = await login('9000000003');
  const res = await call('POST', '/api/visitors/v-other/approve', { token });
  assert.equal(res.status, 403);
});

test('residents may not create walk-in passes at the gate', async () => {
  const token = await login('9000000003');
  const res = await call('POST', '/api/visitors', { token, body: { visitorName: 'Delivery', passType: 'walkin' } });
  assert.equal(res.status, 403);
  assert.match(res.body.error.message, /pre-approve/i);
});

test('pre-approving a visitor works and returns the gate OTP', async () => {
  const token = await login('9000000003');
  const res = await call('POST', '/api/visitors', {
    token,
    body: { visitorName: 'Guest', visitorPhone: '9812345678', purpose: 'Friends', passType: 'preapproved' },
  });
  assert.equal(res.status, 201);
  assert.equal(res.body.data.otp_code, '482913');
});

test('security gate verification accepts the right OTP and rejects junk', async () => {
  const token = await login('9000000001'); // admin also has gate access
  const ok = await call('POST', '/api/security/verify', { token, body: { code: '482913', channel: 'otp' } });
  assert.equal(ok.status, 200);

  const bad = await call('POST', '/api/security/verify', { token, body: { code: '111111', channel: 'qr' } });
  assert.equal(bad.status, 404);
});

test('marketplace admin moderation is admin-only', async () => {
  const residentToken = await login('9000000003');
  const denied = await call('GET', '/api/marketplace/admin', { token: residentToken });
  assert.equal(denied.status, 403);

  const adminToken = await login('9000000001');
  const allowed = await call('GET', '/api/marketplace/admin', { token: adminToken });
  assert.equal(allowed.status, 200);
});

test('notifications feed and unread counter work for residents', async () => {
  const token = await login('9000000003');
  const list = await call('GET', '/api/notifications', { token });
  assert.equal(list.status, 200);
  assert.equal(list.body.data.length, 1);

  const count = await call('GET', '/api/notifications/unread-count', { token });
  assert.equal(count.body.data.count, 3);

  const readAll = await call('POST', '/api/notifications/read-all', { token });
  assert.equal(readAll.body.data.updated, 3);
});

test('booking flow: amenities list, slot validation, cancel', async () => {
  const token = await login('9000000003');

  const amenities = await call('GET', '/api/bookings/amenities', { token });
  assert.equal(amenities.status, 200);
  assert.equal(amenities.body.data[0].name, 'Gym');

  const missingArgs = await call('GET', '/api/bookings/slots', { token });
  assert.equal(missingArgs.status, 400);

  const badDate = await call('GET', '/api/bookings/slots?amenityId=1&date=10-10-2026', { token });
  assert.equal(badDate.status, 400);

  const booked = await call('POST', '/api/bookings/book', { token, body: { slotId: 12, attendees: 2 } });
  assert.equal(booked.status, 201);
  assert.equal(booked.body.data.status, 'confirmed');

  const cancelled = await call('DELETE', '/api/bookings/b-1', { token });
  assert.equal(cancelled.status, 200);
  assert.equal(cancelled.body.data.status, 'cancelled');
});
