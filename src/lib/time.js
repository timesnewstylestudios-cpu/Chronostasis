/** Local calendar helpers. All functions take an explicit Date so tests stay deterministic. */

export function isoWeekday(date) {
  const js = date.getDay();
  return js === 0 ? 7 : js;
}

export function formatISODate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function atTime(day, hhmm) {
  const match = /^(\d{2}):(\d{2})$/.exec(hhmm || '');
  if (!match) throw new Error('uhrzeit');
  const h = Number(match[1]);
  const min = Number(match[2]);
  if (h > 23 || min > 59) throw new Error('uhrzeit');
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, min, 0, 0);
}

export function addDays(date, days) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days, date.getHours(), date.getMinutes(), date.getSeconds(), date.getMilliseconds());
}

export function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
}

export function nextLocalMidnight(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1, 0, 0, 0, 0);
}

export function sameDay(a, b) {
  return formatISODate(a) === formatISODate(b);
}

/** ISO week: Monday 00:00 inclusive, next Monday exclusive. */
export function weekRange(now) {
  const iso = isoWeekday(now);
  const from = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (iso - 1), 0, 0, 0, 0);
  const to = new Date(from.getFullYear(), from.getMonth(), from.getDate() + 7, 0, 0, 0, 0);
  return { from, to };
}

export function formatClock(date) {
  const h = String(date.getHours()).padStart(2, '0');
  const m = String(date.getMinutes()).padStart(2, '0');
  const s = String(date.getSeconds()).padStart(2, '0');
  return `${h}:${m}:${s}`;
}

export function formatHM(date) {
  const h = String(date.getHours()).padStart(2, '0');
  const m = String(date.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

export function formatDuration(ms) {
  const sign = ms < 0 ? '−' : '';
  const abs = Math.abs(ms);
  const totalMin = Math.floor(abs / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  const s = Math.floor((abs % 60000) / 1000);
  if (h > 0) return `${sign}${h} h ${String(m).padStart(2, '0')} min`;
  return `${sign}${m} min ${String(s).padStart(2, '0')} s`;
}

export function formatDateLong(date) {
  return date.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });
}
