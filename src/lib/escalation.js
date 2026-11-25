/** The last phase uses untilMin null so it survives IndexedDB (Infinity does not). */
export const DEFAULT_PHASES = [
  { untilMin: 20, everyMin: 10, intensity: 1 },
  { untilMin: 40, everyMin: 5, intensity: 2 },
  { untilMin: null, everyMin: 2, intensity: 3 },
];

function phaseEnd(phase) {
  return phase.untilMin == null ? Number.POSITIVE_INFINITY : phase.untilMin;
}

export function phaseFor(elapsedMin, leaveByPassed, phases = DEFAULT_PHASES) {
  if (!phases.length) throw new Error('phasen');
  if (leaveByPassed) return phases[phases.length - 1];
  for (const phase of phases) {
    if (elapsedMin < phaseEnd(phase)) return phase;
  }
  return phases[phases.length - 1];
}

/**
 * Alarm instants from wake through untilMs.
 * The first entry is the wake alarm. Later entries step by the phase interval.
 * Once leave-by is passed, the last (fastest) phase takes over.
 */
export function buildNagSchedule(wakeMs, leaveByMs, untilMs, phases = DEFAULT_PHASES, cap = 24) {
  if (!(wakeMs <= untilMs)) return [];
  const out = [];
  let t = wakeMs;
  let guard = 0;
  while (t <= untilMs && out.length < cap) {
    const elapsedMin = (t - wakeMs) / 60000;
    const phase = phaseFor(elapsedMin, t >= leaveByMs, phases);
    out.push({
      at: t,
      everyMin: phase.everyMin,
      intensity: phase.intensity,
    });
    const next = t + phase.everyMin * 60000;
    if (!(next > t)) break;
    t = next;
    guard += 1;
    if (guard > 10000) break;
  }
  return out;
}

export function snoozeDecision(count, limit, snoozeMin) {
  const used = count;
  if (used >= limit) {
    return {
      allowed: false,
      delayMin: 0,
      remainingAfter: 0,
      explanation: `Schlummern ist aufgebraucht (${limit} von ${limit}). Die Abfahrtszeit bleibt. Beantworte die Frage oder geh los.`,
    };
  }
  const remainingAfter = limit - used - 1;
  return {
    allowed: true,
    delayMin: snoozeMin,
    remainingAfter,
    explanation: `Schlummern verschiebt nur den Ton um ${snoozeMin} Minuten, nicht die Abfahrtszeit. Danach noch ${remainingAfter} von ${limit}. Jeder Schlummer steht in der Wochenstatistik.`,
  };
}

export function validatePhases(phases) {
  if (!Array.isArray(phases) || phases.length === 0) return 'Mindestens eine Stufe.';
  let prevUntil = 0;
  for (let i = 0; i < phases.length; i += 1) {
    const phase = phases[i];
    if (!(phase.everyMin >= 1 && phase.everyMin <= 30)) return 'Intervall zwischen 1 und 30 Minuten.';
    if (!(phase.intensity >= 1 && phase.intensity <= 3)) return 'Intensität 1 bis 3.';
    if (phase.untilMin == null && i !== phases.length - 1) return 'Nur die letzte Stufe darf offen sein.';
    const until = phaseEnd(phase);
    if (!(until > prevUntil)) return 'Stufen müssen aufsteigend enden.';
    prevUntil = until;
  }
  return null;
}
