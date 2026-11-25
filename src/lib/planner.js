import { ewma } from './ewma.js';
import { percentile } from './percentile.js';

export const DEFAULT_SPEEDS_KMH = {
  walk: 4.8,
  bike: 15,
  transit: 22,
  car: 32,
};

export const DEFAULT_FACTORS = {
  walk: 1,
  bike: 1,
  transit: 1,
  car: 1,
};

export const MODES = ['walk', 'bike', 'transit', 'car'];

/** Samples needed before the learned estimate fully replaces the speed estimate. */
export const LEARN_RAMP = 4;

export function travelMinutesFromSpeed(distanceKm, mode, speeds = DEFAULT_SPEEDS_KMH, factors = DEFAULT_FACTORS) {
  if (!MODES.includes(mode)) throw new Error('modus');
  if (!(distanceKm >= 0) || !Number.isFinite(distanceKm)) throw new Error('distanz');
  const speed = speeds[mode];
  const factor = factors[mode] ?? 1;
  if (!(speed > 0) || !(factor > 0)) throw new Error('geschwindigkeit');
  return (distanceKm / (speed * factor)) * 60;
}

/** max(EWMA, p85). The percentile is the buffer: a skewed history leaves earlier than the mean. */
export function learnedMinutes(history, alpha = 0.3, p = 0.85) {
  if (!history?.length) return null;
  const mean = ewma(history, alpha);
  const high = percentile(history, p);
  return Math.max(mean, high);
}

export function blendEstimate(base, learned, sampleCount, ramp = LEARN_RAMP) {
  if (learned == null || !Number.isFinite(learned)) {
    return { value: base, source: 'basis' };
  }
  const weight = Math.min(1, sampleCount / ramp);
  const value = (1 - weight) * base + weight * learned;
  let source = 'mischung';
  if (weight >= 1) source = 'gelernt';
  else if (weight <= 0) source = 'basis';
  return { value, source };
}

/**
 * Status against the planned leave-by time.
 * "Zu spät" once now is past leave-by, or the ETA if leaving now misses the buffered arrival.
 * "Knapp" inside the tight window. Otherwise "pünktlich".
 */
export function punctualityStatus({ now, leaveBy, estimatedArrival, start, bufferMin, tightMin }) {
  const arrivalDeadline = start.getTime() - bufferMin * 60000;
  if (now.getTime() > leaveBy.getTime()) return 'zu_spaet';
  if (estimatedArrival.getTime() > arrivalDeadline) return 'zu_spaet';
  const msToLeave = leaveBy.getTime() - now.getTime();
  const slack = arrivalDeadline - estimatedArrival.getTime();
  if (msToLeave <= tightMin * 60000 || slack <= tightMin * 60000) return 'knapp';
  return 'puenktlich';
}

/**
 * leaveBy = start − arrival buffer − travel
 * wakeAt  = leaveBy − prep
 * Travel and prep each use max(EWMA, percentile), blended with the speed/default
 * until LEARN_RAMP samples exist.
 */
export function planDeparture({
  now,
  start,
  bufferMin,
  distanceKm = null,
  mode = 'transit',
  speeds = DEFAULT_SPEEDS_KMH,
  factors = DEFAULT_FACTORS,
  travelHistory = [],
  prepHistory = [],
  defaultPrepMin = 30,
  alpha = 0.3,
  percentileP = 0.85,
  tightMin = 5,
}) {
  if (!(bufferMin >= 0) || !Number.isFinite(bufferMin)) throw new Error('puffer');
  if (!(defaultPrepMin >= 0) || !Number.isFinite(defaultPrepMin)) throw new Error('vorbereitung');
  if (!(now instanceof Date) || !(start instanceof Date)) throw new Error('zeit');

  const speedTravel = distanceKm == null
    ? null
    : travelMinutesFromSpeed(distanceKm, mode, speeds, factors);
  const travelLearned = learnedMinutes(travelHistory, alpha, percentileP);

  let travel;
  if (speedTravel == null) {
    travel = travelLearned == null
      ? { value: null, source: 'unbekannt' }
      : { value: travelLearned, source: 'gelernt' };
  } else {
    travel = blendEstimate(speedTravel, travelLearned, travelHistory.length);
  }

  const prepLearned = learnedMinutes(prepHistory, alpha, percentileP);
  const prep = blendEstimate(defaultPrepMin, prepLearned, prepHistory.length);

  if (travel.value == null) {
    return {
      distanceKm,
      travelMin: null,
      travelSource: travel.source,
      prepMin: prep.value,
      prepSource: prep.source,
      bufferMin,
      leaveBy: null,
      wakeAt: null,
      estimatedArrival: null,
      status: 'kein_ziel',
    };
  }

  const leaveBy = new Date(start.getTime() - (bufferMin + travel.value) * 60000);
  const wakeAt = new Date(leaveBy.getTime() - prep.value * 60000);
  const estimatedArrival = new Date(now.getTime() + travel.value * 60000);
  const status = punctualityStatus({
    now,
    leaveBy,
    estimatedArrival,
    start,
    bufferMin,
    tightMin,
  });

  return {
    distanceKm,
    travelMin: travel.value,
    travelSource: travel.source,
    prepMin: prep.value,
    prepSource: prep.source,
    bufferMin,
    leaveBy,
    wakeAt,
    estimatedArrival,
    status,
  };
}
