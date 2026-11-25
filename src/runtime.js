import { normalizeCommitment } from './lib/commitment.js';
import { buildNagSchedule, phaseFor, snoozeDecision } from './lib/escalation.js';
import { movementVerdict, stillAtOrigin } from './lib/geofence.js';
import { haversineKm } from './lib/haversine.js';
import { isCommitmentLocked, nagDecision } from './lib/nag.js';
import { planDeparture, punctualityStatus } from './lib/planner.js';
import { classify, deviationKind, present, step } from './lib/questions.js';
import { closeStale, selectFocus } from './lib/schedule.js';
import {
  commitSettingsChange,
  hydrateSettings,
  resolveSettings,
  validateSettingsPatch,
} from './lib/settings.js';
import { arrivalOutcome, reflectionEffect } from './lib/stats.js';
import { formatISODate } from './lib/time.js';
import { startForeground, syncBackground } from './platform/location.js';
import { alarmId } from './platform/ids.js';
import {
  ensureNotificationPermission,
  isNative,
  notificationPermissionGranted,
  pingWeb,
  platform,
  syncAlarms,
} from './platform/notify.js';
import { playAlarm } from './platform/sound.js';
import { holdAwake } from './platform/wake.js';
import {
  addSample,
  deleteCommitment,
  deleteEverything,
  exportPayload,
  loadAll,
  putKv,
  saveCommitment,
  saveOccurrence,
} from './storage/db.js';
import { state } from './state.js';

let paint = () => {};
let alarmTicket = 0;

export function setPainter(fn) {
  paint = fn;
}

function render(full) {
  paint(full);
}

export async function start() {
  try {
    const data = await loadAll();
    state.consent = data.kv.consent ?? null;
    state.settings = hydrateSettings(data.kv.settings);
    state.pending = data.kv.pending ?? null;
    state.commitments = data.commitments;
    state.occurrences = data.occurrences;
    state.samples = data.samples;
    applyTheme(state.settings.theme);
    const due = resolveSettings(state.settings, state.pending, new Date());
    if (due.changed) {
      state.settings = due.settings;
      state.pending = null;
      await putKv('settings', state.settings);
      await putKv('pending', null);
    }
  } catch (error) {
    state.loadError = 'Die lokalen Daten lassen sich nicht öffnen.';
    state.settings = hydrateSettings(null);
    console.error(error);
  }
  state.platform = platform();
  state.ready = true;
  if (state.consent && location.hash) {
    const view = location.hash.replace('#', '');
    if (['uhr', 'plan', 'statistik', 'mehr'].includes(view)) state.view = view;
  }
  if (state.consent) {
    startForeground(ingestPoint);
    evaluate();
  }
  render(true);
  window.setInterval(() => {
    state.now = new Date();
    if (!state.consent) {
      render(false);
      return;
    }
    evaluate();
    render(false);
  }, 1000);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && state.consent) evaluate();
  });
}

function history(commitmentId, kind) {
  return state.samples
    .filter((sample) => sample.commitmentId === commitmentId && sample.kind === kind)
    .sort((a, b) => a.at - b.at)
    .slice(-40)
    .map((sample) => sample.minutes);
}

function blankOccurrence(focus) {
  return {
    key: focus.key,
    commitmentId: focus.commitment.id,
    date: formatISODate(focus.start),
    startMs: focus.start.getTime(),
    pausedReason: null,
    arrivedAt: null,
    outcome: null,
    lateMin: 0,
    reason: null,
    snoozeCount: 0,
    snoozedUntil: null,
    anchor: null,
    leftAt: null,
    learned: false,
    prepLearned: false,
    frozen: null,
    lastAskedAt: null,
    lastAskedKind: null,
    reflectionDone: false,
  };
}

function ingestPoint(point, problem) {
  if (problem) {
    state.locStatus = problem;
    if (problem === 'denied') state.position = null;
    evaluate();
    return;
  }
  state.position = point;
  state.locStatus = 'ok';
  evaluate();
}

