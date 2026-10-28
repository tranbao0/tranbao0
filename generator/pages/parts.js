// Shared zine parts, drawn in the page: torn and cut paper, tape, cut-out letter tiles,
// worn ink masks and burnt paper. Everything uses a seeded random generator.
(() => {
  const layer = new URLSearchParams(location.search).get('layer') || 'all';
  document.documentElement.classList.add(`layer-${layer}`);
  document.body.classList.add(`layer-${layer}`);

  const rng = (seed) => {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  const smooth = (f) => f * f * (3 - 2 * f);

  // 1D smooth noise. `parts` is a list of [cell, amplitude]; the result swings by +/- the sum of amplitudes.
  const wave = (rand, length, parts) => {
    const tables = parts.map(([cell, amp]) => ({
      cell,
      amp,
      values: Array.from({ length: Math.ceil(length / cell) + 3 }, rand),
    }));
    return (t) =>
      tables.reduce((sum, { cell, amp, values }) => {
        const x = t / cell;
        const i = Math.floor(x);
        const u = smooth(x - i);
        return sum + amp * 2 * (values[i] * (1 - u) + values[i + 1] * u - 0.5);
      }, 0);
  };

  const pts = (list) => list.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');

  const EDGE = {
    // amp: size of the tear, rim: width of the pale fibre rim along the tear
    torn: { parts: [[90, 5], [26, 3.5], [7, 2.2]], base: 10.7, rim: [4, 4.5], step: [5, 11] },
    cut: { parts: [[260, 1.6], [50, 0.5]], base: 2.1, rim: [0, 0], step: [60, 90] },
    clean: { parts: [], base: 0, rim: [0, 0], step: [200, 400] },
  };

  // Outline of a piece of paper. Returns the outer outline and the inner one (outer minus the fibre rim).
  function outline(w, h, sides, rand) {
    const outer = [];
    const inner = [];
    const runs = [
      { kind: sides.top, len: w, at: (t, o) => [t, o] },
      { kind: sides.right, len: h, at: (t, o) => [w - o, t] },
      { kind: sides.bottom, len: w, at: (t, o) => [w - t, h - o] },
      { kind: sides.left, len: h, at: (t, o) => [o, h - t] },
    ];
    for (const { kind, len, at } of runs) {
      const spec = EDGE[kind];
      const edge = wave(rand, len, spec.parts);
      const rim = wave(rand, len, [[30, spec.rim[1]], [8, spec.rim[1] * 0.4]]);
      let t = 0;
      while (t < len) {
        const off = Math.max(0, spec.base + edge(t));
        outer.push(at(t, off));
        inner.push(at(t, off + (spec.rim[0] ? Math.max(1.5, spec.rim[0] + rim(t)) : 0)));
        t += spec.step[0] + rand() * (spec.step[1] - spec.step[0]);
      }
    }
    return { outer, inner };
  }

  function addShape(el, svg) {
    el.insertAdjacentHTML('afterbegin', `<svg class="shape" width="${el.offsetWidth}" height="${el.offsetHeight}">${svg}</svg>`);
  }

  // Paper piece: each side is 'torn', 'cut' or 'clean'.
  function paper(el, { seed = 1, sides = {}, fill = '#fff', rim = '#8f8f8f', shadow = null } = {}) {
    el.classList.add('part');
    const rand = rng(seed);
    const s = { top: 'cut', right: 'cut', bottom: 'cut', left: 'cut', ...sides };
    const { outer, inner } = outline(el.offsetWidth, el.offsetHeight, s, rand);
    let svg = '';
    if (shadow) svg += `<polygon points="${pts(outer)}" fill="${shadow.fill}" transform="translate(${shadow.x} ${shadow.y})"/>`;
    svg += `<polygon points="${pts(outer)}" fill="${rim}"/><polygon points="${pts(inner)}" fill="${fill}"/>`;
    addShape(el, svg);
  }

  // Strip of tape: light gray, slightly see-through, with rough zigzag ends.
  function tape(el, { seed = 1, fill = 'rgba(214,214,214,0.7)' } = {}) {
    el.classList.add('part');
    const rand = rng(seed);
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const topWave = wave(rand, w, [[150, 1.6]]);
    const bottomWave = wave(rand, w, [[150, 1.6]]);
    const end = (x0, dir) => {
      const list = [];
      for (let y = 0; y <= h; y += 6 + rand() * 6) list.push([x0 + dir * (3 + rand() * 12), Math.min(y, h)]);
      return list;
    };
    const left = end(0, 1).reverse();
    const right = end(w, -1);
    const top = [];
    for (let x = 0; x <= w; x += 40) top.push([x, 1.5 + topWave(x)]);
    const bottom = [];
    for (let x = w; x >= 0; x -= 40) bottom.push([x, h - 1.5 + bottomWave(x)]);
    addShape(el, `<polygon points="${pts([...top, ...right, ...bottom, ...left])}" fill="${fill}"/>`);
  }

  // Track label strip: a paler, denser tape than loose tape, so the typewriter letters stay solid on the halftone.
  function track(el, { seed = 1 } = {}) {
    tape(el, { seed, fill: 'rgba(222,222,222,0.84)' });
  }

  // Ink that wears off in small patches and scratches, used as a CSS mask.
  function wear(el, { seed = 1, patches = 70, scratches = 8, size = 5 } = {}) {
    const rand = rng(seed);
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < patches; i++) {
      const x = rand() * w;
      const y = rand() * h;
      const r = 1 + Math.pow(rand(), 2) * size * 2;
      ctx.beginPath();
      for (let k = 0; k < 7; k++) {
        const a = (k / 7) * Math.PI * 2;
        const rr = r * (0.55 + rand() * 0.9);
        ctx[k ? 'lineTo' : 'moveTo'](x + Math.cos(a) * rr, y + Math.sin(a) * rr);
      }
      ctx.fill();
    }
    ctx.lineWidth = 1.6;
    ctx.strokeStyle = '#000';
    for (let i = 0; i < scratches; i++) {
      ctx.beginPath();
      const x = rand() * w;
      const y = rand() * h;
      ctx.moveTo(x, y);
      ctx.lineTo(x + (rand() - 0.5) * 120, y + (rand() - 0.5) * 30);
      ctx.stroke();
    }
    const url = `url(${canvas.toDataURL()})`;
    el.style.webkitMaskImage = url;
    el.style.maskImage = url;
  }

  // Measures the ink of one string, so tiles can fit tightly around the letters.
  const ruler = document.createElement('canvas').getContext('2d');
  function ink(text, font, weight, targetHeight) {
    ruler.font = `${weight} 100px "${font}"`;
    const probe = ruler.measureText(text);
    const size = (targetHeight / (probe.actualBoundingBoxAscent + probe.actualBoundingBoxDescent)) * 100;
    ruler.font = `${weight} ${size}px "${font}"`;
    const m = ruler.measureText(text);
    return {
      size,
      left: m.actualBoundingBoxLeft,
      ascent: m.actualBoundingBoxAscent,
      width: m.actualBoundingBoxLeft + m.actualBoundingBoxRight,
      height: m.actualBoundingBoxAscent + m.actualBoundingBoxDescent,
    };
  }

  // A cut-out tile with one glyph, like a ransom note. `heightInk` is the height of the glyph itself.
  function tile(parent, { text, font, heightInk, padX = 26, padY = 24, x, y, rot = 0, fill = '#fff', color = '#000', seed = 1, shadow = true, sides }) {
    const m = ink(text, font, 400, heightInk);
    const el = document.createElement('div');
    el.className = 'tile';
    el.style.cssText = `position:absolute;left:${x}px;top:${y}px;width:${Math.ceil(m.width + padX * 2)}px;height:${Math.ceil(m.height + padY * 2)}px;transform:rotate(${rot}deg)`;
    parent.appendChild(el);
    paper(el, {
      seed,
      sides: sides || { top: 'cut', right: 'cut', bottom: 'cut', left: 'cut' },
      fill,
      rim: fill === '#fff' ? '#8f8f8f' : fill,
      shadow: shadow ? { fill: '#555', x: 7, y: 8 } : null,
    });
    el.querySelector('svg.shape').insertAdjacentHTML(
      'beforeend',
      `<text x="${padX + m.left}" y="${padY + m.ascent}" font-family="${font}" font-size="${m.size}" fill="${color}">${text}</text>`,
    );
    return el;
  }

  // Burnt sheet: charred edge that eats into the paper, then a gray halftone singe zone, then clean paper.
  function burn(el, { seed = 1, depth = 120, singe = 110, reach = 100 } = {}) {
    const rand = rng(seed);
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const field = (cell) => {
      const gw = Math.ceil(w / cell) + 2;
      const gh = Math.ceil(h / cell) + 2;
      const grid = Float32Array.from({ length: gw * gh }, rand);
      return (x, y) => {
        const fx = x / cell;
        const fy = y / cell;
        const ix = Math.floor(fx);
        const iy = Math.floor(fy);
        const tx = smooth(fx - ix);
        const ty = smooth(fy - iy);
        const i = iy * gw + ix;
        return (grid[i] * (1 - tx) + grid[i + 1] * tx) * (1 - ty) + (grid[i + gw] * (1 - tx) + grid[i + gw + 1] * tx) * ty;
      };
    };
    const big = field(210);
    const mid = field(75);
    const small = field(26);
    const fine = field(9);
    const grit = field(3);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    const image = ctx.createImageData(w, h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const wx = x + 46 * (mid(x, y) - 0.5);
        const wy = y + 46 * (small(x, h - 1 - y) - 0.5);
        const d = Math.min(wx, w - 1 - wx, wy, h - 1 - wy);
        const m = 0.42 * big(x, y) + 0.3 * mid(x, y) + 0.18 * small(x, y) + 0.1 * fine(x, y);
        const bite = Math.max(0, (m - 0.36) / 0.4);
        const raw = 22 + depth * Math.pow(bite, 1.5) + 20 * (grit(x, y) - 0.5) + 22 * (fine(x, y) - 0.5);
        const eaten = reach * Math.tanh(Math.max(raw, 0) / reach);
        const s = d - eaten;
        let tone = 255;
        if (s < 0) tone = 0;
        else {
          const width = singe * (0.45 + 0.9 * mid(x, y));
          const t = Math.max(0, 1 - s / width);
          const dark = Math.pow(t, 1.35) * 0.95 + (grit(x, y) - 0.5) * 0.35 * t;
          tone = 255 * (1 - Math.max(0, Math.min(1, dark)));
        }
        const i = (y * w + x) * 4;
        image.data[i] = image.data[i + 1] = image.data[i + 2] = tone;
        image.data[i + 3] = 255;
      }
    }
    ctx.putImageData(image, 0, 0);
    el.style.backgroundImage = `url(${canvas.toDataURL()})`;
    el.style.backgroundSize = '100% 100%';
  }

  // Waits for fonts, runs the page's own setup, then tells the renderer the page is ready.
  async function ready(families, setup) {
    await Promise.all(families.map((f) => document.fonts.load(`100px "${f}"`, 'Wecodw@MEMBR0123')));
    await document.fonts.ready;
    setup();
    document.body.dataset.ready = '1';
  }

  window.zine = { rng, ink, paper, tape, track, tile, wear, burn, ready };
})();
