/**
 * Notification centre: durable in-app feed + best-effort FCM push.
 *
 * notify()  -> single user or broadcast (userId = null)
 * fanout()  -> explicit list of user ids
 */
function createNotificationService({ db, push }) {
  async function insertRows(userIds, { type, title, body, data }) {
    if (!userIds.length) return 0;
    let inserted = 0;
    for (const userId of userIds) {
      await db.query(
        `INSERT INTO notifications (user_id, type, title, body, data)
         VALUES ($1, $2, $3, $4, $5)`,
        [userId, type, title, body || '', JSON.stringify(data || {})]
      );
      inserted += 1;
    }
    return inserted;
  }

  async function tokensFor(userIds) {
    if (!userIds.length) return [];
    const placeholders = userIds.map((_, i) => `$${i + 1}`).join(', ');
    const rows = await db.many(
      `SELECT token FROM device_tokens WHERE user_id IN (${placeholders})`,
      userIds
    );
    return rows.map((r) => r.token);
  }

  async function userIdsForAudience({ roles, broadcast }) {
    if (broadcast) {
      const rows = await db.many(`SELECT id FROM users WHERE is_active = TRUE`);
      return rows.map((r) => r.id);
    }
    if (roles && roles.length) {
      const placeholders = roles.map((_, i) => `$${i + 1}`).join(', ');
      const rows = await db.many(
        `SELECT id FROM users WHERE is_active = 1 AND role IN (${placeholders})`,
        roles
      );
      return rows.map((r) => r.id);
    }
    return [];
  }

  async function fanout(userIds, notification) {
    const unique = [...new Set(userIds.filter(Boolean))];
    if (!unique.length) return { notified: 0 };
    const notified = await insertRows(unique, notification);
    const tokens = await tokensFor(unique);
    if (!tokens.length) return { notified, push: { sent: 0, skipped: true } };
    const pushResult = await push.send(tokens, {
      title: notification.title,
      body: notification.body,
      data: notification.data,
    });
    return { notified, push: pushResult };
  }

  async function notify({ userId = null, roles = null, broadcast = false, type, title, body, data }) {
    let targets = [];
    if (userId) targets = [userId];
    else targets = await userIdsForAudience({ roles, broadcast });
    return fanout(targets, { type, title, body, data });
  }

  async function list(userId, { limit = 50, unreadOnly = false, type = null } = {}) {
    const clauses = [`(user_id = $1 OR user_id IS NULL)`];
    const params = [userId];
    if (unreadOnly) clauses.push('read_at IS NULL');
    if (type) {
      params.push(type);
      clauses.push(`type = $${params.length}`);
    }
    params.push(Math.min(Number(limit) || 50, 100));
    return db.many(
      `SELECT id, type, title, body, data, read_at, created_at
         FROM notifications
        WHERE ${clauses.join(' AND ')}
        ORDER BY created_at DESC
        LIMIT $${params.length}`,
      params
    );
  }

  async function unreadCount(userId) {
    return Number(
      (await db.scalar(
        `SELECT COUNT(*) FROM notifications
          WHERE (user_id = $1 OR user_id IS NULL) AND read_at IS NULL`,
        [userId]
      )) || 0
    );
  }

  async function markRead(id, userId) {
    const row = await db.one(
      `UPDATE notifications SET read_at = NOW()
        WHERE id = $1 AND (user_id = $2 OR user_id IS NULL) AND read_at IS NULL
        RETURNING id`,
      [id, userId]
    );
    return Boolean(row);
  }

  async function markAllRead(userId) {
    const result = await db.query(
      `UPDATE notifications SET read_at = NOW()
        WHERE (user_id = $1 OR user_id IS NULL) AND read_at IS NULL`,
      [userId]
    );
    return result.rowCount;
  }

  async function registerDevice(userId, token, platform = 'android') {
    if (!token) return null;
    return db.one(
      `INSERT INTO device_tokens (user_id, token, platform, last_seen_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (user_id, token)
       DO UPDATE SET last_seen_at = NOW(), platform = EXCLUDED.platform
       RETURNING id`,
      [userId, token, platform]
    );
  }

  return {
    notify, fanout, list, unreadCount, markRead, markAllRead, registerDevice,
  };
}

module.exports = { createNotificationService };
