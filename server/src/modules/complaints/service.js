const { ApiError } = require('../../utils/errors');
const policy = require('./policy');

const COMPLAINT_SELECT = `
  SELECT c.*, cc.name AS category_name, cc.icon AS category_icon,
         u.full_name AS raised_by_name, f.block || '-' || f.flat_number AS raised_by_flat,
         a.full_name AS assigned_to_name
    FROM complaints c
    JOIN complaint_categories cc ON cc.id = c.category_id
    JOIN users u ON u.id = c.raised_by
    LEFT JOIN flats f ON f.id = u.flat_id
    LEFT JOIN users a ON a.id = c.assigned_to
`;

function createComplaintsService({ db, notifications }) {
  const listCategories = () =>
    db.many(`SELECT id, name, icon, description FROM complaint_categories WHERE is_active = TRUE ORDER BY id`);

  async function create(actor, input) {
    const category = await db.one('SELECT id FROM complaint_categories WHERE id = $1 AND is_active = TRUE', [
      input.categoryId,
    ]);
    if (!category) throw ApiError.badRequest('Please choose a valid complaint category');

    const seq = await db.scalar(
      `UPDATE sequences SET value = value + 1 WHERE name = 'complaint_ref' RETURNING value`
    );
    const referenceNo = policy.nextReference(new Date(), seq);

    const complaint = await db.one(
      `INSERT INTO complaints (reference_no, raised_by, category_id, title, description, image_url, priority)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [
        referenceNo,
        actor.id,
        input.categoryId,
        input.title,
        input.description,
        input.imageUrl || null,
        input.priority || 'medium',
      ]
    );

    await db.query(
      `INSERT INTO complaint_updates (complaint_id, from_status, to_status, note, actor_id)
       VALUES ($1, NULL, 'submitted', 'Complaint registered', $2)`,
      [complaint.id, actor.id]
    );

    await notifications.notify({
      roles: ['admin'],
      type: 'complaint',
      title: `New complaint ${referenceNo}`,
      body: `${input.title} — ${actor.name || actor.phone}`,
      data: { complaintId: complaint.id, referenceNo },
    });
    return get(complaint.id);
  }

  async function get(id) {
    const complaint = await db.one(`${COMPLAINT_SELECT} WHERE c.id = $1`, [id]);
    if (!complaint) throw ApiError.notFound('Complaint not found');
    complaint.updates = await db.many(
      `SELECT cu.*, u.full_name AS actor_name
         FROM complaint_updates cu LEFT JOIN users u ON u.id = cu.actor_id
        WHERE cu.complaint_id = $1 ORDER BY cu.created_at DESC`,
      [id]
    );
    return complaint;
  }

  async function listMine(actor, { status, page = 1, limit = 20 } = {}) {
    const where = ['c.raised_by = $1'];
    const params = [actor.id];
    if (status) { params.push(status); where.push(`c.status = $${params.length}`); }
    const whereSql = `WHERE ${where.join(' AND ')}`;
    const total = Number(await db.scalar(`SELECT COUNT(*) FROM complaints c ${whereSql}`, params) || 0);
    const lim = Math.min(Number(limit) || 20, 100);
    params.push(lim, (Math.max(1, Number(page) || 1) - 1) * lim);
    const items = await db.many(
      `${COMPLAINT_SELECT} ${whereSql} ORDER BY c.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    return { items, total, page: Number(page) || 1, limit: lim };
  }

  async function listAll({ status, categoryId, q, page = 1, limit = 20 } = {}) {
    const where = [];
    const params = [];
    if (status) { params.push(status); where.push(`c.status = $${params.length}`); }
    if (categoryId) { params.push(categoryId); where.push(`c.category_id = $${params.length}`); }
    if (q) {
      params.push(`%${q}%`);
      where.push(`(c.title ILIKE $${params.length} OR c.reference_no ILIKE $${params.length}
                   OR u.full_name ILIKE $${params.length})`);
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const total = Number(
      (await db.scalar(
        `SELECT COUNT(*) FROM complaints c JOIN users u ON u.id = c.raised_by ${whereSql}`,
        params
      )) || 0
    );
    const lim = Math.min(Number(limit) || 20, 100);
    params.push(lim, (Math.max(1, Number(page) || 1) - 1) * lim);
    const items = await db.many(
      `${COMPLAINT_SELECT} ${whereSql} ORDER BY c.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    return { items, total, page: Number(page) || 1, limit: lim };
  }

  /** Admin updates status; residents get a push + in-app notification. */
  async function updateStatus(id, actor, status, note, assign = true) {
    const complaint = await get(id);
    policy.assertTransition(complaint.status, status);

    const assignedTo = assign && status === 'in_progress' ? (actor.id ?? null) : complaint.assigned_to;
    await db.query(
      `UPDATE complaints
          SET status = $1,
              resolution_note = COALESCE($2, resolution_note),
              assigned_to = $3,
              resolved_at = CASE WHEN $1 = 'resolved' THEN NOW() ELSE NULL END
        WHERE id = $4`,
      [status, note || null, assignedTo, id]
    );
    await db.query(
      `INSERT INTO complaint_updates (complaint_id, from_status, to_status, note, actor_id)
       VALUES ($1, $2, $3, $4, $5)`,
      [id, complaint.status, status, note || null, actor.id]
    );

    const label = { submitted: 're-opened', in_progress: 'now in progress', resolved: 'resolved' }[status];
    await notifications.notify({
      userId: complaint.raised_by,
      type: 'complaint',
      title: `Complaint ${complaint.reference_no} is ${label}`,
      body: note || `Status changed to ${status.replace('_', ' ')}`,
      data: { complaintId: id, status },
    });
    return get(id);
  }

  async function stats() {
    const byStatus = await db.many(
      `SELECT status, COUNT(*)::int AS count FROM complaints GROUP BY status`
    );
    const byCategory = await db.many(
      `SELECT cc.name, COUNT(*)::int AS count
         FROM complaints c JOIN complaint_categories cc ON cc.id = c.category_id
        GROUP BY cc.name ORDER BY count DESC`
    );
    const avgResolutionHours = Number(
      (await db.scalar(
        `SELECT COALESCE(AVG((julianday(resolved_at) - julianday(created_at)) * 24), 0)
           FROM complaints WHERE resolved_at IS NOT NULL`
      )) || 0
    );
    const open = Number(
      (await db.scalar(`SELECT COUNT(*) FROM complaints WHERE status <> 'resolved'`)) || 0
    );
    return { byStatus, byCategory, open, avgResolutionHours: Math.round(avgResolutionHours * 10) / 10 };
  }

  return { listCategories, create, get, listMine, listAll, updateStatus, stats };
}

module.exports = { createComplaintsService, COMPLAINT_SELECT };
