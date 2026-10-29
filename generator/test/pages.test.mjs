import assert from 'node:assert/strict';
import { access, readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { test } from 'node:test';
import { photocopyDefaults } from '@tranbao0/printshop/packs/zine';
import { croppedLetters, pagesDir, withStreakDensity } from '../src/pages.mjs';

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

const generatorDir = path.resolve(pagesDir, '..');
const exists = (file) => stat(file).then(() => true, () => false);

test('the generator keeps no local copy of the printshop modules', async () => {
  for (const dir of ['fonts']) assert.equal(await exists(path.join(generatorDir, dir)), false, `generator/${dir} must not exist`);
  for (const file of ['render', 'photocopy', 'encode', 'noise']) {
    assert.equal(await exists(path.join(generatorDir, 'src', `${file}.mjs`)), false, `generator/src/${file}.mjs must not exist`);
  }
  const sources = [
    path.join(generatorDir, 'build.mjs'),
    ...(await readdir(path.join(generatorDir, 'src'))).filter((f) => f.endsWith('.mjs')).map((f) => path.join(generatorDir, 'src', f)),
  ];
  const copies = /(?:from\s*|import\s*\(?\s*)['"]\.{1,2}\/(?:src\/)?(?:render|photocopy|encode|noise)(?:\.mjs)?['"]/;
  for (const file of sources) {
    assert.doesNotMatch(await readFile(file, 'utf8'), copies, `${path.relative(generatorDir, file)} imports a local copy`);
  }
});

test('the import check catches every form of a local copy', () => {
  const copies = /(?:from\s*|import\s*\(?\s*)['"]\.{1,2}\/(?:src\/)?(?:render|photocopy|encode|noise)(?:\.mjs)?['"]/;
  for (const line of ["import { x } from './render.mjs';", "import './noise.mjs';", "await import('./encode.mjs')", "import y from '../src/photocopy.mjs'"]) {
    assert.match(line, copies, line);
  }
  assert.doesNotMatch("import { x } from '@tranbao0/printshop/core/render';", copies);
  assert.doesNotMatch("import { x } from './cover-svg.mjs';", copies);
});

test('a tile with no ink or no alpha stops the build with a clear error', async () => {
  const empty = { gray: new Uint8Array(16), alpha: new Uint8Array(16), width: 4, height: 4 };
  await assert.rejects(croppedLetters([empty]), /letter 0: the tile has no ink/);
  await assert.rejects(croppedLetters([{ gray: new Uint8Array(16), width: 4, height: 4 }]), /letter 0: the tile must be transparent/);
  const ink = { gray: new Uint8Array(16), alpha: new Uint8Array(16), width: 4, height: 4 };
  ink.alpha[5] = 255;
  const [letter] = await croppedLetters([ink]);
  assert.deepEqual([letter.x, letter.y, letter.width, letter.height], [1, 1, 1, 1]);
});
