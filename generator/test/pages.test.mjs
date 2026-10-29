import assert from 'node:assert/strict';
import { access, readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { test } from 'node:test';
import { photocopyDefaults } from '@tranbao0/printshop/packs/zine';
import { pagesDir, withStreakDensity } from '../src/pages.mjs';

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

test('every page loads the zine pack from the installed package and keeps no copy of it', async () => {
  const pack = '../node_modules/@tranbao0/printshop/packs/zine';
  const files = (await readdir(pagesDir)).filter((f) => f.endsWith('.html'));
  assert.ok(files.length >= 8);
  for (const file of files) {
    const html = await readFile(path.join(pagesDir, file), 'utf8');
    assert.ok(html.includes(`href="${pack}/zine.css"`), `${file} loads zine.css from the pack`);
    assert.ok(html.includes(`src="${pack}/parts.js"`), `${file} loads parts.js from the pack`);
  }
  assert.equal((await readdir(pagesDir)).some((f) => f === 'parts.js' || f === 'zine.css'), false);
  const css = await readFile(path.join(pagesDir, pack, 'zine.css'), 'utf8');
  for (const url of css.matchAll(/url\("([^"]+)"\)/g)) await access(path.join(pagesDir, pack, url[1]));
});