async function persistOccurrence(occ) {
  state.occurrences[occ.key] = occ;
  await saveOccurrence(occ);
}

function learnFrom(occ) {
  const jobs = [];
  if (!occ.learned && occ.leftAt && occ.arrivedAt) {
    const minutes = (occ.arrivedAt - occ.leftAt) / 60000;
    if (minutes > 0.5 && minutes < 300) {
      const sample = {
        id: `travel:${occ.commitmentId}:${occ.arrivedAt}`,
        kind: 'travel',
        commitmentId: occ.commitmentId,
        minutes,
        at: occ.arrivedAt,
      };
      state.samples.push(sample);
      jobs.push(addSample(sample));
    }
    occ.learned = true;
  }
  if (!occ.prepLearned && occ.frozen?.wakeMs && occ.leftAt) {
    const minutes = (occ.leftAt - occ.frozen.wakeMs) / 60000;
    if (minutes >= 0 && minutes <= 180) {
      const sample = {
        id: `prep:${occ.commitmentId}:${occ.leftAt}`,
        kind: 'prep',
        commitmentId: occ.commitmentId,
        minutes,
        at: occ.leftAt,
      };
      state.samples.push(sample);
      jobs.push(addSample(sample));
    }
    occ.prepLearned = true;
  }
  return Promise.all(jobs);
}

