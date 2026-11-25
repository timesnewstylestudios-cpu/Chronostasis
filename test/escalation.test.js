import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildNagSchedule, phaseFor, snoozeDecision, validatePhases } from '../src/lib/escalation.js';

test('phases step from 10 to 5 to 2 minutes', () => {
  assert.deepEqual(phaseFor(0, false), { untilMin: 20, everyMin: 10, intensity: 1 });
  assert.deepEqual(phaseFor(19.9, false), { untilMin: 20, everyMin: 10, intensity: 1 });
  assert.equal(phaseFor(20, false).everyMin, 5);
  assert.equal(phaseFor(39, false).intensity, 2);
  assert.equal(phaseFor(40, false).everyMin, 2);
  assert.equal(phaseFor(40, false).intensity, 3);
});

test('a passed leave-by jumps straight to the fastest phase', () => {
  assert.equal(phaseFor(0, true).everyMin, 2);
});

test('schedule emits 10 then 5 then 2 when leave-by is late', () => {
  const wake = Date.parse('2026-11-25T07:00:00');
  const leaveBy = Date.parse('2026-11-25T09:00:00');
  const until = wake + 50 * 60000;
  const schedule = buildNagSchedule(wake, leaveBy, until);
  const steps = [];
  for (let i = 1; i < schedule.length; i += 1) {
    steps.push((schedule[i].at - schedule[i - 1].at) / 60000);
  }
  assert.deepEqual(steps.slice(0, 2), [10, 10]);
  assert.ok(steps.includes(5));
  assert.equal(steps.at(-1), 2);
  assert.equal(schedule[0].intensity, 1);
  assert.equal(schedule.at(-1).intensity, 3);
});

test('schedule shortens once leave-by is inside the window', () => {
  const wake = 0;
  const leaveBy = 15 * 60000;
  const schedule = buildNagSchedule(wake, leaveBy, 30 * 60000);
  const at20 = schedule.find((item) => item.at === 20 * 60000);
  assert.equal(at20.intensity, 3);
  assert.equal(at20.everyMin, 2);
});

test('the queue stops at the cap', () => {
  const schedule = buildNagSchedule(0, 0, 24 * 60 * 60000, undefined, 24);
  assert.equal(schedule.length, 24);
});

test('snooze explains the cost and then refuses', () => {
  const first = snoozeDecision(0, 3, 5);
  assert.equal(first.allowed, true);
  assert.equal(first.remainingAfter, 2);
  assert.match(first.explanation, /nicht die Abfahrtszeit/);
  const last = snoozeDecision(3, 3, 5);
  assert.equal(last.allowed, false);
  assert.match(last.explanation, /aufgebraucht/);
});

test('phase validation rejects a gap that would disarm the nag', () => {
  assert.equal(validatePhases([{ untilMin: 10, everyMin: 45, intensity: 1 }]), 'Intervall zwischen 1 und 30 Minuten.');
  assert.equal(validatePhases([
    { untilMin: 20, everyMin: 10, intensity: 1 },
    { untilMin: null, everyMin: 2, intensity: 3 },
  ]), null);
});
