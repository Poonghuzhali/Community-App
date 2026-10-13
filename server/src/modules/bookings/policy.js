const { ApiError } = require('../../utils/errors');

/** Build a day's slot grid from an amenity's open/close window. */
function generateSlots({ openTime = '06:00', closeTime = '22:00', slotMinutes = 60 }, dateISO) {
  const toMinutes = (t) => {
    const [h, m] = String(t).split(':').map(Number);
    return h * 60 + m;
  };
  const toHHMM = (mins) =>
    `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;

  const start = toMinutes(openTime);
  const end = toMinutes(closeTime);
  const step = Math.max(15, Number(slotMinutes) || 60);
  const slots = [];
  for (let t = start; t + step <= end; t += step) {
    slots.push({ date: dateISO, startTime: toHHMM(t), endTime: toHHMM(t + step) });
  }
  return slots;
}

function assertBookable(slot, { now = new Date(), userId } = {}) {
  if (!slot) throw ApiError.notFound('Slot not found');
  if (slot.is_blocked) throw ApiError.badRequest(`This slot is blocked${slot.blocked_reason ? `: ${slot.blocked_reason}` : ''}`);

  const start = new Date(`${slot.slot_date}T${slot.start_time}`);
  if (Number.isNaN(start.getTime())) throw ApiError.badRequest('Invalid slot timing');
  if (start <= now) throw ApiError.badRequest('This slot has already started');
  if (slot.booked_user_id && slot.booked_user_id === userId) {
    throw ApiError.conflict('You already booked this slot');
  }
  if (slot.booked_user_id) throw ApiError.conflict('Sorry, this slot was just booked by someone else');
  return true;
}

function assertCancellable(booking, { now = new Date(), noticeMinutes = 30 } = {}) {
  if (booking.status !== 'confirmed') throw ApiError.badRequest('Only confirmed bookings can be cancelled');
  const start = new Date(`${booking.slot_date}T${booking.start_time}`);
  if (Number.isNaN(start.getTime())) throw ApiError.badRequest('Invalid booking timing');
  if (start.getTime() - now.getTime() < noticeMinutes * 60 * 1000) {
    throw ApiError.badRequest(`Cancellations are allowed up to ${noticeMinutes} minutes before the slot`);
  }
  return true;
}

module.exports = { generateSlots, assertBookable, assertCancellable };
