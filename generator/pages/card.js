// Shared setup for the project cards: the sheet, the name strip, the two pieces of tape, the "Made with SPITE" stamp,
// and an SVG filter that turns a screenshot into high-contrast gray before the photocopy.
(() => {
  const $ = (id) => document.getElementById(id);
  const NS = 'http://www.w3.org/2000/svg';

  // Defines an SVG filter named `id`. `table` maps gray in (0..1) to gray out. `morph` ('erode' or 'dilate') with
  // `radius`, and `blur`, fatten thin dark or light strokes so they survive the copier.
  function shotFilter(id, { table, morph, radius = 1, blur = 0 }) {
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('width', '0');
    svg.setAttribute('height', '0');
    svg.style.position = 'absolute';
    const tv = table.join(' ');
    svg.innerHTML = `<filter id="${id}" color-interpolation-filters="sRGB" x="0" y="0" width="100%" height="100%">
      <feColorMatrix type="matrix" values="0.299 0.587 0.114 0 0  0.299 0.587 0.114 0 0  0.299 0.587 0.114 0 0  0 0 0 1 0"/>
      ${blur ? `<feGaussianBlur stdDeviation="${blur}"/>` : ''}
      ${morph ? `<feMorphology operator="${morph}" radius="${radius}"/>` : ''}
      <feComponentTransfer>
        <feFuncR type="table" tableValues="${tv}"/><feFuncG type="table" tableValues="${tv}"/><feFuncB type="table" tableValues="${tv}"/>
      </feComponentTransfer>
    </filter>`;
    document.body.appendChild(svg);
  }

  // Places a source image so that the crop box (sx, sy, sw) of the full image fills `box` across its width.
  function crop(img, { sx, sy, sw, fullWidth, boxWidth, left = 0, top = 0 }) {
    const k = boxWidth / sw;
    img.style.width = `${fullWidth * k}px`;
    img.style.left = `${left - sx * k}px`;
    img.style.top = `${top - sy * k}px`;
    return k;
  }

  // Adds the `open repo` label and arrow to the bottom of the text column.
  function addOpenRepo() {
    document.querySelector('.side').insertAdjacentHTML('beforeend',
      `<div id="open"><span>open repo</span><svg width="62" height="62" viewBox="0 0 130 130" fill="none" stroke="#000" stroke-width="14" stroke-linecap="round" stroke-linejoin="round"><path d="M10 112 C 30 70, 70 40, 108 22"/><path d="M62 14 L 112 18 L 104 66"/></svg></div>`);
  }

  // Presses the "Made with SPITE" rubber stamp on the sheet. `rot` is the turn in degrees, `right` and `bottom` place it
  // against the sheet's lower right corner, and `seed` picks the pattern of worn ink.
  function addStamp({ rot, right, bottom, seed }) {
    const el = document.createElement('div');
    el.id = 'made';
    el.className = 'stamp';
    el.style.cssText = `right:${right}px;bottom:${bottom}px;transform:rotate(${rot}deg)`;
    el.innerHTML = '<span>MADE WITH</span><b>SPITE</b>';
    $('sheet').appendChild(el);
    // The worn ink stays on the rule and the empty paper; the letters stay whole.
    const keepOut = [...el.children].map((c) => ({ x: c.offsetLeft + el.clientLeft, y: c.offsetTop + el.clientTop, w: c.offsetWidth, h: c.offsetHeight }));
    zine.wear(el, { seed, patches: 40, scratches: 0, size: 2.5, keepOut });
  }

  // Shrinks the name until it fits the text column, so a long project name never spills out.
  function fitName() {
    const name = $('name');
    const room = document.querySelector('.side').clientWidth;
    let size = 60;
    while (name.offsetWidth > room && size > 48) name.style.fontSize = `${--size}px`;
  }

  async function start({ seed, tilt, shotTilt, stamp, setup }) {
    if (tilt !== undefined) $('sheet').style.setProperty('--tilt', `${tilt}deg`);
    if (shotTilt !== undefined) document.querySelector('.shot').style.setProperty('--shot-tilt', `${shotTilt}deg`);
    addOpenRepo();
    await Promise.all([...document.images].map((img) => img.decode()));
    await zine.ready(['Anton', 'Special Elite', 'Permanent Marker'], () => {
      zine.paper($('sheet'), { seed, sides: { top: 'cut', right: 'cut', bottom: 'torn', left: 'cut' } });
      fitName();
      zine.paper($('name'), { seed: seed + 1, fill: '#000', rim: '#000', sides: { left: 'torn', right: 'torn', top: 'cut', bottom: 'cut' } });
      zine.tape($('tapeA'), { seed: seed + 2 });
      zine.tape($('tapeB'), { seed: seed + 3 });
      if (setup) setup();
      addStamp({ seed: seed + 4, ...stamp });
    });
  }

  window.card = { shotFilter, crop, start };
})();