export function evaluate() {
  if (!state.settings || !state.consent) return;
  state.now = new Date();
  const nowMs = state.now.getTime();
  const stale = closeStale(state.occurrences, nowMs);
  for (const occ of stale) {
    state.occurrences[occ.key] = occ;
    saveOccurrence(occ);
  }
  const focus = selectFocus(state.commitments, state.now, state.occurrences);
  state.focus = focus;
  if (!focus) {
    state.plan = null;
    state.decision = null;
    state.verdict = null;
    state.effective = null;
    state.statusCode = 'leer';
    holdAwake(false);
    syncBackground(false, ingestPoint);
    pushAlarms([]);
    return;
  }
  const commitment = focus.commitment;
  const distanceKm = state.position
    ? haversineKm(state.position, commitment.dest)
    : null;
  const plan = planDeparture({
    now: state.now,
    start: focus.start,
    bufferMin: commitment.bufferMin,
    distanceKm,
    mode: commitment.mode,
    speeds: state.settings.speeds,
    factors: state.settings.factors,
    travelHistory: history(commitment.id, 'travel'),
    prepHistory: history(commitment.id, 'prep'),
    defaultPrepMin: commitment.prepDefaultMin,
    alpha: state.settings.alpha,
    percentileP: state.settings.percentile,
    tightMin: state.settings.tightMin,
  });
  state.plan = plan;
  let occ = state.occurrences[focus.key] || blankOccurrence(focus);
  let dirty = !state.occurrences[focus.key];
  if (plan.wakeAt && nowMs >= plan.wakeAt.getTime() && !occ.frozen) {
    occ = {
      ...occ,
      frozen: {
        wakeMs: plan.wakeAt.getTime(),
        leaveByMs: plan.leaveBy.getTime(),
        travelMin: plan.travelMin,
        prepMin: plan.prepMin,
      },
    };
    dirty = true;
  }
  if (state.position && !occ.anchor) {
    occ = { ...occ, anchor: { ...state.position } };
    dirty = true;
  }
  const wakeMs = occ.frozen?.wakeMs ?? plan.wakeAt?.getTime() ?? null;
  const leaveByMs = occ.frozen?.leaveByMs ?? plan.leaveBy?.getTime() ?? null;
  state.effective = {
    wakeAt: wakeMs == null ? null : new Date(wakeMs),
    leaveBy: leaveByMs == null ? null : new Date(leaveByMs),
    travelMin: occ.frozen?.travelMin ?? plan.travelMin,
    prepMin: occ.frozen?.prepMin ?? plan.prepMin,
  };
  if (leaveByMs != null && (occ.frozen?.travelMin ?? plan.travelMin) != null) {
    state.statusCode = punctualityStatus({
      now: state.now,
      leaveBy: state.effective.leaveBy,
      estimatedArrival: new Date(nowMs + state.effective.travelMin * 60000),
      start: focus.start,
      bufferMin: commitment.bufferMin,
      tightMin: state.settings.tightMin,
    });
  } else {
    state.statusCode = plan.status;
  }
  const geo = {
    radiusM: state.settings.geofenceM,
    coneDeg: state.settings.headingConeDeg,
    minMoveM: state.settings.minMoveM,
  };
  let verdict = null;
  if (state.position) {
    verdict = movementVerdict(state.trackRef, state.position, commitment.dest, geo);
    if (!state.trackRef || verdict.movedM >= geo.minMoveM) state.trackRef = state.position;
  }
  state.verdict = verdict;
  const atOrigin = stillAtOrigin({
    pos: state.position,
    anchor: occ.anchor,
    dest: commitment.dest,
    home: state.settings.home,
    homeRadiusM: state.settings.homeRadiusM,
    minMoveM: state.settings.minMoveM,
  });
  state.atOrigin = atOrigin;
  const inside = Boolean(verdict?.inside) && wakeMs != null && nowMs >= wakeMs - 15 * 60000;
  if (inside && !occ.arrivedAt && !occ.pausedReason) {
    const result = arrivalOutcome(nowMs, occ.startMs);
    occ = {
      ...occ,
      arrivedAt: nowMs,
      outcome: result.outcome,
      lateMin: result.lateMin,
      reason: result.reason,
      leftAt: occ.leftAt || nowMs,
    };
    dirty = true;
    state.note = `${commitment.name}: angekommen.`;
    state.question = null;
  } else if (verdict?.toward && wakeMs != null && nowMs >= wakeMs && !occ.leftAt) {
    occ = { ...occ, leftAt: state.position.at || nowMs };
    dirty = true;
  }
  const learnedBefore = Boolean(occ.learned);
  const prepBefore = Boolean(occ.prepLearned);
  if (occ.arrivedAt || occ.pausedReason) learnFrom(occ);
  if (occ.learned !== learnedBefore || occ.prepLearned !== prepBefore) dirty = true;
  const decision = nagDecision({
    nowMs,
    wakeMs,
    leaveByMs,
    paused: Boolean(occ.pausedReason),
    arrived: Boolean(occ.arrivedAt),
    inside: Boolean(occ.arrivedAt) || inside,
    onTheWay: Boolean(verdict?.onTheWay) && !occ.pausedReason,
    snoozedUntil: occ.snoozedUntil,
  });
  state.decision = decision;
  if (dirty) persistOccurrence(occ);
  else state.occurrences[occ.key] = occ;

  const kind = deviationKind({
    movingAway: Boolean(verdict?.away),
    snoozeCount: occ.snoozeCount || 0,
    atHome: atOrigin,
    leaveTimePassed: leaveByMs != null && nowMs >= leaveByMs,
    locationUnavailable: state.locStatus === 'denied' || state.locStatus === 'unavailable',
  });
  if (decision.active && kind && !state.question && !state.editor) {
    const cooled = occ.lastAskedAt
      && nowMs - occ.lastAskedAt < 3 * 60000
      && occ.lastAskedKind === kind;
    if (!cooled) state.question = { ...present(kind), key: focus.key };
  }

  holdAwake(Boolean(decision.active) && !document.hidden);
  const backgroundOn = decision.active || (leaveByMs != null && nowMs >= leaveByMs - 30 * 60000 && nowMs <= (focus.start.getTime() + 60 * 60000));
  syncBackground(backgroundOn, ingestPoint);
  considerSound(focus, occ, decision, wakeMs, leaveByMs);
  pushAlarms(alarmItems(focus, occ, wakeMs, leaveByMs, decision, nowMs));
  const signature = [
    state.view,
    focus.key,
    decision.cause,
    decision.active ? '1' : '0',
    state.question?.nodeId || '',
    state.note,
    occ.pausedReason || '',
    occ.outcome || '',
  ].join('|');
  if (signature !== state.uiSignature) {
    state.uiSignature = signature;
    if (!state.editor) render(true);
  }
}

