import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ewma } from '../src/lib/ewma.js';

test('empty series is null', () => {
  assert.equal(ewma([]), null);
});

test('single sample is itself', () => {
  assert.equal(ewma([42]), 42);
});

test('hand-computed alpha 0.3', () => {
  const values = [30, 30, 50, 60];
  const e1 = 0.3 * 30 + 0.7 * 30;
  const e2 = 0.3 * 50 + 0.7 * e1;
  const e3 = 0.3 * 60 + 0.7 * e2;
  assert.equal(ewma(values, 0.3), e3);
  assert.ok(Math.abs(e3 - 43.2) < 1e-9);
});

test('recent samples weigh more than the first', () => {
  const rising = ewma([10, 10, 10, 40], 0.5);
  const falling = ewma([40, 10, 10, 10], 0.5);
  assert.ok(rising > falling);
});

test('rejects an alpha outside (0, 1]', () => {
  assert.throws(() => ewma([1], 0), /alpha/);
  assert.throws(() => ewma([1], 1.2), /alpha/);
});
