// Animated PROJECTS strip: a base photocopy (label, slip, tape) and one cut-out per letter.
// The letters only hop: from left to right, each rises and drops back in one stop-motion step, then the strip rests.
// The per-letter machinery (tiles, wave keyframes, stop-motion step, reduced motion) is shared with the cover.
import { STEP, REST, sec, waveKeyframes, REDUCED_MOTION_CSS, letterTiles, svgDocument } from './cover-svg.mjs';

export const PROJECTS_LETTERS = 8;

const LEAD = 0.4; // bare strip before the first wave
const REFERENCE_HOP = 70; // px, the hop measured from the reference video, at the size of the cover title
const TITLE_LOWERCASE_INK = 180; // px, height of the lowercase glyphs of the cover title (185 * the 0.972 title scale)
const STRIP_LETTER_INK = 94; // px, mean glyph height of the PROJECTS letters
const TONE_DOWN = 2 / 3; // the strip hops two thirds as high, relative to its letters, as the reference does
const MARGIN = 1; // px of strip kept above the highest hopping letter

// The hop in px: the reference hop scaled to the strip's letters and toned down, but never more than the free
// space above the highest letter, so a hopping letter stays fully inside the strip.
export function projectsHop(letters) {
  const wanted = Math.round(TONE_DOWN * (REFERENCE_HOP / TITLE_LOWERCASE_INK) * STRIP_LETTER_INK);
  const free = Math.floor(Math.min(...letters.map((l) => l.y))) - MARGIN;
  return Math.max(0, Math.min(wanted, free));
}

function motionCss(letters) {
  const period = letters.length * STEP + REST;
  const hop = projectsHop(letters);
  const css = letters
    .map((_, i) => `
  ${waveKeyframes(`hop-${i}`, i, period, `transform: translateY(${-hop}px);`, 'transform: translateY(0);')}
  #l${i} .hop { animation: hop-${i} ${sec(period)} step-end ${sec(LEAD)} infinite; }`)
    .join('');
  return css + REDUCED_MOTION_CSS;
}

// `letters` lists the PROJECTS tiles from left to right, each { normal, x, y, width, height }.
export function projectsSvg({ base, letters, width, height, label }) {
  return svgDocument({ width, height, label, css: motionCss(letters), base, tiles: letterTiles(letters) });
}
