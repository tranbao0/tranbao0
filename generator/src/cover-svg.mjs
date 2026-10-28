// Animated cover: a base photocopy, a transparent title layer that flickers,
// and a soft light band that sweeps down the page like a copier lamp.

const CYCLE = 5; // seconds per sweep and pause

const css = `
  .sweep { animation: sweep ${CYCLE}s ease-in-out infinite; }
  .flicker { animation: flicker ${CYCLE}s step-end infinite; }
  @keyframes sweep {
    0% { transform: translateY(0); }
    52% { transform: translateY(1290px); }
    100% { transform: translateY(1290px); }
  }
  @keyframes flicker {
    0%, 100% { opacity: 1; transform: translate(0, 0); }
    21% { opacity: 0.3; transform: translate(3px, -2px); }
    22.6% { opacity: 0.8; transform: translate(-2px, 2px); }
    24% { opacity: 1; transform: translate(0, 0); }
    73% { opacity: 0.45; transform: translate(0, 4px); }
    74.4% { opacity: 1; transform: translate(0, 0); }
  }
  @media (prefers-reduced-motion: reduce) {
    .sweep, .flicker { animation: none; }
  }`;

export function coverSvg({ base, title, width, height, label }) {
  const data = (png) => `data:image/png;base64,${png.toString('base64')}`;
  const band = 290;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${label}">
<style>${css}
</style>
<defs>
  <linearGradient id="lamp" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#fff" stop-opacity="0"/>
    <stop offset="0.55" stop-color="#fff" stop-opacity="0.2"/>
    <stop offset="0.86" stop-color="#fff" stop-opacity="0.45"/>
    <stop offset="1" stop-color="#fff" stop-opacity="0"/>
  </linearGradient>
  <clipPath id="sheet"><rect x="56" y="56" width="1488" height="888"/></clipPath>
</defs>
<rect width="${width}" height="${height}" fill="#000"/>
<image width="${width}" height="${height}" href="${data(base)}"/>
<g class="flicker"><image width="${width}" height="${height}" href="${data(title)}"/></g>
<g clip-path="url(#sheet)"><rect class="sweep" x="0" y="${-band}" width="${width}" height="${band}" fill="url(#lamp)"/></g>
</svg>
`;
}
