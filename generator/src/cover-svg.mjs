// Animated cover: a base photocopy and one cut-out per title letter, each with an inverted twin.
// Everything moves in stop-motion steps (no easing, no fades), like a title cut from magazine letters.
//
// Timeline, in seconds:
//   LEAD                    bare paper
//   entrance (3 steps)      one letter alone at the middle, a small cluster, every letter bunched, then all in place
//   HOLD                    nothing moves
//   first wave              one letter at a time flips to its inverted twin for one step;
//                           letter 2k also hops up for the step in which letter k flips
//   REST                    nothing moves
//   later waves             the flips only, forever, with the same rest between them

// The helpers marked "shared" also build the PROJECTS strip (projects-svg.mjs).
export const STEP = 5 / 60; // one stop-motion step: 5 frames at 60 fps
const LEAD = 0.4;
const HOLD = 20 / 60;
export const REST = 3;
export const HOP = 70; // px a hopping letter rises

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

// Shared. Keyframes for a wave in which item i is "on" for one STEP and "off" for the rest of the period.
export function waveKeyframes(name, i, period, on, off) {
  const start = pct((i * STEP) / period);
  const end = pct(((i + 1) * STEP) / period);
  return `@keyframes ${name} { ${i === 0 ? '' : `0% { ${off} } `}${start} { ${on} } ${end} { ${off} } 100% { ${off} } }`;
}

// Shared. Switches every animation off for readers who ask for less motion.
export const REDUCED_MOTION_CSS = `
  @media (prefers-reduced-motion: reduce) {
    * { animation: none !important; }
  }`;

const dataUri = (png) => `data:image/png;base64,${png.toString('base64')}`;

// Shared. One group per letter: an outer group for entrance moves, an inner one for the hop, then the clipping and its inverted twin if it has one.
// The two PNGs of a letter have the same size and place, so a flip never shifts the letter.
export function letterTiles(letters) {
  return letters
    .map((l, i) => {
      const image = (png, cls = '') => `<image ${cls}x="${l.x}" y="${l.y}" width="${l.width}" height="${l.height}" href="${dataUri(png)}"/>`;
      return `<g id="l${i}" class="letter"><g class="hop">\n  ${image(l.normal)}${l.inverted ? `\n  ${image(l.inverted, 'class="twin" ')}` : ''}\n</g></g>`;
    })
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

function motionCss(letters) {
  const count = letters.length;
  const entrance = entranceSteps(count);
  const total = LEAD + entrance.length * STEP;
  const waveStart = total + HOLD;
  const period = count * STEP + REST;
  // The piled letters gather at the middle of the word, from its left edge to its right edge.
  const left = Math.min(...letters.map((l) => l.x));
  const right = Math.max(...letters.map((l) => l.x + l.width));
  const middle = (left + right) / 2;
  let css = '';

  letters.forEach((l, i) => {
    const centre = l.x + l.width / 2;
    // Keyframe 0 is the bare paper; each entrance step starts after the lead and lasts one STEP.
    const frames = [`0% { opacity: 0; transform: translate(0, 0); }`];
    entrance.forEach((s, k) => {
      const dx = (middle - centre) * (1 - s.travelled) + (s.nudge?.[i] ?? 0);
      frames.push(`${pct((LEAD + k * STEP) / total)} { opacity: ${s.shown.includes(i) ? 1 : 0}; transform: translate(${dx.toFixed(1)}px, 0); }`);
    });
    frames.push(`100% { opacity: 1; transform: translate(0, 0); }`);
    css += `
  @keyframes enter-${i} { ${frames.join(' ')} }
  #l${i} { animation: enter-${i} ${sec(total)} step-end forwards; }`;

    // The flip: the inverted twin shows for letter i's step of every wave.
    css += `
  ${waveKeyframes(`flip-${i}`, i, period, 'opacity: 1;', 'opacity: 0;')}
  #l${i} .twin { opacity: 0; animation: flip-${i} ${sec(period)} step-end ${sec(waveStart)} infinite; }`;

    // The hop: once, in the first wave, for the step in which letter i / 2 flips.
    if (i > 0 && i % 2 === 0 && i / 2 < count) {
      css += `
  @keyframes hop-${i} { 0% { transform: translateY(${-HOP}px); } 100% { transform: translateY(0); } }
  #l${i} .hop { animation: hop-${i} ${sec(STEP)} step-end ${sec(waveStart + (i / 2) * STEP)}; }`;
    }
  });

  return css + REDUCED_MOTION_CSS;
}

// `letters` lists the title tiles from left to right, each { normal, inverted, x, y, width, height }.
// The two PNGs of a tile have the same size and place, so a flip never shifts the letter.
export function coverSvg({ base, letters, width, height, label }) {
  return svgDocument({ width, height, label, css: motionCss(letters), base, tiles: letterTiles(letters) });
}
