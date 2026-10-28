// Seeded random numbers and smooth noise fields.

export function createRng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const smooth = (f) => f * f * (3 - 2 * f);

// Value noise on a grid of `cell` pixels, smoothly interpolated. Values are in 0..1.
export function noiseField(width, height, cell, rand) {
  const gw = Math.ceil(width / cell) + 2;
  const gh = Math.ceil(height / cell) + 2;
  const grid = new Float32Array(gw * gh);
  for (let i = 0; i < grid.length; i++) grid[i] = rand();
  const out = new Float32Array(width * height);
  for (let y = 0; y < height; y++) {
    const fy = y / cell;
    const iy = Math.floor(fy);
    const ty = smooth(fy - iy);
    for (let x = 0; x < width; x++) {
      const fx = x / cell;
      const ix = Math.floor(fx);
      const tx = smooth(fx - ix);
      const i = iy * gw + ix;
      const top = grid[i] * (1 - tx) + grid[i + 1] * tx;
      const bottom = grid[i + gw] * (1 - tx) + grid[i + gw + 1] * tx;
      out[y * width + x] = top * (1 - ty) + bottom * ty;
    }
  }
  return out;
}

// Sum of several noise fields, `layers` is a list of [cell, weight]. Weights should add up to 1.
export function fractalField(width, height, layers, rand) {
  const out = new Float32Array(width * height);
  for (const [cell, weight] of layers) {
    const field = noiseField(width, height, cell, rand);
    for (let i = 0; i < out.length; i++) out[i] += field[i] * weight;
  }
  return out;
}
