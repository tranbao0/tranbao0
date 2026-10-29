import { test } from 'node:test';
import assert from 'node:assert/strict';
import { projectsSvg, projectsHop } from '../src/projects-svg.mjs';

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
const tops = [27, 15, 36, 26, 14, 36, 14, 27];
const letters = tops.map((y, i) => ({ normal: png, x: 620 + i * 120, y, width: 110, height: 125 }));
const svg = projectsSvg({ base: png, letters, width: 1600, height: 175, label: 'test' });

test('every letter has one tile and no inverted twin', () => {
  assert.equal(svg.match(/<g id="l\d" class="letter">/g).length, 8);
  assert.equal(svg.match(/<image /g).length, 9);
  assert.doesNotMatch(svg, /twin|flip-|enter-/);
});

test('the letters hop one after another, one step each, then the strip rests', () => {
  assert.equal(svg.match(/@keyframes hop-/g).length, 8);
  assert.match(svg, /#l0 \.hop \{ animation: hop-0 3\.6667s step-end 0\.4s infinite; \}/);
  assert.match(svg, /@keyframes hop-0 \{ 0% \{ transform: translateY\(-13px\); \} 2\.2727% \{ transform: translateY\(0\); \} 100% \{ transform: translateY\(0\); \} \}/);
  assert.match(svg, /@keyframes hop-1 \{ 0% \{ transform: translateY\(0\); \} 2\.2727% \{ transform: translateY\(-13px\); \} 4\.5455% /);
});

test('the motion is stop-motion, has no script, and stops for reduced motion', () => {
  assert.doesNotMatch(svg, /ease|linear|<script/);
  assert.match(svg, /@media \(prefers-reduced-motion: reduce\)\s*\{\s*\* \{ animation: none !important; \}/);
});

test('the hop is toned down and never leaves the strip', () => {
  assert.equal(projectsHop(letters), 13);
  const roomy = tops.map((_, i) => ({ ...letters[i], y: 80 }));
  assert.equal(projectsHop(roomy), 24);
  assert.equal(projectsHop([{ ...letters[0], y: 0 }]), 0);
});
