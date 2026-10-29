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
  assert.equal(svg.match(/@keyframes hop-/g).length, 2);
  assert.match(svg, /flip-0 3\.5s step-end [\d.]+s infinite/);
});

test('the entrance only slides the letters sideways, and no keyframe repeats a percentage', () => {
  const enter = svg.split('\n').filter((line) => line.includes('@keyframes enter-')).join('\n');
  assert.equal(enter.split('\n').length, 6);
  assert.doesNotMatch(enter, /translate\([^)]*, -?[1-9]/);
  for (const m of svg.matchAll(/@keyframes (?:flip|hop)-\d+ \{(.*)\}/g)) {
    const stops = [...m[1].matchAll(/([\d.]+)% \{/g)].map((s) => s[1]);
    assert.equal(new Set(stops).size, stops.length);
  }
});

test('letter 2k hops for one step while letter k flips, and the letters before it do not', () => {
  assert.match(svg, /#l2 \.hop \{ animation: hop-2 0\.0833s step-end /);
  assert.match(svg, /#l4 \.hop \{ animation: hop-4 0\.0833s step-end /);
  assert.doesNotMatch(svg, /hop-[135]/);
  const start = (id) => Number(svg.match(new RegExp(`#l${id} \\.twin \\{[^}]*step-end ([\\d.]+)s`))[1]);
  const hopStart = (id) => Number(svg.match(new RegExp(`#l${id} \\.hop \\{[^}]*step-end ([\\d.]+)s`))[1]);
  assert.ok(Math.abs(hopStart(2) - (start(0) + 5 / 60)) < 1e-3);
  assert.ok(Math.abs(hopStart(4) - (start(0) + 10 / 60)) < 1e-3);
});

test('the first entrance step shows only the letter right of the middle, and the last shows all', () => {
  const firstStep = (i) => svg.match(new RegExp(`@keyframes enter-${i} \\{ 0% \\{[^}]*\\} [\\d.]+% \\{ opacity: (\\d)`))[1];
  assert.deepEqual([0, 1, 2, 3, 4, 5].map(firstStep), ['0', '0', '0', '0', '1', '0']);
  for (let i = 0; i < 6; i++) assert.match(svg, new RegExp(`@keyframes enter-${i} \\{.*87\\.1795% \\{ opacity: 1;`));
});
