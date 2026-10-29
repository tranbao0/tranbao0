// Animated cover: a base photocopy and one cut-out per title letter.
// Everything moves in stop-motion steps (no easing, no fades), like a title cut from magazine letters.
// The whole cycle is one period, and every animated element repeats it, so the parts never drift apart.
//
// One cycle, in seconds:
//   LEAD                    bare paper
//   fan out (3 steps)       one letter alone at the middle, a small cluster, every letter bunched, then all in place
//   HOLD                    nothing moves
//   jump wave               in step k letter k hops up and back down, from the first letter to the last
//   REST                    nothing moves
//   jump wave               the same again
//   REST                    nothing moves
//   fan in (3 steps)        the fan out played backward: every letter bunched, the small cluster, one letter alone, bare paper
//   then the cycle starts again with the lead

// The helpers marked "shared" also build the PROJECTS strip (projects-svg.mjs).
export const STEP = 5 / 60; // one stop-motion step: 5 frames at 60 fps
const LEAD = 0.4;
const FAN = 7.5 / 60; // one step of the fan out and the fan in: 9 / 6 of a wave step, because the title has 6 letters where the reference has 9
const WAVES = 2; // jump waves between the fan out and the fan in
const HOLD = 20 / 60;
export const REST = 3;
export const HOP = 95; // px a hopping letter rises

// Entrance: for each step, which letters show and how much of the way to the final place they have
// travelled (0 = piled at the middle of the word, 1 = in place). Letter numbers count from the left.
// The cluster and the last bunched step also nudge single letters sideways (px, by letter number) so that none hides behind a neighbour.
const entranceSteps = (count) => {
  const middle = Math.floor(count / 2) + 1;
  return [
    { shown: [middle], travelled: 0.12 },
    { shown: [0, 1, middle], travelled: 0.29, nudge: [-110] },
    { shown: Array.from({ length: count }, (_, i) => i), travelled: 0.67, nudge: [-20, -20, -25, -35, 40, 40] },
  ];
};

export const pct = (v) => `${+(v * 100).toFixed(4)}%`;
export const sec = (v) => `${+v.toFixed(4)}s`;

// Keyframes that hold `on` during each pulse ([start, end] in seconds from the start of the period) and `off` the rest of the period.
export function pulseKeyframes(name, pulses, period, on, off) {
  const stops = pulses.flatMap(([start, end]) => [`${pct(start / period)} { ${on} }`, `${pct(end / period)} { ${off} }`]);
  const first = pulses[0][0] === 0 ? [] : [`0% { ${off} }`];
  return `@keyframes ${name} { ${[...first, ...stops, `100% { ${off} }`].join(' ')} }`;
}

// Shared. Keyframes for a wave in which item i is "on" for one STEP and "off" for the rest of the period.
export function waveKeyframes(name, i, period, on, off) {
  return pulseKeyframes(name, [[i * STEP, (i + 1) * STEP]], period, on, off);
}

// Shared. Switches every animation off for readers who ask for less motion.
export const REDUCED_MOTION_CSS = `
  @media (prefers-reduced-motion: reduce) {
    * { animation: none !important; }
  }`;

const dataUri = (png) => `data:image/png;base64,${png.toString('base64')}`;

// Shared. One group per letter: an outer group for entrance moves, an inner one for the hop, then the clipping.
export function letterTiles(letters) {
  return letters
    .map((l, i) => `<g id="l${i}" class="letter"><g class="hop">\n  <image x="${l.x}" y="${l.y}" width="${l.width}" height="${l.height}" href="${dataUri(l.normal)}"/>\n</g></g>`)
    .join('\n');
}

