import { test } from 'node:test';
import assert from 'node:assert/strict';
import { coverSvg } from '../src/cover-svg.mjs';

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
const letters = Array.from({ length: 6 }, (_, i) => ({ normal: png, inverted: png, x: 200 + i * 200, y: 150, width: 180, height: 300 }));
const svg = coverSvg({ base: png, letters, width: 1600, height: 900, label: 'test' });

test('every letter has a tile and an inverted twin at the same place', () => {
  const placed = [...svg.matchAll(/<image (?:class="twin" )?x="(\d+)" y="(\d+)" width="(\d+)" height="(\d+)"/g)].map((m) => m.slice(1).join(','));
  assert.equal(placed.length, 12);
  for (let i = 0; i < 12; i += 2) assert.equal(placed[i], placed[i + 1]);
});

test('the lamp and the jitter are gone', () => {
  assert.doesNotMatch(svg, /sweep|flicker|lamp/);
});

test('the motion is stop-motion and ends in a still title', () => {
  assert.doesNotMatch(svg, /ease|linear|<script/);
  assert.match(svg, /step-end/);
  assert.match(svg, /@media \(prefers-reduced-motion: reduce\)\s*\{\s*\* \{ animation: none !important; \}/);
  assert.equal(svg.match(/@keyframes flip-/g).length, 6);
  assert.equal(svg.match(/@keyframes hop-/g).length, 5);
  assert.match(svg, /flip-0 3\.5s step-end [\d.]+s infinite/);
});
