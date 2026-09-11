/* Tiny SVG + data helpers shared by every visual on the site. */
const V = (() => {
  const NS = 'http://www.w3.org/2000/svg';

  function el(tag, attrs, parent) {
    const n = document.createElementNS(NS, tag);
    if (attrs) for (const k in attrs) if (attrs[k] != null) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }
  function text(parent, x, y, str, attrs = {}) {
    const t = el('text', { x, y, ...attrs }, parent);
    t.textContent = str;
    return t;
  }
  function svg(host, W, H, label) {
    const h = typeof host === 'string' ? document.querySelector(host) : host;
    const s = el('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart', role: 'img', 'aria-label': label || '' });
    h.appendChild(s);
    return s;
  }
  function clear(n) { while (n.firstChild) n.removeChild(n.firstChild); return n; }
  const $ = (sel) => document.querySelector(sel);

  // Phone layout, decided once at load: charts use a narrower drawing so their text stays readable.
  const phone = matchMedia('(max-width: 600px)').matches;
  const pick = (desktop, small) => (phone ? small : desktop);

  // Linear scale with an inverse.
  function scale(d0, d1, r0, r1) {
    const k = (r1 - r0) / (d1 - d0);
    const f = (v) => r0 + (v - d0) * k;
    f.inv = (p) => d0 + (p - r0) / k;
    return f;
  }

  function niceTicks(a, b, n = 5) {
    const span = b - a;
    if (span <= 0) return [a];
    const raw = span / n;
    const mag = 10 ** Math.floor(Math.log10(raw));
    const e = raw / mag;
    const step = (e >= 7.5 ? 10 : e >= 3.5 ? 5 : e >= 1.5 ? 2 : 1) * mag;
    const out = [];
    for (let v = Math.ceil(a / step - 1e-9) * step; v <= b + 1e-9; v += step) out.push(+v.toFixed(10));
    return out;
  }

  // A plotting frame: margins + scales in one object.
  function frame({ W, H, m = { t: 14, r: 14, b: 34, l: 42 }, x, y }) {
    const iw = W - m.l - m.r;
    const ih = H - m.t - m.b;
    return {
      W, H, m, iw, ih, x, y,
      left: m.l, right: m.l + iw, top: m.t, bottom: m.t + ih,
      sx: scale(x[0], x[1], m.l, m.l + iw),
      sy: scale(y[0], y[1], m.t + ih, m.t),
    };
  }

  function axes(parent, f, o = {}) {
    const {
      xTicks = 5, yTicks = 4, fmtX = (v) => String(v), fmtY = (v) => String(v),
      xLabel, yLabel, grid = true, noX = false, noY = false, xVals, yVals,
    } = o;
    const g = el('g', {}, parent);
    const gg = el('g', { class: 'grid' }, g);
    const ax = el('g', { class: 'axis' }, g);
    if (!noY) {
      (yVals || niceTicks(f.y[0], f.y[1], yTicks)).forEach((v) => {
        const y = f.sy(v);
        if (grid) el('line', { x1: f.left, x2: f.right, y1: y, y2: y }, gg);
        text(ax, f.left - 8, y + 3.5, fmtY(v), { 'text-anchor': 'end' });
      });
    }
    if (!noX) {
      el('line', { x1: f.left, x2: f.right, y1: f.bottom, y2: f.bottom }, ax);
      (xVals || niceTicks(f.x[0], f.x[1], xTicks)).forEach((v) => {
        const x = f.sx(v);
        el('line', { x1: x, x2: x, y1: f.bottom, y2: f.bottom + 4 }, ax);
        text(ax, x, f.bottom + 16, fmtX(v), { 'text-anchor': 'middle' });
      });
    }
    if (xLabel) text(ax, f.right, f.bottom + 30, xLabel, { 'text-anchor': 'end', class: 'axis-title' });
    if (yLabel) text(ax, f.left - 8, f.top - 6, yLabel, { 'text-anchor': 'start', class: 'axis-title' });
    return g;
  }

  const line = (pts) => pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ',' + p[1].toFixed(1)).join('');

  // Seeded random numbers so every visitor sees the same data.
  function rng(seed = 1) {
    let a = seed >>> 0;
    const r = () => {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    r.normal = () => {
      let u = 0;
      while (!u) u = r();
      return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r());
    };
    r.int = (n) => Math.floor(r() * n);
    r.shuffle = (arr) => {
      const a2 = arr.slice();
      for (let i = a2.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a2[i], a2[j]] = [a2[j], a2[i]]; }
      return a2;
    };
    return r;
  }

  // ---------- Datasets ----------
  // Wavy 1-D regression data: y = wave(x) + noise. x in [0, 10].
  const waveFn = (x) => 1.6 * Math.sin(x * 0.9) + 0.9 * Math.sin(x * 2.3 + 1) + 0.12 * x - 0.4;
  function wave(n = 60, seed = 3, noise = 0.35) {
    const r = rng(seed);
    const x = Array.from({ length: n }, () => r() * 10).sort((a, b) => a - b);
    const y = x.map((v) => waveFn(v) + noise * r.normal());
    return { x, y, fn: waveFn };
  }

  // Two interleaving half moons, labels +1 / -1, coords roughly in [0,1].
  function moons(n = 120, noise = 0.12, seed = 5) {
    const r = rng(seed);
    const X = [], y = [];
    for (let i = 0; i < n; i++) {
      const top = i % 2 === 0;
      const t = r() * Math.PI;
      let px = top ? Math.cos(t) : 1 - Math.cos(t);
      let py = top ? Math.sin(t) : 0.5 - Math.sin(t);
      px += noise * r.normal(); py += noise * r.normal();
      X.push([(px + 1.3) / 3.6, (py + 0.9) / 2.3]);
      y.push(top ? 1 : -1);
    }
    return { X, y };
  }

  // A blob of class +1 inside, class -1 around it.
  function ring(n = 120, seed = 11) {
    const r = rng(seed);
    const X = [], y = [];
    for (let i = 0; i < n; i++) {
      const px = 0.05 + r() * 0.9, py = 0.05 + r() * 0.9;
      const d = Math.hypot(px - 0.5, (py - 0.5) * 1.1);
      const inside = d < 0.28 + 0.05 * r.normal();
      X.push([px, py]); y.push(inside ? 1 : -1);
    }
    return { X, y };
  }

  // Two gaussian blobs.
  function blobs(n = 80, seed = 2, spread = 0.13) {
    const r = rng(seed);
    const X = [], y = [];
    for (let i = 0; i < n; i++) {
      const pos = i % 2 === 0;
      const cx = pos ? 0.36 : 0.64, cy = pos ? 0.62 : 0.4;
      X.push([Math.min(0.98, Math.max(0.02, cx + spread * r.normal())), Math.min(0.98, Math.max(0.02, cy + spread * r.normal()))]);
      y.push(pos ? 1 : -1);
    }
    return { X, y };
  }

  // Read a hex colour token from CSS (e.g. '--c1') as [r, g, b].
  const rgbCache = {};
  function cssRgb(name) {
    if (rgbCache[name]) return rgbCache[name];
    const h = getComputedStyle(document.documentElement).getPropertyValue(name).trim().replace('#', '');
    const rgb = h.length === 3 ? [...h].map((c) => parseInt(c + c, 16)) : [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
    rgbCache[name] = rgb;
    return rgb;
  }

  // ---------- Decision regions: shade the plane by a score in [-1, 1] ----------
  // Painted on a small canvas and stretched, so the shading is smooth (no grid seams).
  function regions(parent, f, scoreFn, { cols = 120, rows = 90, strength = 0.26, pos = '--c1', neg = '--c2' } = {}) {
    const cv = document.createElement('canvas');
    cv.width = cols; cv.height = rows;
    const ctx = cv.getContext('2d');
    const img = ctx.createImageData(cols, rows);
    const P = cssRgb(pos), N = cssRgb(neg);
    for (let j = 0; j < rows; j++) {
      const y = f.y[1] - ((j + 0.5) / rows) * (f.y[1] - f.y[0]);
      for (let i = 0; i < cols; i++) {
        const x = f.x[0] + ((i + 0.5) / cols) * (f.x[1] - f.x[0]);
        const s = scoreFn(x, y);
        const c = s >= 0 ? P : N;
        const k = 4 * (j * cols + i);
        img.data[k] = c[0]; img.data[k + 1] = c[1]; img.data[k + 2] = c[2];
        img.data[k + 3] = Math.round((0.04 + strength * Math.min(1, Math.abs(s))) * 255);
      }
    }
    ctx.putImageData(img, 0, 0);
    return el('image', {
      href: cv.toDataURL(), x: f.left, y: f.top, width: f.iw, height: f.ih, preserveAspectRatio: 'none',
    }, parent);
  }

  // ---------- Tooltip ----------
  let tipEl = null;
  function tip(html, evt) {
    if (!tipEl) { tipEl = document.createElement('div'); tipEl.className = 'tip'; document.body.appendChild(tipEl); }
    if (html == null) { tipEl.style.opacity = 0; return; }
    tipEl.innerHTML = html;
    tipEl.style.opacity = 1;
    const r = tipEl.getBoundingClientRect();
    tipEl.style.left = Math.min(evt.clientX + 14, innerWidth - r.width - 8) + 'px';
    tipEl.style.top = Math.min(evt.clientY + 14, innerHeight - r.height - 8) + 'px';
  }

  // ---------- Controls ----------
  function slider(id, onInput, fmt = (v) => v) {
    const inp = document.getElementById(id);
    const out = document.querySelector(`output[for="${id}"]`);
    const read = () => Number(inp.value);
    const upd = () => { if (out) out.textContent = fmt(read()); if (onInput) onInput(read()); };
    inp.addEventListener('input', upd);
    if (out) out.textContent = fmt(read());
    return { get value() { return read(); }, set(v) { inp.value = v; upd(); }, el: inp };
  }

  // Segmented control: <div class="seg" id=".."><button data-v="a">..</button></div>
  function seg(id, onChange) {
    const host = document.getElementById(id);
    const btns = [...host.querySelectorAll('button')];
    let val = (btns.find((b) => b.classList.contains('on')) || btns[0]).dataset.v;
    const set = (v) => {
      val = v;
      btns.forEach((b) => b.classList.toggle('on', b.dataset.v === v));
      if (onChange) onChange(v);
    };
    btns.forEach((b) => b.addEventListener('click', () => set(b.dataset.v)));
    btns.forEach((b) => b.classList.toggle('on', b.dataset.v === val));
    return { get value() { return val; }, set };
  }

  // Step / Play / Reset wiring. Buttons live inside `host` with data-act attributes.
  function player({ host, step, reset, canStep = () => true, speed = 700 }) {
    const h = typeof host === 'string' ? document.querySelector(host) : host;
    let timer = null;
    const playBtn = h.querySelector('[data-act="play"]');
    const stop = () => { clearInterval(timer); timer = null; if (playBtn) playBtn.textContent = '▶ Play'; };
    const tick = () => { if (!canStep()) return stop(); step(); if (!canStep()) stop(); };
    h.querySelector('[data-act="step"]')?.addEventListener('click', () => { stop(); if (canStep()) step(); });
    playBtn?.addEventListener('click', () => {
      if (timer) return stop();
      if (!canStep()) reset();
      playBtn.textContent = '❚❚ Pause';
      tick();
      timer = setInterval(tick, speed);
    });
    h.querySelector('[data-act="reset"]')?.addEventListener('click', () => { stop(); reset(); });
    return { stop, get playing() { return !!timer; } };
  }

  // Make an SVG draggable. onMove gets (x or y in SVG units, the full point).
  // Mouse: press and drag anywhere. Finger: a tap jumps there, a sideways swipe drags
  // (so an up/down swipe still scrolls the page), and anything marked data-grip
  // drags in every direction. `axis` can be a function when it changes at runtime.
  function drag(svgEl, handle, onMove, axis = 'x') {
    const pt = svgEl.createSVGPoint();
    const axisNow = () => (typeof axis === 'function' ? axis() : axis);
    const fire = (e) => {
      pt.x = e.clientX; pt.y = e.clientY;
      const q = pt.matrixTransform(svgEl.getScreenCTM().inverse());
      onMove(axisNow() === 'x' ? q.x : q.y, q);
    };
    const onGrip = (e) => !!e.target.closest?.('[data-grip]');
    let mode = null, id = null, x0 = 0, y0 = 0;
    handle.style.touchAction = 'pan-y pinch-zoom';
    handle.addEventListener('touchstart', (e) => { if (onGrip(e)) e.preventDefault(); }, { passive: false });
    handle.addEventListener('pointerdown', (e) => {
      if (e.button > 0) return;
      id = e.pointerId; x0 = e.clientX; y0 = e.clientY;
      if (e.pointerType !== 'touch' || onGrip(e)) { mode = 'drag'; handle.setPointerCapture?.(id); fire(e); }
      else mode = 'wait';            // finger: is it a tap, a sideways drag, or a scroll?
    });
    handle.addEventListener('pointermove', (e) => {
      if (e.pointerId !== id || !mode) return;
      if (mode === 'wait') {
        const dx = Math.abs(e.clientX - x0), dy = Math.abs(e.clientY - y0);
        if (dx < 8 && dy < 8) return;
        if (axisNow() !== 'x' || dx < dy) { mode = null; return; }
        mode = 'drag'; handle.setPointerCapture?.(id);
      }
      fire(e);
    });
    handle.addEventListener('pointerup', (e) => { if (e.pointerId === id && mode === 'wait') fire(e); mode = null; id = null; });
    handle.addEventListener('pointercancel', () => { mode = null; id = null; });
  }

  // ---------- Small tree diagram ----------
  // node = { lines: [bold first line, ...], tone: 'split' | 'a' | 'b', faded, children? }
  // Leaves get equal slots left to right; a parent sits above the middle of its children.
  // horizontal: root on the left, leaves stacked top to bottom (fits a narrow phone screen).
  function tree(svgEl, root, { W, H, boxW, boxH, font = 11.5, horizontal = false }) {
    clear(svgEl);
    let slot = 0, maxD = 0;
    (function walk(n, d) {
      n._d = d; maxD = Math.max(maxD, d);
      if (!n.children) { n._x = slot++; return; }
      n.children.forEach((c) => walk(c, d + 1));
      n._x = (n.children[0]._x + n.children[n.children.length - 1]._x) / 2;
    })(root, 0);
    const across = (x, size, box) => (slot <= 1 ? size / 2 : box / 2 + 4 + (x * (size - box - 8)) / (slot - 1));
    const deep = (d, size, box) => 4 + box / 2 + (maxD ? (d * (size - box - 8)) / maxD : 0);
    const at = (n) => (horizontal
      ? [deep(n._d, W, boxW), across(n._x, H, boxH)]
      : [across(n._x, W, boxW), deep(n._d, H, boxH)]);
    const edges = el('g', {}, svgEl), boxes = el('g', {}, svgEl);
    const TONE = {
      split: ['var(--paper)', 'var(--ink-2)'],
      a: ['var(--c1-wash)', 'var(--c1)'],
      b: ['var(--c2-wash)', 'var(--c2)'],
    };
    (function walk(n) {
      const [cx, cy] = at(n);
      (n.children || []).forEach((c) => {
        const [kx, ky] = at(c);
        const ends = horizontal
          ? { x1: cx + boxW / 2, y1: cy, x2: kx - boxW / 2, y2: ky }
          : { x1: cx, y1: cy + boxH / 2, x2: kx, y2: ky - boxH / 2 };
        el('line', { ...ends, stroke: 'var(--rule-2)', 'stroke-width': 1.5, opacity: c.faded ? 0.3 : 1 }, edges);
        walk(c);
      });
      const g = el('g', { opacity: n.faded ? 0.28 : 1 }, boxes);
      const [fill, stroke] = TONE[n.tone || 'split'];
      el('rect', { x: cx - boxW / 2, y: cy - boxH / 2, width: boxW, height: boxH, rx: Math.min(8, boxH / 3), fill, stroke, 'stroke-width': 1.2 }, g);
      const lh = font + 3.5;
      const top = cy - ((n.lines.length - 1) * lh) / 2 + font * 0.35;
      n.lines.forEach((t, i) => text(g, cx, top + i * lh, t, {
        'text-anchor': 'middle', 'font-size': i === 0 ? font + 0.5 : font,
        'font-weight': i === 0 ? 600 : 400, fill: i === 0 ? 'var(--ink)' : 'var(--ink-2)',
      }));
    })(root);
  }

  const fmt = (v, d = 2) => (Math.abs(v) < 1e-9 ? '0' : Number(v).toFixed(d));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Run fn when the element first scrolls into view (keeps pages snappy).
  function onVisible(elm, fn) {
    if (!('IntersectionObserver' in window)) return fn();
    const io = new IntersectionObserver((ents) => {
      if (ents.some((e) => e.isIntersecting)) { io.disconnect(); fn(); }
    }, { rootMargin: '200px' });
    io.observe(elm);
  }

  return {
    el, text, svg, clear, $, scale, niceTicks, frame, axes, line, rng,
    wave, waveFn, moons, ring, blobs, regions, tree, tip, slider, seg, player, drag,
    fmt, clamp, reducedMotion, onVisible, phone, pick,
  };
})();
