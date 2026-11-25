const WEEKDAYS = new Set([1, 2, 3, 4, 5, 6, 7]);
const TYPES = new Set(['arbeit', 'uni', 'eigen']);
const MODES = new Set(['walk', 'bike', 'transit', 'car']);

export function normalizeCommitment(input, id) {
  const name = String(input.name || '').trim();
  if (!name || name.length > 80) throw new Error('Name fehlt oder ist zu lang.');
  const type = TYPES.has(input.type) ? input.type : null;
  if (!type) throw new Error('Art fehlt.');
  const weekdays = [...new Set((input.weekdays || []).map(Number))]
    .filter((day) => WEEKDAYS.has(day))
    .sort((a, b) => a - b);
  if (!weekdays.length) throw new Error('Mindestens ein Wochentag.');
  if (!/^\d{2}:\d{2}$/.test(input.startTime || '')) throw new Error('Startzeit fehlt.');
  const [h, m] = input.startTime.split(':').map(Number);
  if (h > 23 || m > 59) throw new Error('Startzeit ungültig.');
  const bufferMin = Number(input.bufferMin);
  const prepDefaultMin = Number(input.prepDefaultMin);
  if (!(bufferMin >= 0 && bufferMin <= 180)) throw new Error('Puffer zwischen 0 und 180 Minuten.');
  if (!(prepDefaultMin >= 0 && prepDefaultMin <= 180)) throw new Error('Fertigmachen zwischen 0 und 180 Minuten.');
  if (!MODES.has(input.mode)) throw new Error('Wegart fehlt.');
  const lat = Number(input.dest?.lat);
  const lon = Number(input.dest?.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) throw new Error('Ziel fehlt. Karte, Adresse oder Koordinaten.');
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) throw new Error('Koordinaten außerhalb des Wertebereichs.');
  const label = String(input.dest?.label || '').trim().slice(0, 160);
  return {
    id,
    name,
    type,
    weekdays,
    startTime: input.startTime,
    bufferMin,
    prepDefaultMin,
    mode: input.mode,
    dest: { lat, lon, label },
  };
}

export const TYPE_LABELS = {
  arbeit: 'Arbeit',
  uni: 'Uni',
  eigen: 'Eigen',
};

export const MODE_LABELS = {
  walk: 'Zu Fuß',
  bike: 'Rad',
  transit: 'ÖPNV',
  car: 'Auto',
};

export const WEEKDAY_LABELS = [
  { id: 1, short: 'Mo', long: 'Montag' },
  { id: 2, short: 'Di', long: 'Dienstag' },
  { id: 3, short: 'Mi', long: 'Mittwoch' },
  { id: 4, short: 'Do', long: 'Donnerstag' },
  { id: 5, short: 'Fr', long: 'Freitag' },
  { id: 6, short: 'Sa', long: 'Samstag' },
  { id: 7, short: 'So', long: 'Sonntag' },
];

export const STATUS_LABELS = {
  puenktlich: 'Pünktlich',
  knapp: 'Knapp',
  zu_spaet: 'Zu spät',
  unterwegs: 'Unterwegs',
  angekommen: 'Angekommen',
  pause: 'Pausiert',
  kein_ziel: 'Ohne Wegzeit',
  warten: 'Noch ruhig',
  schlummern: 'Schlummern',
};
