import { atTime, formatISODate, isoWeekday } from './time.js';

export const GRACE_MS = 3 * 60 * 60 * 1000;

export function occurrenceKey(commitmentId, start) {
  return `${commitmentId}:${formatISODate(start)}`;
}

/** Next start strictly after now, looking at most eight days ahead. */
export function nextStart(commitment, now) {
  for (let i = 0; i < 8; i += 1) {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
    if (!commitment.weekdays.includes(isoWeekday(day))) continue;
    const start = atTime(day, commitment.startTime);
    if (start.getTime() > now.getTime()) return start;
  }
  return null;
}

/**
 * Today's start while it is still inside the grace window after the bell,
 * otherwise the next future start. A finished morning stays visible long
 * enough to record arrival or a miss.
 */
export function candidateStart(commitment, now, graceMs = GRACE_MS) {
  if (commitment.weekdays.includes(isoWeekday(now))) {
    const start = atTime(now, commitment.startTime);
    if (now.getTime() <= start.getTime() + graceMs) return start;
  }
  return nextStart(commitment, now);
}

export function selectFocus(commitments, now, occurrences, graceMs = GRACE_MS) {
  const unresolved = [];
  for (const commitment of commitments) {
    if (!commitment.weekdays?.length || !commitment.startTime) continue;
    const start = candidateStart(commitment, now, graceMs);
    if (!start) continue;
    const key = occurrenceKey(commitment.id, start);
    const occ = occurrences[key] || null;
    if (occ?.arrivedAt || occ?.pausedReason) continue;
    unresolved.push({ commitment, start, key, occ });
  }
  const current = unresolved
    .filter((item) => item.start.getTime() - now.getTime() <= 12 * 3600 * 1000
      && now.getTime() <= item.start.getTime() + graceMs)
    .sort((a, b) => a.start.getTime() - b.start.getTime());
  if (current.length) return current[0];
  const upcoming = unresolved
    .filter((item) => item.start.getTime() > now.getTime())
    .sort((a, b) => a.start.getTime() - b.start.getTime());
  return upcoming[0] || null;
}

export function closeStale(occurrences, nowMs, graceMs = GRACE_MS) {
  const updates = [];
  for (const occ of Object.values(occurrences)) {
    if (!occ?.startMs) continue;
    if (occ.arrivedAt || occ.pausedReason || occ.outcome) continue;
    if (occ.startMs + graceMs < nowMs) {
      updates.push({
        ...occ,
        outcome: 'missed',
        reason: 'verpasst',
        lateMin: 0,
      });
    }
  }
  return updates;
}
