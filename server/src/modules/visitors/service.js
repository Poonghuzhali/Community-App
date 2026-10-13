const { ApiError } = require('../../utils/errors');
const policy = require('./policy');
const { generateOtp } = require('../../utils/otp');

const PASS_SELECT = `
  SELECT v.*, u.full_name AS host_name, u.phone AS host_phone,
         f.block || '-' || f.flat_number AS host_flat,
         vb.full_name AS verified_by_name,
         ab.full_name AS approved_by_name
    FROM visitor_passes v
    JOIN users u ON u.id = v.host_id
    LEFT JOIN flats f ON f.id = u.flat_id
    LEFT JOIN users vb ON vb.id = v.verified_by
    LEFT JOIN users ab ON ab.id = v.approved_by
`;

function createVisitorsService({ db, notifications }) {
  async function log(visitorId, action, actor, remarks) {
    await db.query(
      `INSERT INTO visitor_logs (visitor_id, action, performed_by, performer_role, remarks)
       VALUES ($1, $2, $3, $4, $5)`,
      [visitorId, action, actor?.id || null, actor?.role || null, remarks || null]
    );
  }

  async function notifyHost(pass, { title, body, data }) {
    await notifications.notify({
      userId: pass.host_id,
      type: 'visitor',
      title,
      body,
      data: { visitorId: pass.id, ...data },
    });
  }

  async function notifySecurity({ title, body, data }) {
    await notifications.notify({
      roles: ['security', 'admin'],
      type: 'visitor',
      title,
      body,
      data,
    });
  }

  /** Resident pre-approves a guest, or security logs a walk-in / delivery. */
  async function createPass(actor, input) {
    if (!policy.PASS_TYPES.includes(input.passType)) throw ApiError.badRequest('Invalid pass type');

    const hostId = input.passType === 'preapproved' ? actor.id : (input.hostId || actor.id);
    const otp = input.otp || generateOtp(6);
    const validFrom = input.validFrom || new Date();
    const validUntil = input.validUntil || new Date(Date.now() + 12 * 3600 * 1000);

    const pass = await db.one(
      `INSERT INTO visitor_passes
         (host_id, visitor_name, visitor_phone, visitor_count, purpose, vehicle_number,
          pass_type, delivery_vendor, otp_code, status, valid_from, valid_until, remarks)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       RETURNING *`,
      [
        hostId,
        input.visitorName,
        input.visitorPhone || null,
        input.visitorCount || 1,
        input.purpose || 'Guest',
        input.vehicleNumber || null,
        input.passType,
        input.deliveryVendor || null,
        otp,
        input.passType === 'walkin' ? 'checked_in' : 'pending',
        validFrom,
        validUntil,
        input.remarks || null,
      ]
    );

    if (input.passType === 'walkin') {
      await db.query('UPDATE visitor_passes SET entry_at = NOW() WHERE id = $1', [pass.id]);
    }

    await log(pass.id, 'requested', actor, `Pass type: ${input.passType}`);
    if (input.passType !== 'preapproved') {
      await log(pass.id, 'entry', actor, 'Walk-in / delivery entry recorded at gate');
    }

    const full = await getPass(pass.id);
    await notifySecurity({
      title: input.passType === 'delivery' ? `Delivery: ${input.visitorName}` : `New visitor request: ${input.visitorName}`,
      body: `${full.host_flat} • ${input.purpose}`,
      data: { visitorId: pass.id, passType: input.passType },
    });
    if (input.passType !== 'preapproved' && hostId !== actor.id) {
      await notifyHost(full, {
        title: `${input.passType === 'delivery' ? 'Delivery' : 'Visitor'} at the gate: ${input.visitorName}`,
        body: `${input.purpose}. Tap to approve or reject.`,
        data: { visitorId: pass.id },
      });
    }
    return full;
  }

  async function getPass(id) {
    const pass = await db.one(`${PASS_SELECT} WHERE v.id = $1`, [id]);
    if (!pass) throw ApiError.notFound('Visitor pass not found');
    return pass;
  }

  async function listForHost(hostId, { status, page = 1, limit = 20, includeHistory = true } = {}) {
    const where = ['v.host_id = $1'];
    const params = [hostId];
    if (status) {
      params.push(status);
      where.push(`v.status = $${params.length}`);
    }
    if (!includeHistory) where.push(`v.status NOT IN ('checked_out','rejected')`);
    const whereSql = `WHERE ${where.join(' AND ')}`;
    const total = Number(await db.scalar(`SELECT COUNT(*) FROM visitor_passes v ${whereSql}`, params) || 0);
    const lim = Number(limit) || 20;
    params.push(lim, (Math.max(1, Number(page) || 1) - 1) * lim);
    const items = await db.many(
      `${PASS_SELECT} ${whereSql} ORDER BY v.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    return { items, total, page: Number(page) || 1, limit: lim };
  }

  /** Admin / security view of every visitor. */
  async function listAll({ status, q, page = 1, limit = 20, from, to } = {}) {
    const where = [];
    const params = [];
    if (status) { params.push(status); where.push(`v.status = $${params.length}`); }
    if (q) {
      params.push(`%${q}%`);
      where.push(`(v.visitor_name ILIKE $${params.length} OR v.visitor_phone ILIKE $${params.length}
                   OR v.vehicle_number ILIKE $${params.length} OR u.full_name ILIKE $${params.length})`);
    }
    if (from) { params.push(from); where.push(`v.created_at >= $${params.length}::timestamptz`); }
    if (to)   { params.push(to);   where.push(`v.created_at <= $${params.length}::timestamptz`); }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const total = Number(
      (await db.scalar(
        `SELECT COUNT(*) FROM visitor_passes v JOIN users u ON u.id = v.host_id ${whereSql}`,
        params
      )) || 0
    );
    const lim = Number(limit) || 20;
    params.push(lim, (Math.max(1, Number(page) || 1) - 1) * lim);
    const items = await db.many(
      `${PASS_SELECT} ${whereSql} ORDER BY v.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    return { items, total, page: Number(page) || 1, limit: lim };
  }

  async function decide(id, actor, action) {
    const pass = await getPass(id);
    policy.assertHostCanAct(pass, action, actor.id);

    const status = action === 'approve' ? 'approved' : 'rejected';
    const updated = await db.one(
      `UPDATE visitor_passes SET status = $1, approved_by = $2 WHERE id = $3 RETURNING *`,
      [status, actor.id, id]
    );
    await log(id, status, actor, action === 'approve' ? 'Approved from app' : 'Rejected from app');

    const full = await getPass(id);
    await notifyHost(full, {
      title: `Visitor ${status}: ${pass.visitor_name}`,
      body: action === 'approve'
        ? `Share OTP ${pass.otp_code} or the QR with ${pass.visitor_name} at the gate.`
        : `${pass.visitor_name} will not be allowed entry.`,
      data: { visitorId: id, status },
    });
    return { ...full, _updated: updated };
  }

  async function cancel(id, actor) {
    const pass = await getPass(id);
    if (pass.host_id !== actor.id && actor.role !== 'admin') throw ApiError.forbidden('Not your visitor pass');
    if (!['pending', 'approved'].includes(pass.status)) {
      throw ApiError.badRequest(`Cannot cancel a pass that is ${pass.status}`);
    }
    await db.query(`UPDATE visitor_passes SET status = 'rejected' WHERE id = $1`, [id]);
    await log(id, 'rejected', actor, 'Cancelled by host');
    return getPass(id);
  }

  /** Security: verify a visitor by OTP or QR at the gate. */
  async function verifyAtGate({ code, channel }, actor) {
    if (!code) throw ApiError.badRequest('OTP or QR code is required');
    const token = String(code).trim().toUpperCase().replace(/^CC:/, '');

    let pass = null;
    if (channel === 'qr') {
      pass = await db.one(`${PASS_SELECT} WHERE v.qr_token::text = $1`, [token]);
    } else {
      pass = await db.one(`${PASS_SELECT} WHERE upper(v.otp_code) = $1 ORDER BY v.created_at DESC LIMIT 1`, [token]);
    }
    policy.assertVerifiable(pass);
    policy.assertEntryAllowed(pass);
    return pass;
  }

  async function recordEntry(id, actor, remarks) {
    const pass = await getPass(id);
    policy.assertEntryAllowed(pass);
    const updated = await db.one(
      `UPDATE visitor_passes
          SET status = 'checked_in', entry_at = COALESCE(entry_at, NOW()), verified_by = $1
        WHERE id = $2 RETURNING *`,
      [actor.id, id]
    );
    await log(id, 'entry', actor, remarks || 'Entry recorded');
    await log(id, 'otp_verified', actor, `Verified by ${actor.role}`);
    const full = await getPass(id);
    await notifyHost(full, {
      title: `${pass.visitor_name} has entered the campus`,
      body: remarks || `Entry at ${new Date().toLocaleTimeString('en-IN')}`,
      data: { visitorId: id, event: 'entry' },
    });
    return { ...full, _updated: updated };
  }

  async function recordExit(id, actor, remarks) {
    const pass = await getPass(id);
    policy.assertExitAllowed(pass);
    await db.query(
      `UPDATE visitor_passes SET status = 'checked_out', exit_at = NOW(), verified_by = $1 WHERE id = $2`,
      [actor.id, id]
    );
    await log(id, 'exit', actor, remarks || 'Exit recorded');
    const full = await getPass(id);
    await notifyHost(full, {
      title: `${pass.visitor_name} has left the campus`,
      body: remarks || 'Exit recorded by security',
      data: { visitorId: id, event: 'exit' },
    });
    return full;
  }

  async function denyEntry(id, actor, remarks) {
    const pass = await getPass(id);
    await log(id, 'denied', actor, remarks || 'Entry denied at gate');
    await notifyHost(pass, {
      title: `Entry denied for ${pass.visitor_name}`,
      body: remarks || 'Security denied entry at the gate',
      data: { visitorId: id, event: 'denied' },
    });
    return getPass(id);
  }

  async function getLogs(id) {
    return db.many(
      `SELECT l.*, u.full_name AS performer_name
         FROM visitor_logs l LEFT JOIN users u ON u.id = l.performed_by
        WHERE l.visitor_id = $1 ORDER BY l.created_at DESC`,
      [id]
    );
  }

  /** Gate screen helper: everyone currently inside + last N exit records. */
  async function currentInside() {
    return db.many(`${PASS_SELECT} WHERE v.status = 'checked_in' ORDER BY v.entry_at DESC`);
  }

  async function stats() {
    const rows = await db.many(
      `SELECT status, COUNT(*)::int AS count FROM visitor_passes
        WHERE created_at > NOW() - INTERVAL '30 days' GROUP BY status`
    );
    const today = Number(
      (await db.scalar(`SELECT COUNT(*) FROM visitor_passes WHERE entry_at::date = CURRENT_DATE`)) || 0
    );
    const inside = Number(
      (await db.scalar(`SELECT COUNT(*) FROM visitor_passes WHERE status = 'checked_in'`)) || 0
    );
    return { byStatus: rows, todayEntries: today, currentlyInside: inside };
  }

  return {
    createPass, getPass, listForHost, listAll, decide, cancel,
    verifyAtGate, recordEntry, recordExit, denyEntry, getLogs, currentInside, stats, log,
  };
}

module.exports = { createVisitorsService, PASS_SELECT };
