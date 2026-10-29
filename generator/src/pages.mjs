import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { compositeGray, cropLayer, decodeGrayPng, encodePalettePng, inkBox } from '@tranbao0/printshop/core/encode';
import { copyLayer, renderCopy } from '@tranbao0/printshop/core/pipeline';
import { photocopy } from '@tranbao0/printshop/packs/zine';
import { assertHopsClearOf, coverSvg } from './cover-svg.mjs';
import { projectsSvg, PROJECTS_LETTERS } from './projects-svg.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const pagesDir = path.join(root, 'pages');
export const assetsDir = path.resolve(root, '..', 'assets');

// Every page goes through the photocopy look of printshop's zine pack.
const copy = (renderer, file, { layer, transparent, seed, width, data }) =>
  copyLayer(renderer, path.join(pagesDir, file), { layer, transparent, seed, width, data, filter: photocopy });
const copyGray = (renderer, file, { layer, transparent, seed, width, data }) =>
  renderCopy(renderer, path.join(pagesDir, file), { layer, transparent, seed, width, data, filter: photocopy });

// A page that is one still image. `width` is 1600 for full pages and 800 for half-width cards and tags.
export async function buildStatic(renderer, { file, out, seed, width = 1600, data }) {
  const png = await copy(renderer, file, { layer: 'all', transparent: false, seed, width, data });
  await writeFile(path.join(assetsDir, out), png);
  return [{ path: path.join(assetsDir, out), bytes: png.length }];
}

// The tiles of a lettered page, each as its own full-page photocopy with the same page seed.
// The page takes ?letter=N, which rides along in the layer string.
async function cutOutTiles(renderer, file, { count, seed }) {
  const tiles = [];
  for (let i = 0; i < count; i++) tiles.push(await copyGray(renderer, file, { layer: `title&letter=${i}`, transparent: true, seed }));
  return tiles;
}

// Crops every tile to its ink box, as palette PNGs: [{ x, y, width, height, normal }].
async function croppedLetters(tiles) {
  const letters = [];
  for (const tile of tiles) {
    const box = inkBox(tile);
    letters.push({ ...box, normal: await encodePalettePng(cropLayer(tile, box)) });
  }
  return letters;
}

// A still made of a base photocopy with the tiles stacked on it from left to right, like the animated SVG.
function stillOf(baseGray, tiles) {
  return tiles.reduce((still, tile) => compositeGray(still, tile), baseGray);
}

export async function buildCover(renderer) {
  const base = await copy(renderer, 'cover.html', { layer: 'base', transparent: false, seed: 101 });
  const baseGray = await decodeGrayPng(base);
  const tiles = await cutOutTiles(renderer, 'cover.html', { count: 6, seed: 102 });
  const letters = await croppedLetters(tiles);
  const { boxes } = await renderer.render(path.join(pagesDir, 'cover.html'), { layer: 'base' });
  assertHopsClearOf(boxes.header, letters);
  const svg = coverSvg({
    base,
    letters,
    width: baseGray.width,
    height: baseGray.height,
    label: 'We code - Bao Tran, Software Engineering at SJSU, on a burnt photocopied sheet',
  });
  const stillPng = await encodePalettePng(stillOf(baseGray, tiles));
  await writeFile(path.join(assetsDir, 'cover-still.png'), stillPng);
  await writeFile(path.join(assetsDir, 'cover.svg'), svg);
  return [
    { path: path.join(assetsDir, 'cover-still.png'), bytes: stillPng.length },
    { path: path.join(assetsDir, 'cover.svg'), bytes: Buffer.byteLength(svg) },
    { path: 'embedded base layer', bytes: base.length },
    { path: 'embedded title tiles', bytes: letters.reduce((sum, l) => sum + l.normal.length, 0) },
  ];
}

// The PROJECTS strip: the same cut-out letters as the cover title, but they only hop.
export async function buildProjects(renderer) {
  const base = await copy(renderer, 'projects.html', { layer: 'base', transparent: false, seed: 404 });
  const baseGray = await decodeGrayPng(base);
  const tiles = await cutOutTiles(renderer, 'projects.html', { count: PROJECTS_LETTERS, seed: 405 });
  const letters = await croppedLetters(tiles);
  const svg = projectsSvg({
    base,
    letters,
    width: baseGray.width,
    height: baseGray.height,
    label: 'Track 04, Title Track: Projects. The title track is Weekrow.',
  });
  const stillPng = await encodePalettePng(stillOf(baseGray, tiles));
  await writeFile(path.join(assetsDir, 'projects.png'), stillPng);
  await writeFile(path.join(assetsDir, 'projects.svg'), svg);
  return [
    { path: path.join(assetsDir, 'projects.png'), bytes: stillPng.length },
    { path: path.join(assetsDir, 'projects.svg'), bytes: Buffer.byteLength(svg) },
  ];
}
