const { ApiError } = require('../../utils/errors');

const CATEGORIES = ['general', 'maintenance', 'security', 'event', 'emergency'];

const SELECT = `
  SELECT a.*, u.full_name AS author_name
    FROM announcements a
    LEFT JOIN users u ON u.id = a.author_id
`;

function createAnnouncementsService({ db, notifications }) {
  async function list(actor, { category, page = 1, limit = 20, pinnedFirst = true } = {}) {
    const where = [`(a.audience = 'all' OR a.audience = $1)`];
    const params = [actor?.role || 'resident'];
    if (category) { params.push(category); where.push(`a.category = $${params.length}`); }
    const whereSql = `WHERE ${where.join(' AND ')}`;
    const total = Number(await db.scalar(`SELECT COUNT(*) FROM announcements a ${whereSql}`, params) || 0);
    const lim = Math.min(Number(limit) || 20, 100);
    params.push(lim, (Math.max(1, Number(page) || 1) - 1) * lim);
    const order = pinnedFirst ? 'a.is_pinned DESC, a.published_at DESC' : 'a.published_at DESC';
    const items = await db.many(
      `${SELECT} ${whereSql} ORDER BY ${order} LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    return { items, total, page: Number(page) || 1, limit: lim };
  }

  async function get(id) {
    const item = await db.one(`${SELECT} WHERE a.id = $1`, [id]);
    if (!item) throw ApiError.notFound('Announcement not found');
    return item;
  }

  async function create(actor, input) {
    if (!CATEGORIES.includes(input.category)) throw ApiError.badRequest('Invalid announcement category');
    const row = await db.one(
      `INSERT INTO announcements (author_id, title, body, category, image_url, is_pinned, audience, published_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7, NOW()) RETURNING *`,
      [
        actor.id,
        input.title,
        input.body,
        input.category,
        input.imageUrl || null,
        Boolean(input.isPinned),
        input.audience || 'all',
      ]
    );

    await notifications.notify({
      broadcast: true,
      roles: input.audience && input.audience !== 'all' ? [input.audience] : null,
      type: 'announcement',
      title: input.title,
      body: input.body.slice(0, 140),
      data: { announcementId: row.id, category: input.category },
    });
    return get(row.id);
  }

  async function update(id, input) {
    const fields = [];
    const params = [];
    const map = {
      title: input.title, body: input.body, category: input.category,
      is_pinned: input.isPinned, audience: input.audience, image_url: input.imageUrl,
    };
    for (const [col, val] of Object.entries(map)) {
      if (val !== undefined) { params.push(val); fields.push(`${col} = $${params.length}`); }
    }
    if (!fields.length) return get(id);
    params.push(id);
    await db.query(`UPDATE announcements SET ${fields.join(', ')} WHERE id = $${params.length}`, params);
    return get(id);
  }

  async function remove(id) {
    const res = await db.query('DELETE FROM announcements WHERE id = $1', [id]);
    if (!res.rowCount) throw ApiError.notFound('Announcement not found');
    return { id, deleted: true };
  }

  async function stats() {
    const total = Number(await db.scalar('SELECT COUNT(*) FROM announcements') || 0);
    const last7 = Number(
      (await db.scalar(`SELECT COUNT(*) FROM announcements WHERE published_at > NOW() - INTERVAL '7 days'`)) || 0
    );
    return { total, last7Days: last7 };
  }

  return { list, get, create, update, remove, stats, CATEGORIES };
}

module.exports = { createAnnouncementsService, CATEGORIES, SELECT };
