import assert from 'node:assert/strict';
import { test } from 'node:test';
import { commitSettingsChange, DEFAULT_SETTINGS, resolveSettings } from '../src/lib/settings.js';

test('speed changes wait until the next local midnight, theme does not', () => {
  const now = new Date(2026, 10, 25, 10, 15, 0, 0);
  const result = commitSettingsChange(DEFAULT_SETTINGS, null, {
    theme: 'dark',
    speeds: { ...DEFAULT_SETTINGS.speeds, bike: 18 },
  }, now);
  assert.equal(result.settings.theme, 'dark');
  assert.equal(result.settings.speeds.bike, DEFAULT_SETTINGS.speeds.bike);
  assert.equal(result.pending.speeds.bike, 18);
  assert.match(result.message, /morgen/);

  const before = resolveSettings(result.settings, result.pending, new Date(2026, 10, 25, 23, 0, 0, 0));
  assert.equal(before.changed, false);
  assert.equal(before.settings.speeds.bike, DEFAULT_SETTINGS.speeds.bike);

  const after = resolveSettings(result.settings, result.pending, new Date(2026, 10, 26, 0, 0, 0, 0));
  assert.equal(after.changed, true);
  assert.equal(after.settings.speeds.bike, 18);
  assert.equal(after.pending, null);
});

test('the first home is immediate and a later move waits', () => {
  const now = new Date(2026, 10, 25, 8, 0, 0, 0);
  const first = commitSettingsChange(DEFAULT_SETTINGS, null, {
    home: { lat: 52.5, lon: 13.4, label: 'Wohnung' },
  }, now);
  assert.equal(first.settings.home.label, 'Wohnung');
  assert.equal(first.pending, null);

  const moved = commitSettingsChange(first.settings, null, {
    home: { lat: 48.1, lon: 11.6, label: 'Anderswo' },
  }, now);
  assert.equal(moved.settings.home.label, 'Wohnung');
  assert.equal(moved.pending.home.label, 'Anderswo');
});
