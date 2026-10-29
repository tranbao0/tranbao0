import { test } from 'node:test';
import assert from 'node:assert/strict';
import { coverSvg } from '../src/cover-svg.mjs';

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
const letters = Array.from({ length: 6 }, (_, i) => ({ normal: png, x: 200 + i * 200, y: 150, width: 180, height: 300 }));
const svg = coverSvg({ base: png, letters, width: 1600, height: 900, label: 'test' });

test('every letter has one tile and no inverted twin', () => {
  const placed = [...svg.matchAll(/<image x="(\d+)" y="(\d+)" width="(\d+)" height="(\d+)"/g)].map((m) => m.slice(1).join(','));
  assert.equal(placed.length, 6);
  assert.equal(svg.match(/<image /g).length, 7); // the base photocopy and six letters
  assert.doesNotMatch(svg, /twin|flip/);
});

test('the lamp and the jitter are gone', () => {
  assert.doesNotMatch(svg, /sweep|flicker|lamp/);
});

const S = 5 / 60; // a wave step
const F = 7.5 / 60; // a fan step
const LEAD = 0.4;
const W = 5 * S; // a wave: letters 1 to 5 hop, one per step
const waveStart = [LEAD + 3 * F + 20 / 60, LEAD + 3 * F + 20 / 60 + W + 3];

