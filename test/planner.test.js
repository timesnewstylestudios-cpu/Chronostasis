import assert from 'node:assert/strict';
import { test } from 'node:test';
import { learnedMinutes, planDeparture, travelMinutesFromSpeed } from '../src/lib/planner.js';

const start = new Date(2026, 10, 25, 9, 0, 0, 0);

test('bike speed over 10 km is 40 minutes', () => {
  assert.equal(travelMinutesFromSpeed(10, 'bike'), 40);
});

test('a factor of 2 halves the travel time', () => {
  const minutes = travelMinutesFromSpeed(10, 'car', undefined, { walk: 1, bike: 1, transit: 1, car: 2 });
  assert.equal(minutes, travelMinutesFromSpeed(10, 'car') / 2);
});

test('without history, leave-by and wake follow speed and default prep', () => {
  const plan = planDeparture({
    now: new Date(2026, 10, 25, 6, 0, 0, 0),
    start,
    bufferMin: 10,
    distanceKm: 10,
    mode: 'bike',
    defaultPrepMin: 30,
  });
  assert.equal(plan.travelMin, 40);
  assert.equal(plan.travelSource, 'basis');
  assert.equal(plan.leaveBy.getHours(), 8);
  assert.equal(plan.leaveBy.getMinutes(), 10);
  assert.equal(plan.wakeAt.getHours(), 7);
  assert.equal(plan.wakeAt.getMinutes(), 40);
  assert.equal(plan.status, 'puenktlich');
});

test('p85 above the EWMA becomes the learned travel time after the ramp', () => {
  const history = [30, 30, 50, 60];
  assert.ok(Math.abs(learnedMinutes(history, 0.3, 0.85) - 55.5) < 1e-9);
  const plan = planDeparture({
    now: new Date(2026, 10, 25, 6, 0, 0, 0),
    start,
    bufferMin: 10,
    distanceKm: 10,
    mode: 'bike',
    travelHistory: history,
    defaultPrepMin: 30,
  });
  assert.equal(plan.travelSource, 'gelernt');
  assert.ok(Math.abs(plan.travelMin - 55.5) < 1e-9);
  const expectedLeave = start.getTime() - (10 + 55.5) * 60000;
  assert.equal(plan.leaveBy.getTime(), expectedLeave);
});

test('two samples only partly replace the speed estimate', () => {
  const plan = planDeparture({
    now: new Date(2026, 10, 25, 6, 0, 0, 0),
    start,
    bufferMin: 0,
    distanceKm: 10,
    mode: 'bike',
    travelHistory: [80, 80],
    defaultPrepMin: 0,
  });
  assert.equal(plan.travelSource, 'mischung');
  assert.ok(plan.travelMin > 40 && plan.travelMin < 80);
});

test('status turns knapp and then zu spät against leave-by', () => {
  const early = planDeparture({
    now: new Date(2026, 10, 25, 8, 6, 0, 0),
    start,
    bufferMin: 10,
    distanceKm: 10,
    mode: 'bike',
    defaultPrepMin: 30,
    tightMin: 5,
  });
  assert.equal(early.status, 'knapp');
  const late = planDeparture({
    now: new Date(2026, 10, 25, 8, 11, 0, 0),
    start,
    bufferMin: 10,
    distanceKm: 10,
    mode: 'bike',
    defaultPrepMin: 30,
  });
  assert.equal(late.status, 'zu_spaet');
});

test('missing distance without history cannot invent a wake time', () => {
  const plan = planDeparture({
    now: new Date(2026, 10, 25, 6, 0, 0, 0),
    start,
    bufferMin: 10,
    distanceKm: null,
    mode: 'transit',
  });
  assert.equal(plan.status, 'kein_ziel');
  assert.equal(plan.wakeAt, null);
});

test('learned travel is used when the distance is unknown', () => {
  const plan = planDeparture({
    now: new Date(2026, 10, 25, 6, 0, 0, 0),
    start,
    bufferMin: 5,
    distanceKm: null,
    travelHistory: [20, 20, 20, 20],
  });
  assert.equal(plan.travelSource, 'gelernt');
  assert.equal(plan.travelMin, 20);
});
