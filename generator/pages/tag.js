// Builds a link tag: torn paper with clipped top corners, a reinforced string hole, a short string that ends under a strip of tape, and a hand-drawn arrow.
function buildTag({ seed }) {
  const $ = (id) => document.getElementById(id);
  const wrap = $('wrap');
  const w = wrap.offsetWidth;
  const h = wrap.offsetHeight;
  const hx = w / 2;
  const hy = 40;
  const cut = 70;
  $('paper').style.clipPath = `polygon(${cut}px 0, ${w - cut}px 0, 100% ${cut}px, 100% 100%, 0 100%, 0 ${cut}px)`;
  zine.tape($('tape'), { seed: seed + 5, fill: 'rgba(214,214,214,0.82)' });
  zine.paper($('paper'), { seed, sides: { top: 'cut', right: 'cut', bottom: 'torn', left: 'cut' } });
  const reach = 66;
  const strand = (dx) => `M${hx} ${hy} C ${hx + dx * 0.25} ${hy - reach * 0.35}, ${hx + dx * 0.7} ${hy - reach * 0.6}, ${hx + dx} ${hy - reach}`;
  $('string').innerHTML =
    `<g fill="none" stroke-linecap="round">` +
    `<path d="${strand(-30)}" stroke="#fff" stroke-width="10"/><path d="${strand(-30)}" stroke="#555" stroke-width="10" stroke-dasharray="3 11"/>` +
    `<path d="${strand(30)}" stroke="#fff" stroke-width="10"/><path d="${strand(30)}" stroke="#555" stroke-width="10" stroke-dasharray="3 11"/>` +
    `</g>` +
    `<circle cx="${hx}" cy="${hy}" r="34" fill="#a0a0a0"/><circle cx="${hx}" cy="${hy}" r="19" fill="#000"/>` +
    `<path d="M${hx - 6} ${hy - 28} C ${hx + 24} ${hy - 20}, ${hx + 20} ${hy + 28}, ${hx - 4} ${hy + 25}" fill="none" stroke="#fff" stroke-width="10" stroke-linecap="round"/>`;
}
