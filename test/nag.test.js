import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isCommitmentLocked, nagDecision } from '../src/lib/nag.js';

const base = {
  nowMs: 100,
  wakeMs: 50,
  leaveByMs: 200,
  paused: false,
  arrived: false,
  inside: false,
  onTheWay: false,
  snoozedUntil: null,
};

test('geofence entry stops the nag and marks arrival', () => {
  const decision = nagDecision({ ...base, inside: true });
  assert.equal(decision.active, false);
  assert.equal(decision.cause, 'geofence');
  assert.equal(decision.markArrived, true);
});

test('motion toward the destination slows the nag instead of ending it', () => {
  const decision = nagDecision({ ...base, onTheWay: true });
  assert.equal(decision.active, true);
  assert.equal(decision.cause, 'unterwegs');
  assert.equal(decision.everyMin, 10);
  assert.equal(decision.intensityCap, 1);
});

test('snooze is silent only until its deadline', () => {
  assert.equal(nagDecision({ ...base, snoozedUntil: 150 }).cause, 'schlummern');
  assert.equal(nagDecision({ ...base, nowMs: 150, snoozedUntil: 150 }).active, true);
});

test('a legitimate pause and a time before wake stay quiet', () => {
  assert.equal(nagDecision({ ...base, paused: true }).cause, 'pause');
  assert.equal(nagDecision({ ...base, nowMs: 40 }).cause, 'warten');
});

test('the commitment locks once wake time has passed and stays locked through edits', () => {
  const plan = { wakeAt: new Date(1_000) };
  assert.equal(isCommitmentLocked(1_000, plan, null), true);
  assert.equal(isCommitmentLocked(999, plan, null), false);
  assert.equal(isCommitmentLocked(5_000, plan, { pausedReason: 'krank' }), false);
  assert.equal(isCommitmentLocked(5_000, { wakeAt: null }, null), false);
});
