import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { photocopy, decodeRgba } from './photocopy.mjs';
import { encodePalettePng, decodeGrayPng, compositeGray } from './encode.mjs';
import { coverSvg } from './cover-svg.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const pagesDir = path.join(root, 'pages');
export const assetsDir = path.resolve(root, '..', 'assets');

// Renders a page layer and runs it through the photocopy filter. Returns { gray, alpha, width, height }.
async function renderCopy(renderer, file, { layer, transparent, seed, width, data }) {
  const { png, zones } = await renderer.render(path.join(pagesDir, file), { layer, transparent, width, data });
  return photocopy(await decodeRgba(png), { seed, zones });
}

// The same, encoded as a palette PNG buffer.
async function copyLayer(renderer, file, options) {
  return encodePalettePng(await renderCopy(renderer, file, options));
}

// A page that is one still image. `width` is 1600 for full pages and 800 for half-width cards and tags.
export async function buildStatic(renderer, { file, out, seed, width = 1600, data }) {
  const png = await copyLayer(renderer, file, { layer: 'all', transparent: false, seed, width, data });
  await writeFile(path.join(assetsDir, out), png);
  return [{ path: path.join(assetsDir, out), bytes: png.length }];
}

// Bounding box of the opaque pixels of a layer.
function inkBox({ alpha, width, height }) {
  let x0 = width;
  let y0 = height;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!alpha[y * width + x]) continue;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  return { x: x0, y: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 };
}

function cropLayer({ gray, alpha, width }, box) {
  const out = { gray: new Uint8Array(box.width * box.height), alpha: new Uint8Array(box.width * box.height), width: box.width, height: box.height };
  for (let y = 0; y < box.height; y++) {
    const from = (box.y + y) * width + box.x;
    out.gray.set(gray.subarray(from, from + box.width), y * box.width);
    out.alpha.set(alpha.subarray(from, from + box.width), y * box.width);
  }
  return out;
}

// The six title tiles, each as its own full-page photocopy in two clippings: as cut, and inverted.
// Both clippings use the same page seed, so the paper edges wobble the same way and the two line up pixel for pixel.
// The title page takes ?letter=N and ?inverted=1; they ride along in the layer string.
const TITLE_LETTERS = 6;

async function titleTiles(renderer) {
  const tiles = [];
  for (let i = 0; i < TITLE_LETTERS; i++) {
    const copy = (flipped) => renderCopy(renderer, 'cover.html', { layer: `title&letter=${i}${flipped ? '&inverted=1' : ''}`, transparent: true, seed: 102 });
    const normal = await copy(false);
    const inverted = await copy(true);
    if (!normal.alpha.every((a, k) => a === inverted.alpha[k])) throw new Error(`Title letter ${i}: the two clippings do not line up`);
    tiles.push({ normal, inverted });
  }
  return tiles;
}

export async function buildCover(renderer) {
  const base = await copyLayer(renderer, 'cover.html', { layer: 'base', transparent: false, seed: 101 });
  const baseGray = await decodeGrayPng(base);
  const tiles = await titleTiles(renderer);

  // The still shows the title as cut, tiles stacked left to right like the animated one.
  let still = baseGray;
  for (const tile of tiles) still = compositeGray(still, tile.normal);

  const letters = [];
  for (const { normal, inverted } of tiles) {
    const box = inkBox(normal);
    letters.push({
      ...box,
      normal: await encodePalettePng(cropLayer(normal, box)),
      inverted: await encodePalettePng(cropLayer(inverted, box)),
    });
  }
  const svg = coverSvg({
    base,
    letters,
    width: baseGray.width,
    height: baseGray.height,
    label: 'We code - Bao Tran, Software Engineering at SJSU, on a burnt photocopied sheet',
  });
  const stillPng = await encodePalettePng(still);
  await writeFile(path.join(assetsDir, 'cover-still.png'), stillPng);
  await writeFile(path.join(assetsDir, 'cover.svg'), svg);
  return [
    { path: path.join(assetsDir, 'cover-still.png'), bytes: stillPng.length },
    { path: path.join(assetsDir, 'cover.svg'), bytes: Buffer.byteLength(svg) },
    { path: 'embedded base layer', bytes: base.length },
    { path: 'embedded title tiles', bytes: letters.reduce((sum, l) => sum + l.normal.length + l.inverted.length, 0) },
  ];
}
