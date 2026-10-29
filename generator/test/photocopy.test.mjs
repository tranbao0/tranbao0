import { test } from 'node:test';
import assert from 'node:assert/strict';
import { photocopy } from '../src/photocopy.mjs';

// A plain white sheet. The cheap toner specks are the only thing that can mark it.
const white = (width, height) => ({ data: new Uint8Array(width * height * 4).fill(255), width, height });

const heavy = { specks: { black: 1 / 150, white: 0, hairs: 1 / 4000 }, toner: { weak: 0, weakFrom: 0.1, streaks: 0, streakStrength: 0 } };

test('a speck zone stays free of specks and hairs', () => {
  const zone = { x: 80, y: 60, w: 120, h: 80, mode: 'speck' };
  const { gray, width } = photocopy(white(400, 240), { ...heavy, seed: 7, zones: [zone] });
  let inside = 0;
  let outside = 0;
  for (let i = 0; i < gray.length; i++) {
    if (gray[i] > 127) continue;
    const x = i % width;
    const y = Math.floor(i / width);
    if (x >= zone.x && x < zone.x + zone.w && y >= zone.y && y < zone.y + zone.h) inside++;
    else outside++;
  }
  assert.equal(inside, 0);
  assert.ok(outside > 0, 'the test sheet must get specks outside the zone');
});

test('without zones the filter gives the same result as with an empty list', () => {
  const a = photocopy(white(200, 120), { ...heavy, seed: 3 });
  const b = photocopy(white(200, 120), { ...heavy, seed: 3, zones: [] });
  assert.deepEqual(a.gray, b.gray);
});

test('a clean zone drops the dot screen', () => {
  const gray = (width, height) => ({ data: new Uint8Array(width * height * 4).fill(160).map((v, i) => (i % 4 === 3 ? 255 : v)), width, height });
  const none = { specks: { black: 0, white: 0, hairs: 0 }, edgeNoise: 0, toner: { weak: 0, weakFrom: 0.1, streaks: 0, streakStrength: 0 } };
  const screened = photocopy(gray(120, 120), { ...none, seed: 5 });
  const clean = photocopy(gray(120, 120), { ...none, seed: 5, zones: [{ x: 0, y: 0, w: 120, h: 120, mode: 'clean' }] });
  const dots = (img) => img.gray.reduce((n, v) => n + (v === 0 ? 1 : 0), 0);
  assert.ok(dots(screened) > 0 && dots(screened) < 120 * 120, 'a mid gray makes dots under the screen');
  assert.equal(dots(clean), 0, 'a clean zone makes a flat threshold, so a pale gray turns white');
});
