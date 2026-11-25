import assert from 'node:assert/strict';
import { test } from 'node:test';
import { arrivalOutcome, recordsInWeek, reflectionEffect, summarize } from '../src/lib/stats.js';

test('quote includes misses and excludes legitimate pauses', () => {
  const stats = summarize([
    { date: '2026-11-23', outcome: 'on_time', lateMin: 0, reason: null },
    { date: '2026-11-24', outcome: 'late', lateMin: 12, reason: 'verspaetet' },
    { date: '2026-11-25', outcome: 'late', lateMin: 4, reason: 'verspaetet' },
    { date: '2026-11-25', outcome: 'missed', lateMin: 0, reason: 'verpasst' },
    { date: '2026-11-25', outcome: 'paused', lateMin: 0, reason: 'krank' },
  ]);
  assert.equal(stats.quote, 1 / 4);
  assert.equal(stats.avgLateMin, 8);
  assert.equal(stats.paused, 1);
  assert.equal(stats.topReason, 'verspaetet');
});

test('tied reasons pick the alphabetically first', () => {
  const stats = summarize([
    { date: '2026-11-23', outcome: 'paused', reason: 'frei' },
    { date: '2026-11-24', outcome: 'paused', reason: 'krank' },
  ]);
  assert.equal(stats.topReason, 'frei');
  assert.equal(stats.quote, null);
  assert.equal(stats.avgLateMin, 0);
});

test('week filter uses local Monday boundaries', () => {
  const wednesday = new Date(2026, 10, 25, 12, 0, 0, 0);
  const rows = recordsInWeek([
    { date: '2026-11-22', outcome: 'on_time' },
    { date: '2026-11-23', outcome: 'on_time' },
    { date: '2026-11-29', outcome: 'late', lateMin: 4 },
    { date: '2026-11-30', outcome: 'late', lateMin: 9 },
  ], wednesday);
  assert.deepEqual(rows.map((row) => row.date), ['2026-11-23', '2026-11-29']);
});

test('arrival after the start is late by the overrun, not by the buffer', () => {
  const start = Date.parse('2026-11-25T09:00:00');
  const early = arrivalOutcome(start - 5 * 60000, start);
  assert.equal(early.outcome, 'on_time');
  const late = arrivalOutcome(start + 6 * 60000, start);
  assert.equal(late.outcome, 'late');
  assert.equal(late.lateMin, 6);
});

test('evening reflection stores prep and refuses a nonsense duration', () => {
  const effect = reflectionEffect({ outcome: 'late', lateMin: 8, prepMin: 25 });
  assert.equal(effect.record.reason, 'verspaetet');
  assert.equal(effect.prepSample, 25);
  assert.throws(() => reflectionEffect({ outcome: 'on_time', prepMin: 400 }), /vorbereitung/);
});
