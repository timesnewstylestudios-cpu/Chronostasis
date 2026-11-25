/** Rule tree. No model, no generated language: every prompt and effect is fixed here. */

export const LEGITIMATE_REASONS = new Set([
  'krank',
  'homeoffice',
  'frei',
  'verschoben',
  'standort_unbekannt',
]);

export const TREE = {
  zuhause: {
    prompt: 'Du bist noch am Ausgangsort, obwohl du los musst. Was trifft zu?',
    options: [
      { id: 'krank', label: 'Ich bin krank', result: { effect: 'pause', reason: 'krank' } },
      { id: 'homeoffice', label: 'Homeoffice heute', result: { effect: 'pause', reason: 'homeoffice' } },
      { id: 'frei', label: 'Heute frei oder abgesagt', result: { effect: 'pause', reason: 'frei' } },
      { id: 'verschoben', label: 'Termin verschoben', next: 'verschoben' },
      { id: 'aufgehalten', label: 'Etwas hält mich auf', next: 'aufgehalten' },
    ],
  },
  verschoben: {
    prompt: 'Gilt der Termin heute noch?',
    options: [
      { id: 'heute_nicht', label: 'Heute nicht mehr', result: { effect: 'pause', reason: 'verschoben' } },
      {
        id: 'spaeter',
        label: 'Später heute',
        result: {
          effect: 'pause',
          reason: 'verschoben',
          message: 'Die heutige Erinnerung pausiert. Die neue Uhrzeit trägst du für den nächsten Tag im Plan ein.',
        },
      },
      { id: 'doch', label: 'Doch, ich gehe', result: { effect: 'continue', message: 'Gut. Die Erinnerung bleibt an.' } },
    ],
  },
  aufgehalten: {
    prompt: 'Was hält dich auf?',
    options: [
      {
        id: 'anziehen',
        label: 'Ich mache mich noch fertig',
        result: { effect: 'snooze_once', reason: 'fertigmachen', message: 'Einmal fünf Minuten. Die Abfahrtszeit rückt nicht mit.' },
      },
      {
        id: 'suche',
        label: 'Ich suche noch etwas',
        result: { effect: 'snooze_once', reason: 'suche', message: 'Einmal fünf Minuten. Die Abfahrtszeit rückt nicht mit.' },
      },
      {
        id: 'verkehr',
        label: 'Ich rechne mit viel Verkehr',
        result: { effect: 'continue', reason: 'verkehr', message: 'Dann zählt jede Minute. Die Erinnerung bleibt.' },
      },
      {
        id: 'keine_lust',
        label: 'Keine Lust',
        result: { effect: 'continue', reason: 'keine_lust', message: 'Keine Lust ist kein Ausnahmegrund. Die Erinnerung bleibt an.' },
      },
    ],
  },
  schlummern: {
    prompt: 'Du schlummerst schon wieder. Bist du krank, oder hält dich etwas auf?',
    options: [
      { id: 'krank', label: 'Ich bin krank', result: { effect: 'pause', reason: 'krank' } },
      { id: 'homeoffice', label: 'Homeoffice heute', result: { effect: 'pause', reason: 'homeoffice' } },
      { id: 'frei', label: 'Heute frei', result: { effect: 'pause', reason: 'frei' } },
      { id: 'aufgehalten', label: 'Etwas hält mich auf', next: 'aufgehalten' },
      { id: 'gehe', label: 'Ich gehe jetzt', result: { effect: 'continue', message: 'Gut. Die Erinnerung wird leiser, sobald du dich dem Ziel näherst.' } },
    ],
  },
  weg: {
    prompt: 'Du entfernst dich vom Ziel. Was ist passiert?',
    options: [
      { id: 'umweg', label: 'Kurzer Umweg, ich bin unterwegs', result: { effect: 'continue', reason: 'umweg', message: 'In Ordnung. Die Erinnerung bleibt, bis du näher kommst.' } },
      { id: 'krank', label: 'Ich kehre um, ich bin krank', result: { effect: 'pause', reason: 'krank' } },
      { id: 'homeoffice', label: 'Ich mache Homeoffice', result: { effect: 'pause', reason: 'homeoffice' } },
      { id: 'frei', label: 'Termin fällt aus', result: { effect: 'pause', reason: 'frei' } },
      { id: 'verschoben', label: 'Termin verschoben', next: 'verschoben' },
    ],
  },
  kein_ort: {
    prompt: 'Ohne Standort kann die App nicht prüfen, ob du unterwegs bist.',
    options: [
      { id: 'erlauben', label: 'Ich aktiviere den Standort', result: { effect: 'continue', reason: 'standort_holen', message: 'Sobald ein Ort da ist, prüft die App den Weg.' } },
      { id: 'unmoeglich', label: 'Standort geht gerade nicht', result: { effect: 'pause', reason: 'standort_unbekannt', message: 'Heute pausiert, weil die Ankunft nicht prüfbar ist. Der Grund bleibt in der Statistik.' } },
      { id: 'krank', label: 'Ich bin krank', result: { effect: 'pause', reason: 'krank' } },
      { id: 'homeoffice', label: 'Homeoffice heute', result: { effect: 'pause', reason: 'homeoffice' } },
      { id: 'frei', label: 'Heute frei', result: { effect: 'pause', reason: 'frei' } },
    ],
  },
  allgemein: {
    prompt: 'Kurze Rückfrage zu deiner Verpflichtung.',
    options: [
      { id: 'gehe', label: 'Ich bin dabei', result: { effect: 'continue', message: 'Die Erinnerung bleibt an.' } },
      { id: 'krank', label: 'Ich bin krank', result: { effect: 'pause', reason: 'krank' } },
      { id: 'homeoffice', label: 'Homeoffice heute', result: { effect: 'pause', reason: 'homeoffice' } },
      { id: 'frei', label: 'Heute frei', result: { effect: 'pause', reason: 'frei' } },
      { id: 'verschoben', label: 'Termin verschoben', next: 'verschoben' },
    ],
  },
};

