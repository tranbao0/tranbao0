import sharp from 'sharp';
import { createRng, noiseField, fractalField } from './noise.mjs';

// Every knob of the cheap-copier look. All values are in pixels of the 1600px wide source.
export const defaults = {
  seed: 1,
  contrast: 1.45, // slope around mid gray
  bleed: { amount: 1.5, cell: 11 }, // wobble of edges before the threshold
  edgeNoise: 0.2, // random jitter of the threshold, makes edges and dots uneven
  halftone: { cell: 6.5, angle: 45, low: 0.12, high: 0.88 },
  toner: {
    weak: 0.3, // how much low-frequency weak toner lifts mid and light grays
    weakFrom: 0.1, // input gray where the lift starts; it reaches full strength 0.1 above this
    streaks: 20, // faint vertical drum streaks
    streakStrength: 0.85,
  },
  specks: { black: 1 / 5200, white: 1 / 14000, hairs: 1 / 380000 },
  levels: [0, 255],
  // Calm zones: { x, y, w, h, mode } in source pixels.
  //   speck: keeps toner specks and hairs out of the zone.
  //   clean: also lowers the ink bleed and swaps the dot screen for a plain threshold, so small type keeps its strokes.
  //   soft:  also keeps specks out, with half the ink bleed and a weak dot screen, so pale tones still show as dots.
  zones: [],
  calm: {
    clean: { bleed: 0.25, screen: 0 }, // share of the ink bleed and of the dot screen that stays
    soft: { bleed: 0.5, screen: 0.35 },
  },
  zonePad: { speck: 8, clean: 4, soft: 4 },
};

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

// Reads an RGBA buffer into gray (0..1) and alpha (0..1).
function toGray(data, n) {
  const gray = new Float32Array(n);
  const alpha = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    gray[i] = (0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2]) / 255;
    alpha[i] = data[i * 4 + 3] / 255;
  }
  return { gray, alpha };
}

function sample(src, width, height, x, y) {
  x = x < 0 ? 0 : x > width - 1.001 ? width - 1.001 : x;
  y = y < 0 ? 0 : y > height - 1.001 ? height - 1.001 : y;
  const x0 = x | 0;
  const y0 = y | 0;
  const fx = x - x0;
  const fy = y - y0;
  const i = y0 * width + x0;
  const top = src[i] * (1 - fx) + src[i + 1] * fx;
  const bottom = src[i + width] * (1 - fx) + src[i + width + 1] * fx;
  return top * (1 - fy) + bottom * fy;
}

// Moves every pixel a little along smooth noise, so straight edges turn uneven.
// `keep`, if given, holds the share of the wobble that stays at each pixel.
function displace(src, width, height, amount, cell, rand, keep = null) {
  const dx = fractalField(width, height, [[cell, 0.65], [cell / 3, 0.35]], rand);
  const dy = fractalField(width, height, [[cell, 0.65], [cell / 3, 0.35]], rand);
  const out = new Float32Array(src.length);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      const a = keep ? amount * keep[i] : amount;
      out[i] = sample(src, width, height, x + (dx[i] - 0.5) * 2 * a, y + (dy[i] - 0.5) * 2 * a);
    }
  }
  return out;
}

// Per-column strength of faint vertical streaks: dark ones add toner, light ones drop it.
function streakColumns(width, count, strength, rand) {
  const dark = new Float32Array(width);
  const light = new Float32Array(width);
  for (let k = 0; k < count; k++) {
    const x = Math.floor(rand() * width);
    const w = 1 + Math.floor(rand() * 3);
    const amount = strength * (0.35 + rand() * 0.65);
    const target = rand() < 0.6 ? dark : light;
    for (let i = 0; i < w && x + i < width; i++) target[x + i] = Math.max(target[x + i], amount);
  }
  return { dark, light };
}

