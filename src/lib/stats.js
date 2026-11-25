import { formatISODate, weekRange } from './time.js';

/**
 * Pünktlichkeitsquote = pünktliche Ankünfte / (pünktlich + verspätet + verpasst).
 * Pauses with a legitimate reason stay out of the quote and show up under Gründe.
 * Durchschnittsverspätung is the mean lateness of late arrivals only.
 */
export function summarize(records) {
  const judged = records.filter((r) => r.outcome === 'on_time' || r.outcome === 'late' || r.outcome === 'missed');
  const onTime = judged.filter((r) => r.outcome === 'on_time').length;
  const late = records.filter((r) => r.outcome === 'late');
  const quote = judged.length ? onTime / judged.length : null;
  const avgLateMin = late.length
    ? late.reduce((sum, r) => sum + (r.lateMin || 0), 0) / late.length
    : 0;
  const reasons = {};
  for (const record of records) {
    if (!record.reason) continue;
    reasons[record.reason] = (reasons[record.reason] || 0) + 1;
  }
  const ranked = Object.entries(reasons).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  return {
    count: records.length,
    judged: judged.length,
    onTime,
    late: late.length,
    missed: records.filter((r) => r.outcome === 'missed').length,
    paused: records.filter((r) => r.outcome === 'paused').length,
    quote,
    avgLateMin,
    reasons,
    topReason: ranked[0]?.[0] || null,
  };
}

export function recordsInWeek(records, now) {
  const { from, to } = weekRange(now);
  const fromStr = formatISODate(from);
  const toStr = formatISODate(to);
  return records.filter((r) => r.date >= fromStr && r.date < toStr);
}

export function recordsFromOccurrences(occurrences) {
  return Object.values(occurrences)
    .filter((occ) => occ?.outcome)
    .map((occ) => ({
      date: occ.date,
      outcome: occ.outcome,
      lateMin: occ.lateMin || 0,
      reason: occ.reason || null,
      commitmentId: occ.commitmentId,
    }));
}

export function arrivalOutcome(arrivedAtMs, startMs) {
  const lateMin = Math.max(0, (arrivedAtMs - startMs) / 60000);
  return {
    outcome: lateMin > 0 ? 'late' : 'on_time',
    lateMin,
    reason: lateMin > 0 ? 'verspaetet' : null,
  };
}

export function reflectionEffect({ outcome, lateMin = 0, prepMin = null }) {
  if (outcome !== 'on_time' && outcome !== 'late') throw new Error('reflexion');
  const record = {
    outcome,
    lateMin: outcome === 'late' ? Math.max(0, lateMin) : 0,
    reason: outcome === 'late' ? 'verspaetet' : null,
  };
  const prepSample = prepMin == null || prepMin === '' ? null : Number(prepMin);
  if (prepSample != null && (!Number.isFinite(prepSample) || prepSample < 0 || prepSample > 180)) {
    throw new Error('vorbereitung');
  }
  return { record, prepSample };
}
