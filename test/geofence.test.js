import assert from 'node:assert/strict';
import { test } from 'node:test';
import { movementVerdict, stillAtOrigin } from '../src/lib/geofence.js';

const dest = { lat: 52.01, lon: 13 };

test('moving north toward a northern destination is on the way', () => {
  const prev = { lat: 52, lon: 13 };
  const curr = { lat: 52.002, lon: 13 };
  const verdict = movementVerdict(prev, curr, dest, { radiusM: 120, coneDeg: 50, minMoveM: 25 });
  assert.equal(verdict.toward, true);
  assert.equal(verdict.away, false);
  assert.equal(verdict.onTheWay, true);
  assert.ok(verdict.headingDelta < 5);
  assert.ok(verdict.distM < verdict.prevDist);
});

test('moving south away from that destination is away', () => {
  const prev = { lat: 52.002, lon: 13 };
  const curr = { lat: 52, lon: 13 };
  const verdict = movementVerdict(prev, curr, dest, { radiusM: 120, coneDeg: 50, minMoveM: 25 });
  assert.equal(verdict.away, true);
  assert.equal(verdict.toward, false);
  assert.ok(verdict.headingDelta > 170);
});

test('a few metres of jitter is not a direction', () => {
  const prev = { lat: 52, lon: 13 };
  const curr = { lat: 52.00005, lon: 13 };
  const verdict = movementVerdict(prev, curr, dest, { minMoveM: 25, coneDeg: 50, radiusM: 120 });
  assert.equal(verdict.toward, false);
  assert.equal(verdict.away, false);
});

test('entering the radius ends the approach', () => {
  const prev = { lat: 52.009, lon: 13 };
  const curr = { lat: 52.0097, lon: 13 };
  const verdict = movementVerdict(prev, curr, dest, { radiusM: 120, coneDeg: 50, minMoveM: 25 });
  assert.equal(verdict.inside, true);
  assert.equal(verdict.onTheWay, false);
});

test('home radius counts as still at the origin', () => {
  const home = { lat: 52, lon: 13 };
  assert.equal(stillAtOrigin({
    pos: { lat: 52.0003, lon: 13 },
    home,
    homeRadiusM: 80,
    anchor: null,
    dest,
    minMoveM: 25,
  }), true);
  assert.equal(stillAtOrigin({
    pos: { lat: 52.01, lon: 13 },
    home,
    homeRadiusM: 80,
    dest,
    minMoveM: 25,
  }), false);
});

test('without a home, the morning anchor decides', () => {
  const anchor = { lat: 52, lon: 13 };
  assert.equal(stillAtOrigin({
    pos: anchor,
    anchor,
    dest,
    home: null,
    homeRadiusM: 80,
    minMoveM: 25,
  }), true);
  assert.equal(stillAtOrigin({
    pos: { lat: 52.004, lon: 13 },
    anchor,
    dest,
    home: null,
    homeRadiusM: 80,
    minMoveM: 25,
  }), false);
});
