export function formatDate(value, { withYear = true } = {}) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    ...(withYear ? { year: 'numeric' } : {}),
  });
}

export function formatTime(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

export function formatDateTime(value) {
  if (!value) return '—';
  return `${formatDate(value, { withYear: false })}, ${formatTime(value)}`;
}

/** Postgres TIME values arrive as "HH:MM:SS" - keep it human. */
export function shortTime(time) {
  if (!time) return '';
  return String(time).slice(0, 5);
}

export function slotLabel(slot) {
  if (!slot) return '';
  return `${shortTime(slot.start_time)} – ${shortTime(slot.end_time)}`;
}

export function relativeTime(value) {
  if (!value) return '';
  const then = new Date(value).getTime();
  if (Number.isNaN(then)) return '';
  const diff = Date.now() - then;
  const mins = Math.round(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return formatDate(value, { withYear: false });
}

export function money(amount, unit) {
  const value = Number(amount || 0);
  const formatted = value.toLocaleString('en-IN', { maximumFractionDigits: 2 });
  return unit && unit !== 'one-time' ? `₹${formatted} / ${unit}` : `₹${formatted}`;
}

export function initials(name) {
  if (!name) return '?';
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join('');
}

export function maskPhone(phone) {
  if (!phone) return '—';
  const p = String(phone);
  return p.length >= 10 ? `+91 ${p.slice(0, 5)} ${p.slice(5)}` : p;
}

export function todayISO(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 10);
}

export function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}