// Marks every pixel of the padded zones of the given modes with `value`.
function zoneMask(zones, modes, pad, width, height, mask = new Uint8Array(width * height), value = 1) {
  for (const z of zones) {
    if (!modes.includes(z.mode)) continue;
    const p = pad[z.mode];
    const x0 = Math.max(0, Math.floor(z.x - p));
    const y0 = Math.max(0, Math.floor(z.y - p));
    const x1 = Math.min(width, Math.ceil(z.x + z.w + p));
    const y1 = Math.min(height, Math.ceil(z.y + z.h + p));
    for (let y = y0; y < y1; y++) mask.fill(value, y * width + x0, y * width + x1);
  }
  return mask;
}

// True when any pixel of the square around (cx, cy) is marked.
function touches(mask, width, height, cx, cy, radius) {
  const r = Math.ceil(radius * 1.6 + 2);
  const x0 = Math.max(0, Math.round(cx) - r);
  const x1 = Math.min(width - 1, Math.round(cx) + r);
  const y0 = Math.max(0, Math.round(cy) - r);
  const y1 = Math.min(height - 1, Math.round(cy) + r);
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (mask[y * width + x]) return true;
  return false;
}

function stampSpeck(out, width, height, cx, cy, radius, rand) {
  const centre = out[Math.round(cy) * width + Math.round(cx)];
  const value = centre > 127 ? 0 : 255;
  const r = Math.ceil(radius + 1);
  const bumps = [rand(), rand(), rand()];
  for (let y = -r; y <= r; y++) {
    for (let x = -r; x <= r; x++) {
      const px = Math.round(cx) + x;
      const py = Math.round(cy) + y;
      if (px < 0 || py < 0 || px >= width || py >= height) continue;
      const angle = Math.atan2(y, x);
      const wobble = 1 + 0.35 * Math.sin(angle * 2 + bumps[0] * 6) + 0.2 * Math.sin(angle * 3 + bumps[1] * 6);
      if (Math.hypot(x, y) <= radius * wobble) out[py * width + px] = value;
    }
  }
}

function addHair(out, width, height, rand, keepOut = null) {
  let x = rand() * width;
  let y = rand() * height;
  let angle = rand() * Math.PI * 2;
  const length = 14 + rand() * 50;
  const value = out[Math.round(y) * width + Math.round(x)] > 127 ? 0 : 255;
  for (let s = 0; s < length; s++) {
    angle += (rand() - 0.5) * 0.35;
    x += Math.cos(angle);
    y += Math.sin(angle);
    const px = Math.round(x);
    const py = Math.round(y);
    if (px >= 0 && py >= 0 && px < width && py < height && !(keepOut && keepOut[py * width + px])) out[py * width + px] = value;
  }
}

