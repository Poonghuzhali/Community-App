const { ApiError } = require('../../utils/errors');
const policy = require('./policy');

const BOOKING_SELECT = `
  SELECT b.*, a.name AS amenity_name, a.icon AS amenity_icon, a.location AS amenity_location,
         s.slot_date, s.start_time, s.end_time,
         u.full_name AS user_name, f.block || '-' || f.flat_number AS user_flat
    FROM bookings b
    JOIN amenities a ON a.id = b.amenity_id
    JOIN amenity_slots s ON s.id = b.slot_id
    JOIN users u ON u.id = b.user_id
    LEFT JOIN flats f ON f.id = u.flat_id
`;

const SLOT_SELECT = `
  SELECT s.*, a.name AS amenity_name, a.slot_minutes,
         b.id AS booking_id, b.user_id AS booked_user_id, b.status AS booking_status,
         u.full_name AS booked_by_name
    FROM amenity_slots s
    JOIN amenities a ON a.id = s.amenity_id
    LEFT JOIN bookings b ON b.slot_id = s.id AND b.status = 'confirmed'
    LEFT JOIN users u ON u.id = b.user_id
`;

function createBookingsService({ db, notifications }) {
  const listAmenities = () =>
    db.many(`SELECT * FROM amenities WHERE is_active = TRUE ORDER BY id`);

  async function getAmenity(id) {
    const amenity = await db.one('SELECT * FROM amenities WHERE id = $1', [id]);
    if (!amenity) throw ApiError.notFound('Amenity not found');
    return amenity;
  }

  /** Slots for one amenity + date, with booking ownership annotated. */
  async function listSlots(amenityId, date, { viewerId = null, onlyAvailable = false } = {}) {
    const params = [amenityId, date];
    let sql = `${SLOT_SELECT} WHERE s.amenity_id = $1 AND s.slot_date = $2`;
    if (onlyAvailable) sql += ` AND s.is_blocked = FALSE AND b.id IS NULL`;
    sql += ` ORDER BY s.start_time`;
    const rows = await db.many(sql, params);
    return rows.map((r) => ({
      ...r,
      isMine: Boolean(viewerId && r.booked_user_id === viewerId),
      isAvailable: !r.is_blocked && !r.booking_id,
    }));
  }

  async function book(actor, slotId, { attendees = 1, notes = null } = {}) {
    const slot = await db.one(`${SLOT_SELECT} WHERE s.id = $1`, [slotId]);
    policy.assertBookable(slot, { userId: actor.id });

    let booking;
    try {
      booking = await db.one(
        `INSERT INTO bookings (slot_id, amenity_id, user_id, attendees, notes)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [slotId, slot.amenity_id, actor.id, attendees, notes]
      );
    } catch (err) {
      if (err.code === '23505') throw ApiError.conflict('Sorry, this slot was just booked by someone else');
      throw err;
    }

    await notifications.notify({
      userId: actor.id,
      type: 'booking',
      title: `${slot.amenity_name} booked`,
      body: `${slot.slot_date} • ${slot.start_time} to ${slot.end_time}`,
      data: { bookingId: booking.id, amenity: slot.amenity_name },
    });
    return getBooking(booking.id);
  }

  async function getBooking(id) {
    const booking = await db.one(`${BOOKING_SELECT} WHERE b.id = $1`, [id]);
    if (!booking) throw ApiError.notFound('Booking not found');
    return booking;
  }

  async function cancel(actor, id) {
    const booking = await getBooking(id);
    if (booking.user_id !== actor.id && actor.role !== 'admin') {
      throw ApiError.forbidden('This booking belongs to another resident');
    }
    policy.assertCancellable(booking, { noticeMinutes: actor.role === 'admin' ? 0 : 30 });

    await db.query(
      `UPDATE bookings SET status = 'cancelled', cancelled_at = NOW(), cancelled_by = $1 WHERE id = $2`,
      [actor.id, id]
    );
    await notifications.notify({
      userId: booking.user_id,
      type: 'booking',
      title: `Booking cancelled: ${booking.amenity_name}`,
      body: `${booking.slot_date} • ${booking.start_time}`,
      data: { bookingId: id, status: 'cancelled' },
    });
    return getBooking(id);
  }

  async function history(actor, { status, page = 1, limit = 20 } = {}) {
    const where = ['b.user_id = $1'];
    const params = [actor.id];
    if (status) { params.push(status); where.push(`b.status = $${params.length}`); }
    const whereSql = `WHERE ${where.join(' AND ')}`;
    const total = Number(await db.scalar(`SELECT COUNT(*) FROM bookings b ${whereSql}`, params) || 0);
    const lim = Math.min(Number(limit) || 20, 100);
    params.push(lim, (Math.max(1, Number(page) || 1) - 1) * lim);
    const items = await db.many(
      `${BOOKING_SELECT} ${whereSql} ORDER BY s.slot_date DESC, s.start_time DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    return { items, total, page: Number(page) || 1, limit: lim };
  }

  async function upcoming(actor) {
    return db.many(
      `${BOOKING_SELECT}
        WHERE b.user_id = $1 AND b.status = 'confirmed'
          AND (s.slot_date > CURRENT_DATE
               OR (s.slot_date = CURRENT_DATE AND s.start_time >= CURRENT_TIME))
        ORDER BY s.slot_date, s.start_time LIMIT 5`,
      [actor.id]
    );
  }

  // ---------------------------------------------------------------- Admin

  async function generateSlots(amenityId, fromDate, toDate) {
    const amenity = await getAmenity(amenityId);
    const start = new Date(fromDate);
    const end = new Date(toDate);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      throw ApiError.badRequest('Both from and to dates are required (YYYY-MM-DD)');
    }
    if (end < start) throw ApiError.badRequest('The "to" date must be after the "from" date');
    const days = Math.round((end - start) / 86400000);
    if (days > 62) throw ApiError.badRequest('You can generate at most 62 days of slots at a time');

    const slots = policy.generateSlots(amenity, 'YYYY-MM-DD');
    let created = 0;
    for (let i = 0; i <= days; i += 1) {
      const d = new Date(start.getTime() + i * 86400000);
      const dateISO = d.toISOString().slice(0, 10);
      for (const s of slots) {
        const res = await db.query(
          `INSERT INTO amenity_slots (amenity_id, slot_date, start_time, end_time)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (amenity_id, slot_date, start_time) DO NOTHING`,
          [amenityId, dateISO, s.startTime, s.endTime]
        );
        created += res.rowCount;
      }
    }
    return { created, amenity: amenity.name, from: start.toISOString().slice(0, 10), to: end.toISOString().slice(0, 10) };
  }

  async function blockSlot(slotId, { blocked = true, reason = null } = {}) {
    const slot = await db.one('SELECT * FROM amenity_slots WHERE id = $1', [slotId]);
    if (!slot) throw ApiError.notFound('Slot not found');
    if (blocked) {
      const active = await db.one(
        `SELECT id FROM bookings WHERE slot_id = $1 AND status = 'confirmed'`,
        [slotId]
      );
      if (active) throw ApiError.conflict('Cancel the existing booking before blocking this slot');
    }
    await db.query('UPDATE amenity_slots SET is_blocked = $1, blocked_reason = $2 WHERE id = $3', [
      blocked,
      blocked ? reason || 'Blocked by admin' : null,
      slotId,
    ]);
    return db.one(`${SLOT_SELECT} WHERE s.id = $1`, [slotId]);
  }

  async function listAllBookings({ status, amenityId, page = 1, limit = 20 } = {}) {
    const where = [];
    const params = [];
    if (status) { params.push(status); where.push(`b.status = $${params.length}`); }
    if (amenityId) { params.push(amenityId); where.push(`b.amenity_id = $${params.length}`); }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const total = Number(await db.scalar(`SELECT COUNT(*) FROM bookings b ${whereSql}`, params) || 0);
    const lim = Math.min(Number(limit) || 20, 100);
    params.push(lim, (Math.max(1, Number(page) || 1) - 1) * lim);
    const items = await db.many(
      `${BOOKING_SELECT} ${whereSql} ORDER BY s.slot_date DESC, s.start_time DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    return { items, total, page: Number(page) || 1, limit: lim };
  }

  async function stats() {
    const byAmenity = await db.many(
      `SELECT a.name, COUNT(b.id)::int AS bookings
         FROM amenities a LEFT JOIN bookings b ON b.amenity_id = a.id AND b.status = 'confirmed'
        GROUP BY a.name ORDER BY bookings DESC`
    );
    const today = Number(
      (await db.scalar(
        `SELECT COUNT(*) FROM bookings b JOIN amenity_slots s ON s.id = b.slot_id
          WHERE b.status = 'confirmed' AND s.slot_date = CURRENT_DATE`
      )) || 0
    );
    const upcoming = Number(
      (await db.scalar(
        `SELECT COUNT(*) FROM bookings b JOIN amenity_slots s ON s.id = b.slot_id
          WHERE b.status = 'confirmed' AND s.slot_date >= CURRENT_DATE`
      )) || 0
    );
    return { byAmenity, today, upcoming };
  }

  return {
    listAmenities, getAmenity, listSlots, book, getBooking, cancel, history, upcoming,
    generateSlots, blockSlot, listAllBookings, stats,
  };
}

module.exports = { createBookingsService, BOOKING_SELECT, SLOT_SELECT };