// Shared. The SVG wrapper: a black sheet, the base photocopy, then the letters.
export function svgDocument({ width, height, label, css, base, tiles }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${label}">
<style>${css}
</style>
<rect width="${width}" height="${height}" fill="#000"/>
<image width="${width}" height="${height}" href="${dataUri(base)}"/>
${tiles}
</svg>
`;
}

// Seconds with enough digits that the period does not round away from the sum of its parts.
const exact = (v) => `${+v.toFixed(6)}s`;

function motionCss(letters) {
  const count = letters.length;
  const entrance = entranceSteps(count);
  const fanLength = entrance.length * FAN;
  const waveLength = count * STEP; // every letter hops, one per step
  const inPlace = LEAD + fanLength; // the fan out is done
  const waveStarts = Array.from({ length: WAVES }, (_, w) => inPlace + HOLD + w * (waveLength + REST));
  const fanInStart = waveStarts[WAVES - 1] + waveLength + REST;
  const period = fanInStart + fanLength;
  const duration = exact(period);
  // The piled letters gather at the middle of the word, from its left edge to its right edge.
  const left = Math.min(...letters.map((l) => l.x));
  const right = Math.max(...letters.map((l) => l.x + l.width));
  const middle = (left + right) / 2;
  let css = '';

  letters.forEach((l, i) => {
    const centre = l.x + l.width / 2;
    const bare = 'opacity: 0; transform: translate(0, 0);';
    const stateOf = (k) => {
      const s = entrance[k];
      const dx = (middle - centre) * (1 - s.travelled) + (s.nudge?.[i] ?? 0);
      return `opacity: ${s.shown.includes(i) ? 1 : 0}; transform: translate(${dx.toFixed(1)}px, 0);`;
    };
    // Bare paper, then each fan out step in order, all in place, then the same steps in reverse order, then bare paper again.
    const frames = [`0% { ${bare} }`];
    entrance.forEach((_, k) => frames.push(`${pct((LEAD + k * FAN) / period)} { ${stateOf(k)} }`));
    frames.push(`${pct(inPlace / period)} { opacity: 1; transform: translate(0, 0); }`);
    entrance.forEach((_, j) => frames.push(`${pct((fanInStart + j * FAN) / period)} { ${stateOf(entrance.length - 1 - j)} }`));
    frames.push(`100% { ${bare} }`);
    css += `
  @keyframes enter-${i} { ${frames.join(' ')} }
  #l${i} { animation: enter-${i} ${duration} step-end infinite; }`;

    // The hop: letter i rises for step i of every wave.
    const pulses = waveStarts.map((w) => [w + i * STEP, w + (i + 1) * STEP]);
    css += `
  ${pulseKeyframes(`hop-${i}`, pulses, period, `transform: translateY(${-HOP}px);`, 'transform: translateY(0);')}
  #l${i} .hop { animation: hop-${i} ${duration} step-end infinite; }`;
  });

  return css + REDUCED_MOTION_CSS;
}

// The title, letter by letter, from the left.
const TITLE = ['W', 'e', 'c', 'o', 'd', 'e'];
// The W sits right under the header label and hops over it on purpose, so the header check skips it.
const HOPS_OVER_HEADER = 'W';

// Throws when a hopping letter, at the top of its hop, would touch the header box. The W is exempt.
export function assertHopsClearOf(header, letters, margin = 4) {
  if (!header || !(header.w > 0 && header.h > 0)) throw new Error('cover: the header box is missing or empty, so the hops cannot be checked');
  letters.forEach((l, i) => {
    if (TITLE[i] === HOPS_OVER_HEADER) return;
    const top = l.y - HOP;
    const apart = l.x >= header.x + header.w + margin || l.x + l.width <= header.x - margin || top >= header.y + header.h + margin;
    if (!apart) throw new Error(`cover letter ${i} hops into the header: its top reaches y ${top}, the header ends at y ${Math.ceil(header.y + header.h)}`);
  });
}

// `letters` lists the title tiles from left to right, each { normal, x, y, width, height }.
export function coverSvg({ base, letters, width, height, label }) {
  return svgDocument({ width, height, label, css: motionCss(letters), base, tiles: letterTiles(letters) });
}
