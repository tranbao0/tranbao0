import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { photocopy, decodeRgba } from './photocopy.mjs';
import { encodePalettePng, decodeGrayPng, compositeGray } from './encode.mjs';
import { coverSvg } from './cover-svg.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const pagesDir = path.join(root, 'pages');
export const assetsDir = path.resolve(root, '..', 'assets');

// Renders a page layer and runs it through the photocopy filter. Returns a palette PNG buffer.
async function copyLayer(renderer, file, { layer, transparent, seed, width, data }) {
  const { png, zones } = await renderer.render(path.join(pagesDir, file), { layer, transparent, width, data });
  const copy = photocopy(await decodeRgba(png), { seed, zones });
  return encodePalettePng(copy);
}

// A page that is one still image. `width` is 1600 for full pages and 800 for half-width cards and tags.
export async function buildStatic(renderer, { file, out, seed, width = 1600, data }) {
  const png = await copyLayer(renderer, file, { layer: 'all', transparent: false, seed, width, data });
  await writeFile(path.join(assetsDir, out), png);
  return [{ path: path.join(assetsDir, out), bytes: png.length }];
}

export async function buildCover(renderer) {
  const base = await copyLayer(renderer, 'cover.html', { layer: 'base', transparent: false, seed: 101 });
  const title = await copyLayer(renderer, 'cover.html', { layer: 'title', transparent: true, seed: 102 });
  const baseGray = await decodeGrayPng(base);
  const titleGray = await decodeGrayPng(title);
  const still = await encodePalettePng(compositeGray(baseGray, titleGray));
  const svg = coverSvg({
    base,
    title,
    width: baseGray.width,
    height: baseGray.height,
    label: 'We code - Bao Tran, Software Engineering at SJSU, on a burnt photocopied sheet',
  });
  await writeFile(path.join(assetsDir, 'cover-still.png'), still);
  await writeFile(path.join(assetsDir, 'cover.svg'), svg);
  return [
    { path: path.join(assetsDir, 'cover-still.png'), bytes: still.length },
    { path: path.join(assetsDir, 'cover.svg'), bytes: Buffer.byteLength(svg) },
    { path: 'embedded base layer', bytes: base.length },
    { path: 'embedded title layer', bytes: title.length },
  ];
}
