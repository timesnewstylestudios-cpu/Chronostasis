import { angleDelta, bearingDeg, haversineM, normalizeBearing } from './haversine.js';

export const DEFAULT_GEOFENCE = {
  radiusM: 120,
  homeRadiusM: 80,
  coneDeg: 50,
  minMoveM: 25,
};

/**
 * Verifiable motion from prev → curr relative to dest.
 * "Toward" requires both a real distance drop and a heading inside the cone.
 * A GPS jitter smaller than minMoveM is neither toward nor away.
 */
export function movementVerdict(prev, curr, dest, opts = {}) {
  const radiusM = opts.radiusM ?? DEFAULT_GEOFENCE.radiusM;
  const coneDeg = opts.coneDeg ?? DEFAULT_GEOFENCE.coneDeg;
  const minMoveM = opts.minMoveM ?? DEFAULT_GEOFENCE.minMoveM;
  const distM = haversineM(curr, dest);
  const inside = distM <= radiusM;
  if (!prev) {
    return {
      distM,
      inside,
      toward: false,
      away: false,
      onTheWay: false,
      movedM: 0,
      headingDelta: null,
    };
  }
  const prevDist = haversineM(prev, dest);
  const movedM = haversineM(prev, curr);
  const drop = prevDist - distM;
  let headingDelta = null;
  if (movedM >= minMoveM) {
    const moveBearing = normalizeBearing(bearingDeg(prev, curr));
    const destBearing = normalizeBearing(bearingDeg(curr, dest));
    headingDelta = angleDelta(moveBearing, destBearing);
  }
  const toward = drop >= minMoveM && headingDelta != null && headingDelta <= coneDeg;
  const away = -drop >= minMoveM && headingDelta != null && headingDelta >= 180 - coneDeg;
  return {
    distM,
    prevDist,
    inside,
    toward,
    away,
    onTheWay: toward && !inside,
    movedM,
    headingDelta,
  };
}

export function insideRadius(pos, center, radiusM) {
  if (!pos || !center || !Number.isFinite(radiusM)) return false;
  return haversineM(pos, center) <= radiusM;
}

/**
 * Still at the origin when leave-by has passed.
 * Prefer an explicit home. Without one, the morning anchor counts:
 * you have not closed the gap to the destination by minMoveM.
 */
export function stillAtOrigin({ pos, anchor, dest, home, homeRadiusM, minMoveM }) {
  if (!pos) return false;
  if (home) return insideRadius(pos, home, homeRadiusM);
  if (!anchor || !dest) return false;
  const closed = haversineM(anchor, dest) - haversineM(pos, dest);
  return closed < minMoveM;
}
