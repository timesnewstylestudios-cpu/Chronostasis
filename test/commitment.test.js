import assert from 'node:assert/strict';
import { test } from 'node:test';
import { normalizeCommitment } from '../src/lib/commitment.js';

const valid = {
  name: 'Arbeit',
  type: 'arbeit',
  weekdays: [1, 1, 3],
  startTime: '09:00',
  bufferMin: 10,
  prepDefaultMin: 30,
  mode: 'transit',
  dest: { lat: 52.52, lon: 13.405, label: 'Büro' },
};

test('normalizes weekdays and keeps the destination', () => {
  const commitment = normalizeCommitment(valid, 'id-1');
  assert.deepEqual(commitment.weekdays, [1, 3]);
  assert.equal(commitment.dest.label, 'Büro');
  assert.equal(commitment.id, 'id-1');
});

test('rejects a commitment without a place or a day', () => {
  assert.throws(() => normalizeCommitment({ ...valid, weekdays: [] }, 'id'), /Wochentag/);
  assert.throws(() => normalizeCommitment({ ...valid, dest: { lat: 120, lon: 0 } }, 'id'), /Wertebereich/);
  assert.throws(() => normalizeCommitment({ ...valid, name: '   ' }, 'id'), /Name/);
});
