// The animated cover: its words, its entrance and its motion settings.
// The motion itself (stop-motion steps, waves, the fan out played backward, reduced motion) comes from the ransom title of
// printshop's zine pack. This file only says what the cover does with it.
//
// One cycle, in seconds:
//   LEAD                    bare paper
//   fan out (3 steps)       one letter alone near the middle, a small cluster, every letter bunched, then all in place
//   HOLD                    nothing moves
//   jump wave               in step k letter k hops up and back down, from the first letter to the last
//   REST                    nothing moves
//   jump wave               the same again
//   REST                    nothing moves
//   fan in (3 steps)        the fan out played backward: every letter bunched, the small cluster, one letter alone, bare paper
//   then the cycle starts again with the lead
import { assertHopsClearOf as assertBoxesClear, ransomSvg, ransomTimeline } from '@tranbao0/printshop/packs/zine';

export const HOP = 95; // px a hopping letter rises

// The title, letter by letter, from the left.
const TITLE = ['W', 'e', 'c', 'o', 'd', 'e'];
// The W sits right under the header label and hops over it on purpose, so the header check skips it.
const HOPS_OVER_HEADER = 'W';

// The entrance: for each step, which letters show and how far they have travelled from the pile at the middle of the word
// (0 = piled, 1 = in place). Letters count from 0 at the left. The cluster and the last bunched step also nudge single
// letters sideways (px, by letter number) so that none hides behind a neighbour.
const ENTRANCE = [
  { shown: [4], travelled: 0.12 },
  { shown: [0, 1, 4], travelled: 0.29, nudge: { 0: -110 } },
  { shown: 'all', travelled: 0.67, nudge: { 0: -20, 1: -20, 2: -25, 3: -35, 4: 40, 5: 40 } },
];

// Every other setting of the cycle is the default of the pack: a 5 frame step, a 0.4 s lead, a 7.5 frame fan step,
// a 20 frame hold, two waves and a 3 s rest. Letters do not flip, and every letter hops in its own step.
export const coverMotion = { entrance: ENTRANCE, hop: HOP, flip: false, hopFollowsFlip: false };

// Throws when a hopping letter, at the top of its hop, would touch the header box. The W is exempt.
export function assertHopsClearOf(header, letters, margin = 4) {
  if (!header || !(header.w > 0 && header.h > 0)) throw new Error('cover: the header box is missing or empty, so the hops cannot be checked');
  const kept = letters.map((_, i) => i).filter((i) => TITLE[i] !== HOPS_OVER_HEADER);
  try {
    assertBoxesClear({ header }, kept.map((i) => letters[i]), coverMotion, margin);
  } catch (error) {
    throw new Error(error.message.replace(/^letter (\d+)/, (_, k) => `cover letter ${kept[k]}`), { cause: error });
  }
}

// `letters` lists the title tiles from left to right, each { normal, x, y, width, height }.
export function coverSvg({ base, letters, width, height, label }) {
  // The pack cuts a hop to the free space above the letters. The cover wants the full hop, so a tile that sits too high stops the build.
  const { hop } = ransomTimeline(letters, coverMotion);
  if (hop !== HOP) throw new Error(`cover: the hop would be cut from ${HOP} px to ${hop} px, because a letter sits too near the top of the image`);
  return ransomSvg({ base, letters, width, height, label, motion: coverMotion });
}