// Turns an RGBA render into a photocopy. Returns { gray, alpha, width, height }.
// `alpha` is null when the input is fully opaque.
export function photocopy({ data, width, height }, options = {}) {
  const o = { ...defaults, ...options };
  const rand = createRng(o.seed);
  const n = width * height;
  const input = toGray(data, n);
  const hasAlpha = input.alpha.some((a) => a < 1);

  // Grayscale, then strong contrast.
  const contrasted = new Float32Array(n);
  for (let i = 0; i < n; i++) contrasted[i] = clamp01(0.5 + (input.gray[i] - 0.5) * o.contrast);

  // Calm zones.
  const hasZones = o.zones.length > 0;
  const speckMask = hasZones ? zoneMask(o.zones, ['clean', 'soft', 'speck'], o.zonePad, width, height) : null;
  // 0 outside, 1 in a clean zone, 2 in a soft zone.
  const calmMask = hasZones ? zoneMask(o.zones, ['soft'], o.zonePad, width, height, zoneMask(o.zones, ['clean'], o.zonePad, width, height), 2) : null;
  const calmOf = (i) => (calmMask[i] === 1 ? o.calm.clean : calmMask[i] === 2 ? o.calm.soft : null);
  let bleedKeep = null;
  if (hasZones) {
    bleedKeep = new Float32Array(n);
    for (let i = 0; i < n; i++) bleedKeep[i] = calmOf(i)?.bleed ?? 1;
  }

  // Ink bleed.
  const gray = displace(contrasted, width, height, o.bleed.amount, o.bleed.cell, rand, bleedKeep);
  const alpha = hasAlpha ? displace(input.alpha, width, height, o.bleed.amount, o.bleed.cell, rand, bleedKeep) : null;

  // Uneven toner: weak patches lift the blacks, drum streaks run top to bottom.
  const patches = fractalField(width, height, [[420, 0.6], [140, 0.4]], rand);
  const streakFade = noiseField(width, height, 380, rand);
  const streaks = streakColumns(width, o.toner.streaks, o.toner.streakStrength, rand);
  const grain = noiseField(width, height, 2, rand);
  const edge = fractalField(width, height, [[5, 0.5], [2, 0.5]], rand);

  // Clustered-dot halftone screen, turned by `angle` degrees.
  const theta = (o.halftone.angle * Math.PI) / 180;
  const cos = Math.cos(theta);
  const sin = Math.sin(theta);
  const tau = (Math.PI * 2) / o.halftone.cell;
  const { low, high } = o.halftone;

  const out = new Uint8Array(n);
  const outAlpha = hasAlpha ? new Uint8Array(n) : null;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      let g = gray[i];
      const reaches = clamp01((g - o.toner.weakFrom) / 0.1); // solid black stays black
      const weak = clamp01((patches[i] - 0.5) * 3) * o.toner.weak * reaches;
      g += (1 - g) * weak * 0.55;
      const fade = streakFade[i];
      g -= g * streaks.dark[x] * fade * 0.6;
      g += (1 - g) * streaks.light[x] * (1 - fade) * 0.8;
      g += (grain[i] - 0.5) * 0.14;

      const u = (x * cos + y * sin) * tau;
      const v = (-x * sin + y * cos) * tau;
      const calm = hasZones ? calmOf(i) : null;
      const screen = 0.5 + (calm ? calm.screen : 1) * 0.25 * (Math.cos(u) + Math.cos(v));
      const threshold = low + (high - low) * screen + (edge[i] - 0.5) * o.edgeNoise;
      out[i] = g < threshold ? 0 : 255;
      if (alpha) outAlpha[i] = alpha[i] > 0.5 + (edge[i] - 0.5) * o.edgeNoise ? 255 : 0;
    }
  }

  // Toner speckle: black specks on white, white specks on black, plus a few hairs.
  const speckArea = n;
  for (let k = 0, count = speckArea * o.specks.black; k < count; k++) {
    const cx = rand() * width;
    const cy = rand() * height;
    const radius = 0.7 + Math.pow(rand(), 3) * 3;
    if (outAlpha && !outAlpha[Math.round(cy) * width + Math.round(cx)]) continue;
    if (speckMask && touches(speckMask, width, height, cx, cy, radius)) continue;
    if (out[Math.round(cy) * width + Math.round(cx)] > 127) stampSpeck(out, width, height, cx, cy, radius, rand);
  }
  for (let k = 0, count = speckArea * o.specks.white; k < count; k++) {
    const cx = rand() * width;
    const cy = rand() * height;
    const radius = 0.7 + Math.pow(rand(), 3) * 2.5;
    if (outAlpha && !outAlpha[Math.round(cy) * width + Math.round(cx)]) continue;
    if (speckMask && touches(speckMask, width, height, cx, cy, radius)) continue;
    if (out[Math.round(cy) * width + Math.round(cx)] <= 127) stampSpeck(out, width, height, cx, cy, radius, rand);
  }
  for (let k = 0, count = speckArea * o.specks.hairs; k < count; k++) addHair(out, width, height, rand, speckMask);

  // Snap to the allowed levels.
  const levels = o.levels;
  if (levels.length > 2) {
    for (let i = 0; i < n; i++) out[i] = levels.reduce((best, l) => (Math.abs(l - out[i]) < Math.abs(best - out[i]) ? l : best));
  }
  return { gray: out, alpha: outAlpha, width, height };
}

// Decodes a PNG buffer into raw RGBA for the filter.
export async function decodeRgba(png) {
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}
