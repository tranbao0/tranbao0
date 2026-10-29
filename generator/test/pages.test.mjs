import assert from 'node:assert/strict';
import { test } from 'node:test';
import { photocopyDefaults } from '@tranbao0/printshop/packs/zine';
import { withStreakDensity } from '../src/pages.mjs';

test('a full page keeps the default drum streak count', () => {
  assert.deepEqual(withStreakDensity(1600).toner, photocopyDefaults.toner);
});

test('a half-width page gets twice the count, so its density per pixel matches a full page', () => {
  const { toner } = withStreakDensity(800);
  assert.equal(toner.streaks, photocopyDefaults.toner.streaks * 2);
  assert.equal(toner.weak, photocopyDefaults.toner.weak);
  assert.equal(toner.streakStrength, photocopyDefaults.toner.streakStrength);
});

test('extra filter options override the density', () => {
  const { toner } = withStreakDensity(800, { toner: { ...photocopyDefaults.toner, streaks: 7 } });
  assert.equal(toner.streaks, 7);
});