/** Priority: moving away, then repeated snooze, then still at origin, then no fix. */
export function deviationKind(situation) {
  if (situation.movingAway) return 'weg';
  if (situation.snoozeCount >= 2) return 'schlummern';
  if (situation.atHome && situation.leaveTimePassed) return 'zuhause';
  if (situation.locationUnavailable && situation.leaveTimePassed) return 'kein_ort';
  return null;
}

export function present(nodeId) {
  const node = TREE[nodeId];
  if (!node) throw new Error('frage');
  return {
    nodeId,
    prompt: node.prompt,
    options: node.options.map((opt) => ({ id: opt.id, label: opt.label })),
  };
}

export function step(nodeId, optionId) {
  const node = TREE[nodeId];
  if (!node) throw new Error('frage');
  const opt = node.options.find((item) => item.id === optionId);
  if (!opt) throw new Error('antwort');
  if (opt.next) return { type: 'question', ...present(opt.next) };
  return { type: 'result', ...opt.result };
}

/** A pause counts only for a reason the tree marks as legitimate. */
export function classify(result) {
  if (!result) return 'continue';
  if (result.effect === 'pause' && LEGITIMATE_REASONS.has(result.reason)) return 'pause';
  if (result.effect === 'snooze_once') return 'snooze_once';
  return 'continue';
}

export const REASON_LABELS = {
  krank: 'Krank',
  homeoffice: 'Homeoffice',
  frei: 'Frei',
  verschoben: 'Verschoben',
  standort_unbekannt: 'Standort unbekannt',
  fertigmachen: 'Fertigmachen',
  suche: 'Suche',
  verkehr: 'Verkehr',
  keine_lust: 'Keine Lust',
  umweg: 'Umweg',
  verspaetet: 'Verspätet',
  verpasst: 'Verpasst',
  standort_holen: 'Standort holen',
};
