import assert from 'node:assert/strict';
import { test } from 'node:test';
import { angleDelta, bearingDeg, EARTH_RADIUS_KM, haversineKm, normalizeBearing } from '../src/lib/haversine.js';

test('same point is zero kilometres', () => {
  assert.equal(haversineKm({ lat: 52.5, lon: 13.4 }, { lat: 52.5, lon: 13.4 }), 0);
});

test('one degree of longitude at the equator matches the chosen radius', () => {
  const expected = (2 * Math.PI * EARTH_RADIUS_KM) / 360;
  const got = haversineKm({ lat: 0, lon: 0 }, { lat: 0, lon: 1 });
  assert.ok(Math.abs(got - expected) < 1e-6);
});

test('bearing north and east', () => {
  const north = normalizeBearing(bearingDeg({ lat: 0, lon: 0 }, { lat: 1, lon: 0 }));
  const east = normalizeBearing(bearingDeg({ lat: 0, lon: 0 }, { lat: 0, lon: 1 }));
  assert.ok(Math.abs(north) < 1e-6);
  assert.ok(Math.abs(east - 90) < 1e-6);
});

test('angle delta wraps across north', () => {
  assert.equal(angleDelta(350, 10), 20);
  assert.equal(angleDelta(0, 180), 180);
  assert.equal(angleDelta(10, 350), 20);
});
