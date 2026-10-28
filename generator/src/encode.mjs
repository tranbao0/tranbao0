import { crc32 } from 'node:zlib';
import sharp from 'sharp';

// Writes gray values (and an optional alpha channel) as a palette PNG.
// Gray values must already sit on the allowed levels, so no dithering happens.
export async function encodePalettePng({ gray, alpha, width, height }) {
  const rgba = Buffer.alloc(width * height * 4);
  for (let i = 0; i < gray.length; i++) {
    const a = alpha ? alpha[i] : 255;
    const g = a === 0 ? 0 : gray[i]; // fully transparent pixels carry no color information
    rgba[i * 4] = g;
    rgba[i * 4 + 1] = g;
    rgba[i * 4 + 2] = g;
    rgba[i * 4 + 3] = a;
  }
  const png = await sharp(rgba, { raw: { width, height, channels: 4 } })
    .png({ palette: true, colours: 4, dither: 0, compressionLevel: 9, effort: 10 })
    .toBuffer();
  return blankTransparentEntries(png);
}

// The quantizer picks an arbitrary tint for the fully transparent palette entry.
// Rewrites every such PLTE entry to black, so every color in the file is a pure gray.
function blankTransparentEntries(png) {
  const out = Buffer.from(png);
  let plte = -1;
  let trns = -1;
  for (let p = 8; p < out.length; p += 12 + out.readUInt32BE(p)) {
    const type = out.toString('ascii', p + 4, p + 8);
    if (type === 'PLTE') plte = p;
    if (type === 'tRNS') trns = p;
  }
  if (plte < 0 || trns < 0) return out;
  const entries = out.readUInt32BE(plte) / 3;
  const alphas = out.readUInt32BE(trns);
  for (let i = 0; i < Math.min(entries, alphas); i++) {
    if (out[trns + 8 + i] === 0) out.fill(0, plte + 8 + i * 3, plte + 11 + i * 3);
  }
  out.writeUInt32BE(crc32(out.subarray(plte + 4, plte + 8 + entries * 3)), plte + 8 + entries * 3);
  return out;
}

// Reads a PNG back into gray, alpha, and the set of distinct RGBA values.
export async function decodeGrayPng(buffer) {
  const { data, info } = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const n = info.width * info.height;
  const gray = new Uint8Array(n);
  const alpha = new Uint8Array(n);
  const colours = new Set();
  for (let i = 0; i < n; i++) {
    gray[i] = data[i * 4];
    alpha[i] = data[i * 4 + 3];
    colours.add(data.readUInt32LE(i * 4));
  }
  return { gray, alpha, width: info.width, height: info.height, colours };
}

// Composites a transparent gray layer over an opaque gray base.
export function compositeGray(base, layer) {
  const gray = new Uint8Array(base.gray.length);
  for (let i = 0; i < gray.length; i++) gray[i] = layer.alpha[i] > 127 ? layer.gray[i] : base.gray[i];
  return { gray, alpha: null, width: base.width, height: base.height };
}
