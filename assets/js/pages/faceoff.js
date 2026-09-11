/* Chapter 06: Face-off. Pick-your-booster helper, early stopping, cheat-sheet icons. */
(() => {
  // icons for the persona cards and the cheat sheet
  document.querySelectorAll('[data-glyph]').forEach((el) => { el.innerHTML = GLYPHS[el.dataset.glyph] || ''; });

  // ===================================================================
  // 1. Pick your booster in 30 seconds
  // ===================================================================
  (function pickViz() {
    const MODELS = [
      { key: 'xgb', name: 'XGBoost', col: 'var(--c1)', why: 'A careful all-rounder with the richest set of controls and a huge community.' },
      { key: 'lgb', name: 'LightGBM', col: 'var(--c3)', why: 'The fastest to train on big data, thanks to buckets, leaf-wise growth and GOSS.' },
      { key: 'cat', name: 'CatBoost', col: 'var(--c2)', why: 'Handles word columns best (no leaks) and is strong with its default settings.' },
    ];
    const ans = [0, 0, 0];
    const W = V.pick(520, 340), H = 150, MAXS = 6;
    const s = V.svg('#pk-bars', W, H, 'How well each library fits your answers');

    function draw() {
      const score = { xgb: 2, lgb: 1, cat: 1 };
      if (ans[0]) { score.cat += 3; score.lgb += 1; }
      if (ans[1]) { score.lgb += 3; score.xgb += 1; }
      if (ans[2]) { score.cat += 2; }
      V.clear(s);
      const LABEL = 90, fx = V.scale(0, MAXS, LABEL, W - 40);
      MODELS.forEach((m, i) => {                     // fixed order: colour follows the library
        const y = 12 + i * 46;
        V.text(s, 0, y + 15, m.name, { class: 'lbl-strong' });
        V.el('rect', { x: LABEL, y, width: fx(MAXS) - LABEL, height: 20, rx: 5, fill: 'var(--paper)' }, s);
        V.el('rect', { x: LABEL, y, width: Math.max(4, fx(score[m.key]) - LABEL), height: 20, rx: 5, fill: m.col }, s);
        V.text(s, fx(score[m.key]) + 8, y + 15, String(score[m.key]), { class: 'lbl' });
      });
      const ranked = MODELS.slice().sort((a, b) => score[b.key] - score[a.key]);
      document.getElementById('pk-result').innerHTML =
        `<b>Start with ${ranked[0].name}.</b> ${ranked[0].why} Runner-up: <b>${ranked[1].name}</b>.`;
    }
    ['pk-q1', 'pk-q2', 'pk-q3'].forEach((id, i) => V.seg(id, (v) => { ans[i] = Number(v); draw(); }));
    draw();
  })();

  // ===================================================================
  // 2. When to stop: training vs validation error
  // ===================================================================
  (function stopViz() {
    const root = document.getElementById('es-viz');
    const tr = V.wave(40, 7, 0.5), va = V.wave(400, 107, 0.5);
    const X = tr.x.map((v) => [v]), Xv = va.x.map((v) => [v]);
    const N = 200, YMAX = 1.4;
    const mse = (p, y) => p.reduce((a, v, i) => a + (v - y[i]) ** 2, 0) / y.length;
    const W = V.pick(1000, 340), H = V.pick(300, 260);
    const s = V.svg(root.querySelector('.plot'), W, H, 'Training and validation error as trees are added');

    function run() {
      const lr = lrS.value / 100, depth = dS.value;
      const m = new ML.GBM(X, tr.y, { lr, maxDepth: depth });
      const pv = new Array(Xv.length).fill(m.base);
      const train = [m.loss[0]], val = [mse(pv, va.y)];
      for (let t = 1; t <= N; t++) {
        m.step();
        const tree = m.trees[t - 1].tree;
        for (let i = 0; i < Xv.length; i++) pv[i] += lr * ML.predictTree(tree, Xv[i]);
        train.push(m.loss[t]);
        val.push(mse(pv, va.y));
      }
      let best = 0;
      val.forEach((v, t) => { if (v < val[best]) best = t; });

      V.clear(s);
      const f = V.frame({ W, H, m: { t: 16, r: 20, b: 34, l: 44 }, x: [0, N], y: [0, YMAX] });
      const defs = V.el('defs', {}, s);
      const cp = V.el('clipPath', { id: 'es-clip' }, defs);
      V.el('rect', { x: f.left, y: f.top, width: f.iw, height: f.ih }, cp);
      V.el('rect', { x: f.sx(best), y: f.top, width: f.right - f.sx(best), height: f.ih, fill: 'var(--c4-wash)' }, s);
      V.axes(s, f, { xVals: V.pick([0, 25, 50, 75, 100, 125, 150, 175, 200], [0, 50, 100, 150, 200]), yVals: [0, 0.35, 0.7, 1.05, 1.4], fmtY: (v) => v.toFixed(2), xLabel: 'number of trees' });
      const line = (arr, col) => V.el('path', {
        d: V.line(arr.map((v, t) => [f.sx(t), f.sy(v)])), fill: 'none', stroke: col, 'stroke-width': 2.2, 'clip-path': 'url(#es-clip)',
      }, s);
      line(train, 'var(--ink-2)');
      line(val, 'var(--c3)');
      const bx = f.sx(best);
      V.el('line', { x1: bx, x2: bx, y1: f.top, y2: f.bottom, stroke: 'var(--good)', 'stroke-width': 2 }, s);
      V.el('circle', { cx: bx, cy: f.sy(Math.min(val[best], YMAX)), r: 5.5, fill: 'var(--good)', stroke: 'var(--card)', 'stroke-width': 2 }, s);
      // The labels measure themselves: flip to the left of the line near the right edge,
      // and drop to a second row if the two would touch.
      const stop = V.text(s, bx + 8, f.top + 14, `stop here: ${best} trees`, { class: 'lbl-strong halo' });
      const sBox = stop.getBBox();
      if (sBox.x + sBox.width > f.right) { stop.setAttribute('x', bx - 8); stop.setAttribute('text-anchor', 'end'); }
      if (best < N - 25) {
        const more = V.text(s, f.right - 8, f.top + 14, V.pick('extra trees only memorize →', 'extra trees memorize →'), { class: 'lbl', 'text-anchor': 'end' });
        const a = stop.getBBox(), b = more.getBBox();
        if (a.x + a.width + 10 > b.x && b.x + b.width + 10 > a.x) more.setAttribute('y', f.top + 34);
      }

      document.getElementById('es-best').textContent = best;
      document.getElementById('es-err').textContent = val[best].toFixed(3);
      document.getElementById('es-end').textContent = val[N].toFixed(3);
      const rise = val[N] - val[best];
      document.getElementById('es-say').innerHTML =
        `Validation error is lowest after <b>${best}</b> trees. ` +
        (rise > 0.02
          ? `By 200 trees it has climbed back up by <b>${rise.toFixed(2)}</b>, while training error kept falling: the extra trees memorized noise. Early stopping keeps the good model.`
          : 'After that it barely moves, so extra trees just waste time. Early stopping saves that time.') +
        ' Try a smaller learning rate: the best point moves right, and the valley gets wider and safer.';
    }
    const lrS = V.slider('es-lr', () => run(), (v) => (v / 100).toFixed(2));
    const dS = V.slider('es-depth', () => run());
    run();
  })();
})();
