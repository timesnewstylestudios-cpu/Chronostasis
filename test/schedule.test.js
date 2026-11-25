import assert from 'node:assert/strict';
import { test } from 'node:test';
import { candidateStart, closeStale, nextStart, selectFocus } from '../src/lib/schedule.js';

const arbeit = {
  id: 'arbeit',
  weekdays: [1, 2, 3, 4, 5],
  startTime: '09:00',
};

test('next start skips today once the bell has passed', () => {
  const wednesdayEvening = new Date(2026, 10, 25, 18, 0, 0, 0);
  const start = nextStart(arbeit, wednesdayEvening);
  assert.equal(start.getDay(), 4);
  assert.equal(start.getDate(), 26);
  assert.equal(start.getHours(), 9);
});

test('candidate start keeps this morning inside the grace window', () => {
  const lateMorning = new Date(2026, 10, 25, 10, 30, 0, 0);
  const start = candidateStart(arbeit, lateMorning);
  assert.equal(start.getDate(), 25);
  assert.equal(start.getHours(), 9);
});

test('focus prefers the open commitment over a later one', () => {
  const now = new Date(2026, 10, 25, 8, 0, 0, 0);
  const uni = { id: 'uni', weekdays: [3], startTime: '14:00' };
  const focus = selectFocus([uni, arbeit], now, {});
  assert.equal(focus.commitment.id, 'arbeit');
});

test('an arrived commitment yields the next one', () => {
  const now = new Date(2026, 10, 25, 10, 0, 0, 0);
  const occurrences = {
    'arbeit:2026-11-25': { arrivedAt: now.getTime() },
  };
  const uni = { id: 'uni', weekdays: [3], startTime: '14:00' };
  const focus = selectFocus([arbeit, uni], now, occurrences);
  assert.equal(focus.commitment.id, 'uni');
});

test('a stale open occurrence becomes missed', () => {
  const start = new Date(2026, 10, 25, 9, 0, 0, 0);
  const updates = closeStale({
    'arbeit:2026-11-25': { key: 'arbeit:2026-11-25', startMs: start.getTime() },
  }, start.getTime() + 4 * 60 * 60 * 1000);
  assert.equal(updates.length, 1);
  assert.equal(updates[0].outcome, 'missed');
  assert.equal(updates[0].reason, 'verpasst');
});