function considerSound(focus, occ, decision, wakeMs, leaveByMs) {
  if (!decision.active) {
    state.nextSoundAt = null;
    return;
  }
  const elapsedMin = wakeMs == null ? 0 : (state.now.getTime() - wakeMs) / 60000;
  const phase = phaseFor(elapsedMin, Boolean(decision.leaveByPassed), state.settings.phases);
  const everyMin = decision.everyMin || phase.everyMin;
  let intensity = phase.intensity;
  if (decision.intensityCap) intensity = Math.min(intensity, decision.intensityCap);
  if (state.soundKey !== focus.key) {
    state.soundKey = focus.key;
    state.nextSoundAt = state.now.getTime();
  }
  if (state.nextSoundAt == null || state.now.getTime() >= state.nextSoundAt) {
    playAlarm(intensity);
    if (document.hidden) {
      pingWeb(
        intensity >= 3 ? `Jetzt los: ${focus.commitment.name}` : `Chronostasis: ${focus.commitment.name}`,
        'Die Erinnerung bleibt an, bis du am Ziel bist.',
      );
    }
    state.nextSoundAt = state.now.getTime() + everyMin * 60000;
  }
}

function uniqueIds(points, key) {
  const used = new Set();
  return points.map((point, index) => {
    let id = alarmId(`${key}:${point.at}:${index}`);
    while (used.has(id)) id = (id % 90000) + 1;
    used.add(id);
    return { ...point, id };
  });
}

function alarmItems(focus, occ, wakeMs, leaveByMs, decision, nowMs) {
  if (wakeMs == null || leaveByMs == null || occ.pausedReason || occ.arrivedAt) return [];
  const until = Math.min(wakeMs + 4 * 60 * 60 * 1000, focus.start.getTime() + 3 * 60 * 60 * 1000);
  let points;
  if (decision.cause === 'unterwegs') {
    points = [];
    const stepMs = 10 * 60000;
    let t = Math.ceil(nowMs / stepMs) * stepMs;
    while (t <= until && points.length < 12) {
      points.push({ at: t, everyMin: 10, intensity: 1 });
      t += stepMs;
    }
  } else {
    const floor = occ.snoozedUntil && nowMs < occ.snoozedUntil ? occ.snoozedUntil : nowMs - 5000;
    points = buildNagSchedule(wakeMs, leaveByMs, until, state.settings.phases)
      .filter((point) => point.at >= floor);
  }
  const named = points.slice(0, 24).map((point, index) => ({
    ...point,
    title: index === 0 ? `Aufstehen: ${focus.commitment.name}` : `Los: ${focus.commitment.name}`,
    body: point.intensity >= 3
      ? 'Du bist noch nicht am Ziel. Die Erinnerung bleibt an.'
      : `Beginn ${focus.commitment.startTime}. Die Erinnerung bleibt an, bis du ankommst.`,
  }));
  return uniqueIds(named, focus.key);
}

function pushAlarms(items) {
  const signature = items.map((item) => `${item.at}:${item.intensity}`).join(',');
  if (signature === state.alarmSignature) return;
  state.alarmSignature = signature;
  const ticket = alarmTicket + 1;
  alarmTicket = ticket;
  syncAlarms(items).then((result) => {
    if (ticket !== alarmTicket) return;
    state.needsExact = Boolean(result?.needsExact);
  }).catch(() => {});
}

function currentOccurrence() {
  if (!state.focus) return null;
  return state.occurrences[state.focus.key] || null;
}

