import assert from 'node:assert/strict';
import { test } from 'node:test';
import { percentile } from '../src/lib/percentile.js';

test('empty input is null', () => {
  assert.equal(percentile([], 0.85), null);
});

test('single value ignores p', () => {
  assert.equal(percentile([12], 0.85), 12);
});

test('p85 of four values interpolates between the upper ranks', () => {
  const rank = 3 * 0.85;
  const expected = 50 * (1 - (rank - 2)) + 60 * (rank - 2);
  assert.ok(Math.abs(percentile([60, 30, 50, 30], 0.85) - expected) < 1e-9);
  assert.ok(Math.abs(expected - 55.5) < 1e-9);
});

test('median of an odd count is the middle', () => {
  assert.equal(percentile([1, 9, 3], 0.5), 3);
});

test('rejects p outside [0, 1]', () => {
  assert.throws(() => percentile([1, 2], 1.1), /p/);
});
