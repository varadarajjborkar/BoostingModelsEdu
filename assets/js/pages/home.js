/* Home page: chapter cards + the live "trees team up" hero animation. */
(() => {
  // ---------- Chapter cards ----------
  const E = 'stroke="var(--rule-2)" stroke-width="2"';
  const glyphs = {
    '00-warmup':
      `<svg viewBox="0 0 60 44"><line x1="30" y1="10" x2="16" y2="30" ${E}/><line x1="30" y1="10" x2="44" y2="30" ${E}/>` +
      '<circle cx="30" cy="10" r="5" fill="var(--ink-2)"/><rect x="8" y="28" width="16" height="10" rx="3" fill="var(--c1)"/>' +
      '<rect x="36" y="28" width="16" height="10" rx="3" fill="var(--c2)"/></svg>',
    '01-adaboost':
      '<svg viewBox="0 0 60 44"><circle cx="10" cy="30" r="3" fill="var(--c1)"/><circle cx="22" cy="15" r="6.5" fill="var(--c2)"/>' +
      '<circle cx="33" cy="32" r="3.5" fill="var(--c1)"/><circle cx="47" cy="20" r="9" fill="var(--c2)"/></svg>',
    '02-gradient-boosting':
      '<svg viewBox="0 0 60 44"><path d="M4,34 C18,2 36,42 56,10" fill="none" stroke="var(--rule-2)" stroke-width="2"/>' +
      '<path d="M4,30 H16 V19 H28 V26 H40 V17 H56" fill="none" stroke="var(--c1)" stroke-width="2.5" stroke-linejoin="round"/></svg>',
    '03-xgboost':
      '<svg viewBox="0 0 60 44"><path d="M6,6 Q30,62 54,6" fill="none" stroke="var(--ink-2)" stroke-width="2"/>' +
      '<path d="M13,20 Q20,6 28,31" fill="none" stroke="var(--c2)" stroke-width="2"/>' +
      '<circle cx="13.2" cy="20.3" r="3.5" fill="var(--c2)"/><circle cx="30" cy="34" r="3.5" fill="var(--c1)"/></svg>',
    '04-lightgbm':
      '<svg viewBox="0 0 60 44">' +
      [[6, 10], [14, 20], [22, 32], [30, 26], [38, 16], [46, 8]]
        .map(([x, h]) => `<rect x="${x}" y="${40 - h}" width="6" height="${h}" rx="1.5" fill="var(--c3)"/>`).join('') +
      '</svg>',
    '05-catboost':
      `<svg viewBox="0 0 60 44"><path d="M30,7 L17,21 M30,7 L43,21 M17,21 L10,32 M17,21 L23,32 M43,21 L37,32 M43,21 L50,32" ${E} fill="none"/>` +
      '<circle cx="30" cy="7" r="4.5" fill="var(--ink-2)"/><circle cx="17" cy="21" r="4.5" fill="var(--c5)"/><circle cx="43" cy="21" r="4.5" fill="var(--c5)"/>' +
      [6, 19, 33, 46].map((x, i) => `<rect x="${x}" y="31" width="9" height="8" rx="2" fill="${i % 2 ? 'var(--c2)' : 'var(--c1)'}"/>`).join('') +
      '</svg>',
    '06-faceoff':
      '<svg viewBox="0 0 60 44"><rect x="8" y="22" width="13" height="18" rx="2" fill="var(--c1)"/>' +
      '<rect x="23.5" y="9" width="13" height="31" rx="2" fill="var(--c3)"/><rect x="39" y="16" width="13" height="24" rx="2" fill="var(--c2)"/></svg>',
  };
  const core = new Set(['03-xgboost', '04-lightgbm', '05-catboost']);
  const seen = SITE.visited();
  document.getElementById('chapters').innerHTML = SITE.CHAPTERS.map((c) => `
    <a class="chap-card${core.has(c.slug) ? ' star' : ''}${c.slug === '06-faceoff' ? ' finale' : ''}${seen.includes(c.slug) ? ' visited' : ''}" href="pages/${c.slug}.html">
      <div class="glyph">${glyphs[c.slug]}</div>
      <div>
        <div class="no">CHAPTER ${String(c.n).padStart(2, '0')}</div>
        <h3>${c.title}</h3>
        <p>${c.idea}</p>
        ${core.has(c.slug) ? '<span class="tag">★ Core model</span>' : ''}
      </div>
      <span class="seen">✓ seen</span>
    </a>`).join('');

  // ---------- Hero: gradient boosting fitting a wavy curve, live ----------
  const host = document.getElementById('hero-viz');
  const W = 560, H = 300;
  const s = V.svg(host.querySelector('.plot'), W, H, 'A line made of small trees slowly bending to fit wavy data');
  const data = V.wave(70, 7, 0.3);
  const X = data.x.map((v) => [v]);
  const f = V.frame({ W, H, m: { t: 12, r: 10, b: 26, l: 30 }, x: [0, 10], y: [-3.4, 3.6] });
  V.axes(s, f, { xTicks: 5, yTicks: 4 });
  const pts = V.el('g', {}, s);
  data.x.forEach((x, i) => V.el('circle', { cx: f.sx(x), cy: f.sy(data.y[i]), r: 3.5, fill: 'var(--ink-2)', 'fill-opacity': 0.42 }, pts));
  const path = V.el('path', { fill: 'none', stroke: 'var(--c1)', 'stroke-width': 2.5, 'stroke-linejoin': 'round' }, s);

  const xs = Array.from({ length: 281 }, (_, i) => (i * 10) / 280);
  const MAX = 40;
  const cnt = document.getElementById('hero-count');
  const mseEl = document.getElementById('hero-mse');
  const meter = document.getElementById('hero-meter');
  const btn = document.getElementById('hero-toggle');
  let model, timer = null, hold = 0;

  function draw() {
    path.setAttribute('d', V.line(xs.map((x) => [f.sx(x), f.sy(model.predict([x]))])));
    cnt.textContent = model.trees.length;
    const last = model.loss[model.loss.length - 1];
    mseEl.textContent = Math.round((100 * last) / model.loss[0]) + '%';
    meter.style.width = (100 * model.trees.length) / MAX + '%';
  }
  function reset() { model = new ML.GBM(X, data.y, { lr: 0.3, maxDepth: 2 }); draw(); }
  function tick() {
    if (model.trees.length >= MAX) { if (++hold > 5) { hold = 0; reset(); } return; }
    model.step();
    draw();
  }
  function play() { if (timer) return; timer = setInterval(tick, 420); btn.textContent = '❚❚ Pause'; }
  function pause() { clearInterval(timer); timer = null; btn.textContent = '▶ Play'; }
  btn.addEventListener('click', () => (timer ? pause() : play()));

  reset();
  if (V.reducedMotion()) {
    for (let i = 0; i < MAX; i++) model.step();
    draw();
    btn.textContent = '▶ Play';
  } else {
    play();
  }
})();
