const { ApiError } = require('../../utils/errors');

const SELECT = `
  SELECT e.*, u.full_name AS author_name,
         (SELECT COUNT(*)::int FROM event_registrations r
           WHERE r.event_id = e.id AND r.status = 'registered') AS registered_count,
         (SELECT COUNT(*)::int FROM event_registrations r
           WHERE r.event_id = e.id AND r.status = 'registered' AND r.user_id = $1) AS is_registered
    FROM events e
    LEFT JOIN users u ON u.id = e.author_id
`;

function createEventsService({ db, notifications }) {
  async function decorate(rows, actor) {
    return rows.map((e) => ({
      ...e,
      isRegistered: Boolean(Number(e.is_registered)),
      spotsLeft: e.capacity ? Math.max(0, Number(e.capacity) - Number(e.registered_count)) : null,
      registrationOpen: Boolean(
        e.status === 'published' &&
        (!e.registration_deadline || new Date(e.registration_deadline) > new Date()) &&
        (!e.capacity || Number(e.registered_count) < Number(e.capacity))
      ),
    }));
  }

  async function list(actor, { upcoming = true, page = 1, limit = 20 } = {}) {
    const params = [actor?.id || null];
    let where = `WHERE e.status IN ('published','completed')`;
    if (upcoming) where += ` AND e.starts_at >= NOW() - INTERVAL '1 day'`;
    const total = Number(await db.scalar(`SELECT COUNT(*) FROM events e ${where}`, params) || 0);
    const lim = Math.min(Number(limit) || 20, 100);
    params.push(lim, (Math.max(1, Number(page) || 1) - 1) * lim);
    const rows = await db.many(
      `${SELECT} ${where} ORDER BY e.starts_at ASC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    return { items: await decorate(rows, actor), total, page: Number(page) || 1, limit: lim };
  }

  async function get(id, actor) {
    const rows = await db.many(`${SELECT} WHERE e.id = $2`, [actor?.id || null, id]);
    if (!rows.length) throw ApiError.notFound('Event not found');
    return (await decorate(rows, actor))[0];
  }

  async function create(actor, input) {
    if (new Date(input.startsAt) <= new Date()) throw ApiError.badRequest('Event start must be in the future');
    if (input.endsAt && new Date(input.endsAt) <= new Date(input.startsAt)) {
      throw ApiError.badRequest('Event end must be after the start');
    }
    const row = await db.one(
      `INSERT INTO events (author_id, title, description, venue, starts_at, ends_at,
                           image_url, capacity, registration_deadline, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'published') RETURNING *`,
      [
        actor.id, input.title, input.description || null, input.venue || null,
        input.startsAt, input.endsAt || null, input.imageUrl || null,
        input.capacity || null, input.registrationDeadline || null,
      ]
    );
    await notifications.notify({
      broadcast: true,
      type: 'event',
      title: `New event: ${input.title}`,
      body: `${input.venue || 'Community'} • ${new Date(input.startsAt).toLocaleString('en-IN')}`,
      data: { eventId: row.id },
    });
    return get(row.id, actor);
  }

  async function register(actor, eventId, { register = true } = {}) {
    const event = await get(eventId, actor);
    if (register) {
      if (!event.registrationOpen) {
        throw ApiError.badRequest(
          event.capacity
            ? 'This event is full. Contact the admin to join the waitlist.'
            : 'Registration for this event is closed'
        );
      }
      if (event.isRegistered) throw ApiError.conflict('You are already registered for this event');
      await db.query(
        `INSERT INTO event_registrations (event_id, user_id, status) VALUES ($1, $2, 'registered')
         ON CONFLICT (event_id, user_id) DO UPDATE SET status = 'registered'`,
        [eventId, actor.id]
      );
      await notifications.notify({
        userId: actor.id,
        type: 'event',
        title: `Registered for ${event.title}`,
        body: `See you at ${event.venue || 'the community'}!`,
        data: { eventId },
      });
    } else {
      if (!event.isRegistered) throw ApiError.badRequest('You are not registered for this event');
      await db.query(
        `UPDATE event_registrations SET status = 'cancelled' WHERE event_id = $1 AND user_id = $2`,
        [eventId, actor.id]
      );
    }
    return get(eventId, actor);
  }

  async function myRegistrations(actor) {
    const rows = await db.many(
      `SELECT e.*, r.status AS registration_status, r.created_at AS registered_at
         FROM event_registrations r JOIN events e ON e.id = r.event_id
        WHERE r.user_id = $1 AND r.status = 'registered'
        ORDER BY e.starts_at ASC`,
      [actor.id]
    );
    return rows;
  }

  async function updateStatus(id, status) {
    if (!['draft', 'published', 'cancelled', 'completed'].includes(status)) {
      throw ApiError.badRequest('Invalid event status');
    }
    const row = await db.one('UPDATE events SET status = $1 WHERE id = $2 RETURNING id', [status, id]);
    if (!row) throw ApiError.notFound('Event not found');
    if (status === 'cancelled') {
      await notifications.notify({
        broadcast: true,
        type: 'event',
        title: 'Event cancelled',
        body: 'An event you may be registered for has been cancelled.',
        data: { eventId: id },
      });
    }
    return get(id, { id: null });
  }

  async function stats() {
    const total = Number(await db.scalar(`SELECT COUNT(*) FROM events`) || 0);
    const registrations = Number(
      (await db.scalar(`SELECT COUNT(*) FROM event_registrations WHERE status = 'registered'`)) || 0
    );
    const upcoming = Number(
      (await db.scalar(`SELECT COUNT(*) FROM events WHERE status = 'published' AND starts_at > NOW()`)) || 0
    );
    return { total, upcoming, registrations };
  }

  return { list, get, create, register, myRegistrations, updateStatus, stats };
}

module.exports = { createEventsService, SELECT };
