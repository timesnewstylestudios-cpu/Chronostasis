import { nextLocalMidnight } from './time.js';
import { DEFAULT_FACTORS, DEFAULT_SPEEDS_KMH } from './planner.js';
import { DEFAULT_PHASES, validatePhases } from './escalation.js';

export const DEFAULT_SETTINGS = {
  speeds: { ...DEFAULT_SPEEDS_KMH },
  factors: { ...DEFAULT_FACTORS },
  alpha: 0.3,
  percentile: 0.85,
  tightMin: 5,
  snoozeLimit: 3,
  snoozeMin: 5,
  geofenceM: 120,
  homeRadiusM: 80,
  headingConeDeg: 50,
  minMoveM: 25,
  phases: DEFAULT_PHASES.map((phase) => ({ ...phase })),
  home: null,
  theme: 'system',
};

const NEXT_DAY_KEYS = [
  'speeds',
  'factors',
  'alpha',
  'percentile',
  'tightMin',
  'snoozeLimit',
  'snoozeMin',
  'geofenceM',
  'homeRadiusM',
  'headingConeDeg',
  'minMoveM',
  'phases',
  'home',
];

export function splitSettingsPatch(patch) {
  const immediate = {};
  const delayed = {};
  for (const [key, value] of Object.entries(patch)) {
    if (NEXT_DAY_KEYS.includes(key)) delayed[key] = value;
    else immediate[key] = value;
  }
  return { immediate, delayed };
}

export function queuePatch(pending, delayed, now) {
  const effectiveOn = nextLocalMidnight(now).getTime();
  const base = pending && pending.effectiveOn === effectiveOn ? pending : { effectiveOn };
  return { ...base, ...delayed, effectiveOn };
}

/**
 * Theme applies at once. The first home location applies at once, because
 * "still at home" cannot work without it. Every other planning knob waits
 * until the next local midnight so a rough morning cannot disarm today.
 */
export function commitSettingsChange(settings, pending, patch, now) {
  const { immediate, delayed } = splitSettingsPatch(patch);
  if (Object.prototype.hasOwnProperty.call(delayed, 'home') && !settings.home) {
    immediate.home = delayed.home;
    delete delayed.home;
  }
  const nextSettings = { ...settings, ...immediate };
  const nextPending = Object.keys(delayed).length ? queuePatch(pending, delayed, now) : pending;
  const message = Object.keys(delayed).length
    ? 'Gespeichert. Diese Änderungen gelten ab morgen, 0:00 Uhr.'
    : 'Gespeichert.';
  return { settings: nextSettings, pending: nextPending || null, message };
}

export function resolveSettings(settings, pending, now) {
  if (!pending?.effectiveOn || pending.effectiveOn > now.getTime()) {
    return { settings, pending: pending || null, changed: false };
  }
  const next = { ...settings };
  for (const key of NEXT_DAY_KEYS) {
    if (Object.prototype.hasOwnProperty.call(pending, key)) next[key] = pending[key];
  }
  return { settings: next, pending: null, changed: true };
}

export function hydrateSettings(stored) {
  const base = {
    ...DEFAULT_SETTINGS,
    speeds: { ...DEFAULT_SPEEDS_KMH },
    factors: { ...DEFAULT_FACTORS },
    phases: DEFAULT_PHASES.map((phase) => ({ ...phase })),
    home: null,
    theme: 'system',
  };
  if (!stored) return base;
  return {
    ...base,
    ...stored,
    speeds: { ...base.speeds, ...stored.speeds },
    factors: { ...base.factors, ...stored.factors },
    phases: Array.isArray(stored.phases) && stored.phases.length
      ? stored.phases.map((phase) => ({ ...phase }))
      : base.phases,
    home: stored.home ?? null,
  };
}

export function validateSettingsPatch(patch) {
  if (patch.speeds) {
    for (const mode of ['walk', 'bike', 'transit', 'car']) {
      const speed = patch.speeds[mode];
      if (!(speed >= 1 && speed <= 150)) return 'Geschwindigkeiten zwischen 1 und 150 km/h.';
    }
  }
  if (patch.factors) {
    for (const mode of ['walk', 'bike', 'transit', 'car']) {
      const factor = patch.factors[mode];
      if (!(factor >= 0.3 && factor <= 3)) return 'Faktoren zwischen 0,3 und 3.';
    }
  }
  if (patch.snoozeLimit != null && !(patch.snoozeLimit >= 0 && patch.snoozeLimit <= 5)) {
    return 'Schlummern zwischen 0 und 5.';
  }
  if (patch.geofenceM != null && !(patch.geofenceM >= 30 && patch.geofenceM <= 500)) {
    return 'Zielradius zwischen 30 und 500 m.';
  }
  if (patch.phases) {
    const phaseError = validatePhases(patch.phases);
    if (phaseError) return phaseError;
  }
  if (patch.home) {
    if (!Number.isFinite(patch.home.lat) || !Number.isFinite(patch.home.lon)) return 'Wohnort unvollständig.';
    if (patch.home.lat < -90 || patch.home.lat > 90 || patch.home.lon < -180 || patch.home.lon > 180) {
      return 'Wohnort außerhalb des Wertebereichs.';
    }
  }
  return null;
}
