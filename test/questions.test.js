import assert from 'node:assert/strict';
import { test } from 'node:test';
import { classify, deviationKind, step } from '../src/lib/questions.js';

test('deviation priority is away, then snooze, then still home, then no fix', () => {
  assert.equal(deviationKind({
    movingAway: true,
    snoozeCount: 3,
    atHome: true,
    leaveTimePassed: true,
    locationUnavailable: true,
  }), 'weg');
  assert.equal(deviationKind({
    movingAway: false,
    snoozeCount: 2,
    atHome: true,
    leaveTimePassed: true,
    locationUnavailable: false,
  }), 'schlummern');
  assert.equal(deviationKind({
    movingAway: false,
    snoozeCount: 1,
    atHome: true,
    leaveTimePassed: true,
  }), 'zuhause');
  assert.equal(deviationKind({
    movingAway: false,
    snoozeCount: 0,
    atHome: false,
    leaveTimePassed: true,
    locationUnavailable: true,
  }), 'kein_ort');
  assert.equal(deviationKind({
    movingAway: false,
    snoozeCount: 0,
    atHome: false,
    leaveTimePassed: false,
    locationUnavailable: true,
  }), null);
});

test('krank, homeoffice, frei and verschoben pause', () => {
  for (const id of ['krank', 'homeoffice', 'frei']) {
    const result = step('zuhause', id);
    assert.equal(result.type, 'result');
    assert.equal(classify(result), 'pause');
  }
  const shifted = step('zuhause', 'verschoben');
  assert.equal(shifted.type, 'question');
  assert.equal(shifted.nodeId, 'verschoben');
  const gone = step('verschoben', 'heute_nicht');
  assert.equal(classify(gone), 'pause');
  assert.equal(gone.reason, 'verschoben');
});

test('keine Lust does not pause', () => {
  const held = step('zuhause', 'aufgehalten');
  assert.equal(held.nodeId, 'aufgehalten');
  const mood = step('aufgehalten', 'keine_lust');
  assert.equal(classify(mood), 'continue');
  assert.equal(mood.reason, 'keine_lust');
  assert.equal(classify({ effect: 'pause', reason: 'keine_lust' }), 'continue');
});

test('getting dressed is a single snooze, not an off switch', () => {
  const result = step('aufgehalten', 'anziehen');
  assert.equal(classify(result), 'snooze_once');
  assert.match(result.message, /Abfahrtszeit/);
});

test('a missing location can pause, and only from that question', () => {
  const result = step('kein_ort', 'unmoeglich');
  assert.equal(classify(result), 'pause');
  assert.equal(result.reason, 'standort_unbekannt');
});

test('unknown answers throw instead of inventing an effect', () => {
  assert.throws(() => step('zuhause', 'zaubern'), /antwort/);
});
