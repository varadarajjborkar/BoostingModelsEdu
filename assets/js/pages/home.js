/* Home page: chapter cards + the live "trees team up" hero animation. */
(() => {
  // ---------- Chapter cards (icons come from glyphs.js) ----------
  const core = new Set(['03-xgboost', '04-lightgbm', '05-catboost']);
  const seen = SITE.visited();
  document.getElementById('chapters').innerHTML = SITE.CHAPTERS.map((c) => `
    <a class="chap-card${core.has(c.slug) ? ' star' : ''}${c.slug === '06-faceoff' ? ' finale' : ''}${seen.includes(c.slug) ? ' visited' : ''}" href="pages/${c.slug}.html">
      <div class="glyph">${GLYPHS[c.slug]}</div>
      <div>
        <div class="no">${c.sub}</div>
        <h3>${c.title}</h3>
        <p>${c.idea}</p>
        ${core.has(c.slug) ? '<span class="tag">★ Core model</span>' : ''}
      </div>
      <span class="seen">✓ seen</span>
    </a>`).join('');

  // ---------- Hero: gradient boosting fitting a wavy curve, live ----------
  const host = document.getElementById('hero-viz');
  const W = V.pick(500, 340), H = V.pick(268, 230);
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