// Reads the stops of a keyframe rule as [seconds, declarations] pairs.
const stops = (name) => {
  const body = svg.match(new RegExp(`@keyframes ${name} \\{(.*)\\}`))[1];
  return [...body.matchAll(/([\d.]+)% \{([^}]*)\}/g)].map((m) => [(Number(m[1]) / 100) * period(), m[2].trim()]);
};
const period = () => Number(svg.match(/#l0 \{ animation: enter-0 ([\d.]+)s step-end infinite/)[1]);
const near = (a, b) => Math.abs(a - b) < 1e-3;

test('every animated element repeats the same period, and that period is the whole cycle', () => {
  const durations = [...svg.matchAll(/animation: [\w-]+ ([\d.]+)s step-end infinite/g)].map((m) => m[1]);
  assert.equal(durations.length, 6 + 5);
  assert.equal(new Set(durations).size, 1);
  // lead, fan out, hold, wave, rest, wave, rest, fan in
  assert.ok(near(period(), 0.4 + 3 * F + 20 / 60 + W + 3 + W + 3 + 3 * F));
  assert.doesNotMatch(svg, /forwards|animation-delay/);
  assert.doesNotMatch(svg, /step-end [\d.]+s/);
});

test('the motion is stop-motion and ends in a still title', () => {
  assert.doesNotMatch(svg, /ease|linear|<script/);
  assert.match(svg, /step-end/);
  assert.match(svg, /@media \(prefers-reduced-motion: reduce\)\s*\{\s*\* \{ animation: none !important; \}/);
  assert.equal(svg.match(/@keyframes hop-/g).length, 5);
});

test('no keyframe repeats a percentage, and the fan only slides the letters sideways', () => {
  const enter = svg.split('\n').filter((line) => line.includes('@keyframes enter-')).join('\n');
  assert.equal(enter.split('\n').length, 6);
  assert.doesNotMatch(enter, /translate\([^)]*, -?[1-9]/);
  for (const m of svg.matchAll(/@keyframes (?:hop|enter)-\d+ \{(.*)\}/g)) {
    const times = [...m[1].matchAll(/([\d.]+)% \{/g)].map((x) => x[1]);
    assert.equal(new Set(times).size, times.length);
  }
});

test('in every wave one letter hops per step, from left to right, and the first letter stays put', () => {
  for (let i = 1; i < 6; i++) {
    const hop = stops(`hop-${i}`).filter(([, d]) => d.includes('translateY(-95px)'));
    assert.equal(hop.length, 2);
    waveStart.forEach((w, n) => assert.ok(near(hop[n][0], w + (i - 1) * S), `hop ${i} wave ${n}`));
    // a hop lasts one wave step and comes back down
    const all = stops(`hop-${i}`);
    assert.ok(near(all[2][0] - all[1][0], S));
    assert.match(all[2][1], /translateY\(0\)/);
  }
  assert.doesNotMatch(svg, /hop-0|#l0 \.hop/);
  // no two letters hop in the same step
  const starts = [1, 2, 3, 4, 5].map((i) => stops(`hop-${i}`)[1][0]);
  assert.equal(new Set(starts.map((t) => t.toFixed(3))).size, 5);
});

test('the fan out and the fan in are the same steps in opposite order, 125 ms each', () => {
  for (let i = 0; i < 6; i++) {
    const s = stops(`enter-${i}`);
    assert.equal(s.length, 9); // bare, 3 fan out steps, in place, 3 fan in steps, bare
    const [bare, f0, f1, f2, inPlace, b0, b1, b2, end] = s;
    assert.equal(bare[1], end[1]);
    assert.match(inPlace[1], /opacity: 1; transform: translate\(0, 0\)/);
    assert.ok(near(f0[0], LEAD) && near(f1[0] - f0[0], F) && near(f2[0] - f1[0], F) && near(inPlace[0] - f2[0], F));
    assert.ok(near(b1[0] - b0[0], F) && near(b2[0] - b1[0], F) && near(end[0] - b2[0], F));
    // backward: the last fan out step comes first
    assert.equal(b0[1], f2[1]);
    assert.equal(b1[1], f1[1]);
    assert.equal(b2[1], f0[1]);
  }
  // after the second wave and its rest, the fan in starts
  const b0 = stops('enter-0')[5][0];
  assert.ok(near(b0, waveStart[1] + W + 3));
});

test('the first fan step shows only the letter right of the middle, and the last shows all', () => {
  const step = (i, k) => stops(`enter-${i}`)[k][1].match(/opacity: (\d)/)[1];
  assert.deepEqual([0, 1, 2, 3, 4, 5].map((i) => step(i, 1)), ['0', '0', '0', '0', '1', '0']);
  for (let i = 0; i < 6; i++) assert.equal(step(i, 3), '1');
});

test('the build stops when a hopping letter would reach the header', async () => {
  const { assertHopsClearOf, HOP } = await import('../src/cover-svg.mjs');
  const header = { x: 60, y: 30, w: 820, h: 70 };
  const clear = [{ x: 200, y: 400, width: 100 }, { x: 320, y: 100 + HOP + 10, width: 100 }, { x: 1000, y: 120, width: 300 }];
  assert.doesNotThrow(() => assertHopsClearOf(header, clear));
  const blocked = [{ x: 200, y: 400, width: 100 }, { x: 320, y: 100 + HOP - 10, width: 100 }];
  assert.throws(() => assertHopsClearOf(header, blocked), /letter 1 hops into the header/);
  // The first letter never hops, so it may sit close under the header.
  assert.doesNotThrow(() => assertHopsClearOf(header, [{ x: 200, y: 110, width: 100 }]));
  // The margin is 4 px: a hop top exactly at the header bottom plus 4 passes, one pixel higher stops the build.
  const bottom = header.y + header.h;
  assert.doesNotThrow(() => assertHopsClearOf(header, [{ x: 0, y: 900, width: 1 }, { x: 320, y: bottom + 4 + HOP, width: 100 }]));
  assert.throws(() => assertHopsClearOf(header, [{ x: 0, y: 900, width: 1 }, { x: 320, y: bottom + 3 + HOP, width: 100 }]), /hops into the header/);
  // A letter fully left or right of the header may hop above its bottom.
  assert.doesNotThrow(() => assertHopsClearOf(header, [{ x: 0, y: 900, width: 1 }, { x: 0, y: 40, width: header.x - 4 }, { x: header.x + header.w + 4, y: 40, width: 50 }]));
  assert.throws(() => assertHopsClearOf(header, [{ x: 0, y: 900, width: 1 }, { x: 0, y: 40, width: header.x - 3 }]), /hops into the header/);
});

test('the build stops when the header box is missing or empty', async () => {
  const { assertHopsClearOf } = await import('../src/cover-svg.mjs');
  assert.throws(() => assertHopsClearOf(undefined, []), /header box is missing or empty/);
  assert.throws(() => assertHopsClearOf({ x: 0, y: 0, w: 0, h: 0 }, []), /header box is missing or empty/);
});
