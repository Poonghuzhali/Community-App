const { ApiError } = require('../../utils/errors');

const USER_SELECT = `
  SELECT u.id, u.phone, u.full_name, u.email, u.role, u.flat_id, u.avatar_url,
         u.is_active, u.joined_on, u.created_at,
         f.block, f.flat_number, f.floor, f.bhk,
         CASE WHEN f.id IS NULL THEN NULL
              ELSE f.block || '-' || f.flat_number END AS flat_label
    FROM users u
    LEFT JOIN flats f ON f.id = u.flat_id
`;

function createUsersService({ db }) {
  const findById = (id) => db.one(`${USER_SELECT} WHERE u.id = $1`, [id]);
  const findByPhone = (phone) => db.one(`${USER_SELECT} WHERE u.phone = $1`, [phone]);

  /** Called after a successful OTP login; creates the account on first login. */
  async function login(phone) {
    const existing = await findByPhone(phone);
    if (existing) {
      if (existing.is_active === false) throw ApiError.forbidden('Your account has been deactivated. Contact the admin.');
      return existing;
    }
    const created = await db.one(
      `INSERT INTO users (phone, full_name, role, joined_on)
       VALUES ($1, $2, 'resident', CURRENT_DATE)
       RETURNING id`,
      [phone, 'New Resident']
    );
    return findById(created.id);
  }

  async function updateProfile(id, patch) {
    const fields = [];
    const params = [];
    const map = {
      full_name: patch.fullName,
      email: patch.email,
      avatar_url: patch.avatarUrl,
      joined_on: patch.joinedOn,
    };
    for (const [col, value] of Object.entries(map)) {
      if (value !== undefined) {
        params.push(value);
        fields.push(`${col} = $${params.length}`);
      }
    }
    if (!fields.length) return findById(id);
    params.push(id);
    await db.query(`UPDATE users SET ${fields.join(', ')} WHERE id = $${params.length}`, params);
    return findById(id);
  }

  async function assignFlat(id, flatId) {
    if (flatId === null) {
      await db.query('UPDATE users SET flat_id = NULL WHERE id = $1', [id]);
      return findById(id);
    }
    const flat = await db.one('SELECT id FROM flats WHERE id = $1', [flatId]);
    if (!flat) throw ApiError.notFound('Flat not found');
    await db.query('UPDATE users SET flat_id = $1 WHERE id = $2', [flatId, id]);
    return findById(id);
  }

  async function listFlats() {
    return db.many(
      `SELECT f.*, (SELECT COUNT(*)::int FROM users u WHERE u.flat_id = f.id) AS resident_count
         FROM flats f ORDER BY f.block, f.flat_number`
    );
  }

  /** Admin: resident directory with search + pagination. */
  async function listResidents({ q = '', role = null, page = 1, limit = 20 } = {}) {
    const where = [];
    const params = [];
    if (q) {
      params.push(`%${q}%`);
      where.push(`(u.full_name ILIKE $${params.length} OR u.phone ILIKE $${params.length}
                   OR (f.block || '-' || f.flat_number) ILIKE $${params.length})`);
    }
    if (role) {
      params.push(role);
      where.push(`u.role = $${params.length}`);
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const total = Number(
      (await db.scalar(
        `SELECT COUNT(*) FROM users u LEFT JOIN flats f ON f.id = u.flat_id ${whereSql}`,
        params
      )) || 0
    );
    params.push(Number(limit) || 20, (Math.max(1, Number(page) || 1) - 1) * (Number(limit) || 20));
    const rows = await db.many(
      `${USER_SELECT} ${whereSql} ORDER BY u.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    return { items: rows, total, page: Number(page) || 1, limit: Number(limit) || 20 };
  }

  async function adminCreateResident({ phone, fullName, email, role, flatId }) {
    const clash = await findByPhone(phone);
    if (clash) throw ApiError.conflict('A user with this mobile number already exists');
    const created = await db.one(
      `INSERT INTO users (phone, full_name, email, role, flat_id, joined_on)
       VALUES ($1, $2, $3, $4, $5, CURRENT_DATE) RETURNING id`,
      [phone, fullName || null, email || null, role || 'resident', flatId || null]
    );
    return findById(created.id);
  }

  async function updateUser(id, patch) {
    const allowed = ['full_name', 'email', 'role', 'is_active', 'flat_id'];
    const fields = [];
    const params = [];
    for (const key of allowed) {
      if (patch[key] !== undefined) {
        params.push(patch[key]);
        fields.push(`${key} = $${params.length}`);
      }
    }
    if (!fields.length) return findById(id);
    params.push(id);
    const exists = await db.one('SELECT id FROM users WHERE id = $1', [id]);
    if (!exists) throw ApiError.notFound('Resident not found');
    await db.query(`UPDATE users SET ${fields.join(', ')} WHERE id = $${params.length}`, params);
    return findById(id);
  }

  async function removeDeviceToken(userId, token) {
    await db.query('DELETE FROM device_tokens WHERE user_id = $1 AND token = $2', [userId, token]);
    return { ok: true };
  }

  return {
    findById, findByPhone, login, updateProfile, assignFlat, listFlats,
    listResidents, adminCreateResident, updateUser, removeDeviceToken, USER_SELECT,
  };
}

module.exports = { createUsersService, USER_SELECT };