export const actions = {
  async consent() {
    const box = document.getElementById('consent');
    if (!box?.checked) {
      state.formError = 'Zum Einrichten brauchst du die Zustimmung.';
      render(true);
      return;
    }
    state.consent = { at: Date.now(), version: 1 };
    state.formError = '';
    await putKv('consent', state.consent);
    state.notifGranted = await ensureNotificationPermission();
    startForeground(ingestPoint);
    render(true);
    evaluate();
  },
  onboard(step) {
    state.onboardStep = step;
    state.formError = '';
    render(true);
  },
  nav(view) {
    state.view = view;
    state.editor = null;
    state.formError = '';
    state.deleteArmed = false;
    if (state.consent) location.hash = view;
    render(true);
  },
  toast(text) {
    state.toast = text;
    render(true);
    window.setTimeout(() => {
      if (state.toast === text) {
        state.toast = '';
        render(true);
      }
    }, 4200);
  },
  edit(id) {
    const commitment = state.commitments.find((item) => item.id === id);
    if (!commitment) return;
    const focus = selectFocus([commitment], state.now, state.occurrences);
    const plan = focus ? planFor(commitment, focus.start) : null;
    const occ = focus ? state.occurrences[focus.key] : null;
    if (plan && isCommitmentLocked(state.now.getTime(), plan, occ)) {
      actions.toast('Diese Verpflichtung läuft heute. Änderungen gelten erst, wenn sie vorbei ist.');
      return;
    }
    state.editor = commitment;
    state.view = 'plan';
    state.formError = '';
    render(true);
  },
  newCommitment() {
    state.editor = {
      id: null,
      name: '',
      type: 'arbeit',
      weekdays: [1, 2, 3, 4, 5],
      startTime: '09:00',
      bufferMin: 10,
      prepDefaultMin: 30,
      mode: 'transit',
      dest: { lat: '', lon: '', label: '' },
    };
    state.view = 'plan';
    state.formError = '';
    render(true);
  },
  cancelEdit() {
    state.editor = null;
    state.formError = '';
    render(true);
  },
  async saveCommitment(input) {
    try {
      const id = state.editor?.id || crypto.randomUUID();
      const commitment = normalizeCommitment(input, id);
      let near = false;
      if (state.position) {
        const km = haversineKm(state.position, commitment.dest);
        near = km * 1000 <= state.settings.geofenceM;
      }
      await saveCommitment(commitment);
      const index = state.commitments.findIndex((item) => item.id === id);
      if (index >= 0) state.commitments[index] = commitment;
      else state.commitments.push(commitment);
      state.editor = null;
      state.formError = '';
      state.alarmSignature = '';
      state.toast = near
        ? 'Gespeichert. Das Ziel liegt im Ankunftsradius, die Erinnerung endet dort sofort.'
        : 'Verpflichtung gespeichert.';
      render(true);
      evaluate();
    } catch (error) {
      state.formError = error.message || 'Das hat nicht geklappt.';
      render(true);
    }
  },
  async removeCommitment(id) {
    const commitment = state.commitments.find((item) => item.id === id);
    const focus = commitment ? selectFocus([commitment], state.now, state.occurrences) : null;
    const plan = focus ? planFor(commitment, focus.start) : null;
    const occ = focus ? state.occurrences[focus.key] : null;
    if (plan && isCommitmentLocked(state.now.getTime(), plan, occ)) {
      actions.toast('Eine laufende Verpflichtung lässt sich heute nicht löschen. Alle Daten löschen geht unter Mehr.');
      return;
    }
    await deleteCommitment(id);
    state.commitments = state.commitments.filter((item) => item.id !== id);
    state.editor = null;
    state.alarmSignature = '';
    actions.toast('Verpflichtung gelöscht.');
    evaluate();
  },
  async snooze() {
    const occ = currentOccurrence();
    if (!occ || !state.focus) return;
    const decision = snoozeDecision(occ.snoozeCount || 0, state.settings.snoozeLimit, state.settings.snoozeMin);
    if (!decision.allowed) {
      actions.toast(decision.explanation);
      return;
    }
    const next = {
      ...occ,
      snoozeCount: (occ.snoozeCount || 0) + 1,
      snoozedUntil: state.now.getTime() + decision.delayMin * 60000,
    };
    await persistOccurrence(next);
    state.alarmSignature = '';
    state.nextSoundAt = next.snoozedUntil;
    actions.toast(decision.explanation);
    evaluate();
  },
  openQuestion() {
    if (!state.focus) return;
    const occ = currentOccurrence();
    const kind = deviationKind({
      movingAway: Boolean(state.verdict?.away),
      snoozeCount: occ?.snoozeCount || 0,
      atHome: state.atOrigin,
      leaveTimePassed: true,
      locationUnavailable: state.locStatus !== 'ok',
    }) || 'allgemein';
    state.question = { ...present(kind), key: state.focus.key };
    render(true);
  },
  async answer(optionId) {
    if (!state.question) return;
    const result = step(state.question.nodeId, optionId);
    if (result.type === 'question') {
      state.question = { ...result, key: state.question.key };
      render(true);
      return;
    }
    const key = state.question.key;
    const occ = state.occurrences[key];
    state.question = null;
    if (!occ) {
      render(true);
      return;
    }
    const effect = classify(result);
    let next = {
      ...occ,
      lastAskedAt: state.now.getTime(),
      lastAskedKind: result.reason || effect,
    };
    if (effect === 'pause') {
      next = {
        ...next,
        pausedReason: result.reason,
        reason: result.reason,
        outcome: 'paused',
        lateMin: 0,
      };
      state.note = result.message || 'Heute pausiert. Der Grund steht in der Statistik.';
    } else if (effect === 'snooze_once') {
      const decision = snoozeDecision(occ.snoozeCount || 0, state.settings.snoozeLimit, state.settings.snoozeMin);
      if (decision.allowed) {
        next = {
          ...next,
          snoozeCount: (occ.snoozeCount || 0) + 1,
          snoozedUntil: state.now.getTime() + state.settings.snoozeMin * 60000,
        };
      }
      state.note = result.message || decision.explanation;
    } else {
      state.note = result.message || 'Die Erinnerung bleibt an.';
      if (result.reason === 'standort_holen') ensureNotificationPermission();
    }
    await persistOccurrence(next);
    state.alarmSignature = '';
    render(true);
    evaluate();
  },
  dismissQuestion() {
    const key = state.question?.key;
    const kind = state.question?.nodeId || '';
    state.question = null;
    const occ = key ? state.occurrences[key] : null;
    if (occ) {
      persistOccurrence({ ...occ, lastAskedAt: state.now.getTime(), lastAskedKind: kind });
    }
    state.note = 'Später antworten ändert nichts: die Erinnerung bleibt an.';
    render(true);
  },
  async saveReflection(input) {
    const occ = state.occurrences[input.key];
    if (!occ) return;
    try {
      let next = { ...occ, reflectionDone: true };
      const prep = input.prepMin === '' || input.prepMin == null ? null : Number(input.prepMin);
      if (prep != null && (!Number.isFinite(prep) || prep < 0 || prep > 180)) {
        throw new Error('Fertigmachen zwischen 0 und 180 Minuten.');
      }
      if (!occ.outcome) {
        if (input.outcome !== 'on_time' && input.outcome !== 'late') {
          throw new Error('War die Ankunft pünktlich oder verspätet?');
        }
        const effect = reflectionEffect({ outcome: input.outcome, lateMin: input.lateMin, prepMin: null });
        next = {
          ...next,
          outcome: effect.record.outcome,
          lateMin: effect.record.lateMin,
          reason: effect.record.reason,
        };
      }
      if (prep != null && !occ.prepLearned) {
        const sample = {
          id: `prep:${occ.commitmentId}:reflection:${occ.date}`,
          kind: 'prep',
          commitmentId: occ.commitmentId,
          minutes: prep,
          at: state.now.getTime(),
        };
        state.samples.push(sample);
        await addSample(sample);
        next.prepLearned = true;
      }
      await persistOccurrence(next);
      state.formError = '';
      actions.toast('Abendnotiz gespeichert. Sie fließt in die Schätzung ein.');
    } catch (error) {
      state.formError = error.message || 'Die Abendnotiz ist unvollständig.';
      render(true);
    }
  },
  async saveSettings(patch) {
    const error = validateSettingsPatch(patch);
    if (error) {
      state.formError = error;
      render(true);
      return;
    }
    const result = commitSettingsChange(state.settings, state.pending, patch, state.now);
    state.settings = result.settings;
    state.pending = result.pending;
    applyTheme(state.settings.theme);
    await putKv('settings', state.settings);
    await putKv('pending', state.pending);
    state.formError = '';
    state.alarmSignature = '';
    actions.toast(result.message);
    evaluate();
  },
  toggleTheme() {
    const current = document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
    const theme = current === 'dark' ? 'light' : 'dark';
    actions.saveSettings({ theme });
  },
  async exportData() {
    const payload = await exportPayload();
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `chronostasis-${formatISODate(state.now)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  },
  armDelete() {
    state.deleteArmed = true;
    render(true);
  },
  async wipe(word) {
    if (word !== 'LÖSCHEN') {
      state.formError = 'Tippe LÖSCHEN, um alle lokalen Daten zu entfernen.';
      render(true);
      return;
    }
    await syncAlarms([]);
    await deleteEverything();
    localStorage.removeItem('chronostasis-theme');
    state.consent = null;
    state.commitments = [];
    state.occurrences = {};
    state.samples = [];
    state.pending = null;
    state.settings = hydrateSettings(null);
    state.onboardStep = 0;
    state.deleteArmed = false;
    state.question = null;
    state.editor = null;
    state.note = '';
    state.view = 'uhr';
    actions.toast('Alle Daten sind gelöscht.');
    render(true);
  },
  locate() {
    if (!navigator.geolocation) {
      state.locStatus = 'unavailable';
      state.toast = 'Dieses Gerät liefert keinen Standort.';
      render(true);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => ingestPoint({
        lat: pos.coords.latitude,
        lon: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
        at: pos.timestamp,
      }, null),
      (error) => ingestPoint(null, error.code === 1 ? 'denied' : 'unavailable'),
      { enableHighAccuracy: true, timeout: 15000 },
    );
  },
  async enableNotifications() {
    state.notifGranted = await ensureNotificationPermission();
    state.toast = state.notifGranted
      ? 'Benachrichtigungen sind an.'
      : 'Ohne Berechtigung weckt dich nur die geöffnete Seite.';
    render(true);
  },
};

function planFor(commitment, start) {
  const distanceKm = state.position ? haversineKm(state.position, commitment.dest) : null;
  return planDeparture({
    now: state.now,
    start,
    bufferMin: commitment.bufferMin,
    distanceKm,
    mode: commitment.mode,
    speeds: state.settings.speeds,
    factors: state.settings.factors,
    travelHistory: history(commitment.id, 'travel'),
    prepHistory: history(commitment.id, 'prep'),
    defaultPrepMin: commitment.prepDefaultMin,
    alpha: state.settings.alpha,
    percentileP: state.settings.percentile,
    tightMin: state.settings.tightMin,
  });
}

export function applyTheme(theme) {
  const resolved = theme === 'light' || theme === 'dark'
    ? theme
    : (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  document.documentElement.dataset.theme = resolved;
  if (theme === 'light' || theme === 'dark') localStorage.setItem('chronostasis-theme', theme);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', resolved === 'dark' ? '#10141c' : '#f3ecdf');
}

export function nativePlatform() {
  return platform();
}

export function notificationsOn() {
  return notificationPermissionGranted() || state.notifGranted;
}

export function androidShell() {
  return isNative() && platform() === 'android';
}
