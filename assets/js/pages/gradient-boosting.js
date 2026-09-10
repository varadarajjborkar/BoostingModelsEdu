/* Chapter 02: Gradient Boosting. Leftover stepper, learning-rate race, gradient bowl. */
(() => {
  const pct = (v) => Math.round(v * 100) + '%';

  function arrow(parent, x1, y, x2, color) {
    const dir = Math.sign(x2 - x1) || 1, L = 7;
    V.el('line', { x1, x2: x2 - dir * 2, y1: y, y2: y, stroke: color, 'stroke-width': 2.5 }, parent);
    V.el('path', { d: `M${x2},${y} L${x2 - dir * L},${y - 5} L${x2 - dir * L},${y + 5} Z`, fill: color }, parent);
  }

  // ===================================================================
  // 1. Watch the leftovers shrink
  // ===================================================================
  (function mainViz() {
    const root = document.getElementById('gb-viz');
    const data = V.wave(60, 3, 0.35);
    const X = data.x.map((v) => [v]);
    const MAX = 80;
    const xs = Array.from({ length: 401 }, (_, i) => i / 40);
    let model;

    const W = 520;
    const sTop = V.svg(root.querySelector('.plot-top'), W, 250, 'Data dots and the team guess line');
    const ft = V.frame({ W, H: 250, m: { t: 12, r: 14, b: 28, l: 38 }, x: [0, 10], y: [-3.4, 3.8] });
    V.axes(sTop, ft, { xTicks: 5, yTicks: 4 });
    data.x.forEach((x, i) => V.el('circle', { cx: ft.sx(x), cy: ft.sy(data.y[i]), r: 3.8, fill: 'var(--ink-2)', 'fill-opacity': 0.5 }, sTop));
    const prevPath = V.el('path', { fill: 'none', stroke: 'var(--rule-2)', 'stroke-width': 2 }, sTop);
    const predPath = V.el('path', { fill: 'none', stroke: 'var(--c1)', 'stroke-width': 2.5, 'stroke-linejoin': 'round' }, sTop);

    const avg = ML.mean(data.y);
    const rmax = Math.max(...data.y.map((v) => Math.abs(v - avg))) + 0.3;
    const sBot = V.svg(root.querySelector('.plot-bottom'), W, 200, 'Leftover of each dot, and the newest tree fitted to them');
    const fb = V.frame({ W, H: 200, m: { t: 10, r: 14, b: 28, l: 38 }, x: [0, 10], y: [-rmax, rmax] });
    V.axes(sBot, fb, { xTicks: 5, yTicks: 4 });
    V.el('line', { x1: fb.left, x2: fb.right, y1: fb.sy(0), y2: fb.sy(0), stroke: 'var(--ink-2)', 'stroke-width': 1 }, sBot);
    const stemG = V.el('g', {}, sBot);
    const treePath = V.el('path', { fill: 'none', stroke: 'var(--c2)', 'stroke-width': 2.5, 'stroke-linejoin': 'round' }, sBot);
    const treeLbl = V.text(sBot, fb.right - 4, fb.top + 12, '', { class: 'lbl', 'text-anchor': 'end' });

    const lw = 320, lh = 170;
    const sL = V.svg('#gb-loss', lw, lh, 'Error left after each tree, as a share of the starting error');
    const fl = V.frame({ W: lw, H: lh, m: { t: 10, r: 12, b: 26, l: 40 }, x: [0, MAX], y: [0, 1] });
    V.axes(sL, fl, { xVals: [0, 20, 40, 60, 80], yVals: [0, 0.5, 1], fmtY: pct });
    const lossPath = V.el('path', { fill: 'none', stroke: 'var(--ink-2)', 'stroke-width': 2 }, sL);
    const lossDot = V.el('circle', { r: 4.5, fill: 'var(--ink-2)', stroke: 'var(--card)', 'stroke-width': 2 }, sL);

    const lrS = V.slider('gb-lr', () => reset(), (v) => (v / 100).toFixed(2));
    const dS = V.slider('gb-depth', () => reset());
    const curve = (fn) => V.line(xs.map((x) => [ft.sx(x), ft.sy(fn(x))]));

    function draw() {
      const T = model.trees.length;
      predPath.setAttribute('d', curve((x) => model.predict([x])));
      prevPath.setAttribute('d', T ? curve((x) => model.predict([x], T - 1)) : '');

      // leftovers the newest tree was trained on (or the current ones before any tree)
      const res = T ? model.trees[T - 1].res : model.residuals();
      V.clear(stemG);
      data.x.forEach((x, i) => {
        const px = fb.sx(x), py = fb.sy(V.clamp(res[i], -rmax, rmax));
        V.el('line', { x1: px, x2: px, y1: fb.sy(0), y2: py, stroke: 'var(--rule-2)', 'stroke-width': 1.5 }, stemG);
        V.el('circle', { cx: px, cy: py, r: 3.6, fill: 'var(--ink-2)', 'fill-opacity': 0.75 }, stemG);
      });
      if (T) {
        const tree = model.trees[T - 1].tree;
        const tv = (x) => V.clamp(ML.predictTree(tree, [x]), -rmax, rmax);
        treePath.setAttribute('d', V.line(xs.map((x) => [fb.sx(x), fb.sy(tv(x))])));
        treeLbl.textContent = `orange = tiny tree #${T}`;
      } else {
        treePath.setAttribute('d', '');
        treeLbl.textContent = '';
      }

      const rel = model.loss[T] / model.loss[0];
      document.getElementById('gb-t').textContent = T;
      document.getElementById('gb-err').textContent = pct(rel);
      const pts = model.loss.map((l, k) => [fl.sx(k), fl.sy(l / model.loss[0])]);
      lossPath.setAttribute('d', V.line(pts));
      lossDot.setAttribute('cx', pts[T][0]); lossDot.setAttribute('cy', pts[T][1]);

      const lr = (lrS.value / 100).toFixed(2);
      document.getElementById('gb-say').innerHTML = !T
        ? 'The first guess is a flat line: the <b>average</b>. The bottom chart shows each dot\'s leftover (how far it is from the guess). Press <b>Step</b>.'
        : `Tree <b>#${T}</b> learned the shape of the leftovers (orange line). We added <b>${lr} ×</b> its answer to the guess. Error left: <b>${pct(rel)}</b> of where we started.`;
    }

    function reset() {
      model = new ML.GBM(X, data.y, { lr: lrS.value / 100, maxDepth: dS.value });
      draw();
    }
    V.player({ host: root, speed: 450, canStep: () => model.trees.length < MAX, step: () => { model.step(); draw(); }, reset });
    reset();

    // Optional deep link, e.g. #gb=12 : start 12 trees in.
    const n0 = Math.min(MAX, Number(new URLSearchParams(location.hash.slice(1)).get('gb')) || 0);
    for (let k = 0; k < n0; k++) model.step();
    if (n0) draw();
  })();

  // ===================================================================
  // 2. Learning-rate race
  // ===================================================================
  (function lrViz() {
    const tr = V.wave(40, 7, 0.5), te = V.wave(400, 107, 0.5);
    const X = tr.x.map((v) => [v]), Xt = te.x.map((v) => [v]);
    const N = 150;
    const mse = (p, y) => p.reduce((a, v, i) => a + (v - y[i]) ** 2, 0) / y.length;
    const runs = [[1, 'var(--c1)', '1.0'], [0.3, 'var(--c2)', '0.3'], [0.05, 'var(--c3)', '0.05']].map(([lr, col, name]) => {
      const m = new ML.GBM(X, tr.y, { lr, maxDepth: 3 });
      const pt = new Array(Xt.length).fill(m.base);
      const test = [mse(pt, te.y)];
      for (let t = 1; t <= N; t++) {
        m.step();
        const tree = m.trees[t - 1].tree;
        for (let i = 0; i < Xt.length; i++) pt[i] += lr * ML.predictTree(tree, Xt[i]);
        test.push(mse(pt, te.y));
      }
      return { m, lr, col, name, test };
    });

    // three small panels
    const host = document.getElementById('lr-panels');
    const xs = Array.from({ length: 241 }, (_, i) => i / 24);
    const PW = 340, PH = 200;
    const panels = runs.map((r) => {
      const div = document.createElement('div');
      div.innerHTML = `<div class="panel-title"><i class="ln" style="display:inline-block;width:16px;height:2.5px;background:${r.col}"></i>learning rate ${r.name}</div>`;
      host.appendChild(div);
      const s = V.svg(div, PW, PH, `Fitted line with learning rate ${r.name}`);
      const f = V.frame({ W: PW, H: PH, m: { t: 8, r: 8, b: 24, l: 30 }, x: [0, 10], y: [-3.6, 4] });
      V.axes(s, f, { xTicks: 5, yTicks: 4 });
      tr.x.forEach((x, i) => V.el('circle', { cx: f.sx(x), cy: f.sy(tr.y[i]), r: 3.2, fill: 'var(--ink-2)', 'fill-opacity': 0.5 }, s));
      const path = V.el('path', { fill: 'none', stroke: r.col, 'stroke-width': 2.2, 'stroke-linejoin': 'round' }, s);
      return { r, f, path };
    });

    // test-error chart
    const TW = 1000, TH = 230;
    const st = V.svg('#lr-test', TW, TH, 'Error on new data for each learning rate, as trees are added');
    const ft = V.frame({ W: TW, H: TH, m: { t: 12, r: 60, b: 30, l: 44 }, x: [0, N], y: [0.3, 1.3] });
    V.axes(st, ft, { xVals: [0, 25, 50, 75, 100, 125, 150], yVals: [0.4, 0.7, 1, 1.3], fmtY: (v) => v.toFixed(1), xLabel: 'number of trees' });
    const clipId = 'lr-clip';
    const defs = V.el('defs', {}, st);
    const cp = V.el('clipPath', { id: clipId }, defs);
    V.el('rect', { x: ft.left, y: ft.top, width: ft.iw, height: ft.ih }, cp);
    runs.forEach((r) => {
      V.el('path', { d: V.line(r.test.map((e, k) => [ft.sx(k), ft.sy(e)])), fill: 'none', stroke: r.col, 'stroke-width': 2, 'clip-path': `url(#${clipId})` }, st);
    });
    // End labels: lines that finish at (almost) the same height share one label.
    const ends = runs.map((r) => ({ y: ft.sy(V.clamp(r.test[N], 0.3, 1.3)), name: r.name })).sort((a, b) => a.y - b.y);
    const groups = [];
    ends.forEach((e) => {
      const g = groups[groups.length - 1];
      if (g && e.y - g.y < 12) g.names.push(e.name); else groups.push({ y: e.y, names: [e.name] });
    });
    groups.forEach((g) => V.text(st, ft.right + 6, g.y + 4, g.names.join(' & '), { class: 'lbl' }));
    const mark = V.el('line', { y1: ft.top, y2: ft.bottom, stroke: 'var(--ink)', 'stroke-width': 1 }, st);
    const dots = runs.map((r) => V.el('circle', { r: 4.5, fill: r.col, stroke: 'var(--card)', 'stroke-width': 2 }, st));

    function update(n) {
      panels.forEach(({ r, f, path }) => {
        path.setAttribute('d', V.line(xs.map((x) => [f.sx(x), f.sy(V.clamp(r.m.predict([x], n), -3.6, 4))])));
      });
      mark.setAttribute('x1', ft.sx(n)); mark.setAttribute('x2', ft.sx(n));
      runs.forEach((r, k) => {
        dots[k].setAttribute('cx', ft.sx(n));
        dots[k].setAttribute('cy', ft.sy(V.clamp(r.test[n], 0.3, 1.3)));
      });
      const best = runs.reduce((a, r) => (r.test[n] < a.test[n] ? r : a));
      document.getElementById('lr-say').innerHTML =
        `After <b>${n}</b> trees, error on new data: ` +
        runs.map((r) => `<b>${r.name}</b> → ${r.test[n].toFixed(2)}`).join(' · ') +
        `. Best right now: learning rate <b>${best.name}</b>.` +
        (n >= 100 ? ' Notice how the big learning rates got <b>worse</b> with more trees: they are fitting the noise.' : '') +
        (n <= 5 ? ' Big shots are ahead early, gentle shots have barely moved.' : '');
    }
    V.slider('lr-n', update);
    update(10);
  })();

  // ===================================================================
  // 3. Why "gradient": the bowl for one dot
  // ===================================================================
  (function gradViz() {
    const root = document.getElementById('grad-viz');
    const Y = 6;
    const LOSS = {
      sq: { f: (F) => 0.5 * (Y - F) ** 2, g: (F) => -(Y - F), yMax: 19 },
      abs: { f: (F) => Math.abs(Y - F), g: (F) => (Math.abs(Y - F) < 1e-9 ? 0 : -Math.sign(Y - F)), yMax: 6.5 },
    };
    let kind = 'sq', F = 2.2;
    const W = 520, H = 320;
    const s = V.svg(root.querySelector('.plot'), W, H, 'The loss bowl for one dot, with the downhill arrow');
    s.style.touchAction = 'none';
    const layer = V.el('g', {}, s);
    let f;

    function draw() {
      const L = LOSS[kind];
      V.clear(layer);
      f = V.frame({ W, H, m: { t: 18, r: 16, b: 40, l: 42 }, x: [0, 10], y: [0, L.yMax] });
      const defs = V.el('defs', {}, layer);
      const cp = V.el('clipPath', { id: 'gr-clip' }, defs);
      V.el('rect', { x: f.left, y: f.top, width: f.iw, height: f.ih }, cp);
      V.axes(layer, f, { xTicks: 5, yTicks: 4, xLabel: 'guess F', yLabel: 'loss for this dot' });
      V.el('line', { x1: f.sx(Y), x2: f.sx(Y), y1: f.top, y2: f.bottom, stroke: 'var(--good)', 'stroke-width': 1.5 }, layer);
      V.text(layer, f.sx(Y) + 5, f.top + 12, 'true value', { class: 'lbl-sm' });
      const xs = Array.from({ length: 201 }, (_, i) => i / 20);
      V.el('path', { d: V.line(xs.map((x) => [f.sx(x), f.sy(L.f(x))])), fill: 'none', stroke: 'var(--c1)', 'stroke-width': 2.5, 'clip-path': 'url(#gr-clip)' }, layer);

      const g = L.g(F), y0 = L.f(F), dx = 1.4;
      V.el('line', {
        x1: f.sx(F - dx), y1: f.sy(y0 - g * dx), x2: f.sx(F + dx), y2: f.sy(y0 + g * dx),
        stroke: 'var(--ink)', 'stroke-width': 1.2, 'clip-path': 'url(#gr-clip)',
      }, layer);

      // the downhill step: move the guess by -slope
      if (Math.abs(g) > 1e-6) {
        const ay = f.bottom - 14;
        const x2 = V.clamp(F - g, 0, 10);
        arrow(layer, f.sx(F), ay, f.sx(x2), 'var(--c2)');
        V.text(layer, (f.sx(F) + f.sx(x2)) / 2, ay - 8, `−slope = ${(-g).toFixed(2)}`, { class: 'lbl', 'text-anchor': 'middle' });
      }
      V.el('line', { x1: f.sx(F), x2: f.sx(F), y1: f.sy(y0), y2: f.bottom, stroke: 'var(--rule-2)', 'stroke-width': 1 }, layer);
      V.el('circle', { cx: f.sx(F), cy: f.sy(Math.min(y0, L.yMax)), r: 7, fill: 'var(--ink)', stroke: 'var(--card)', 'stroke-width': 2 }, layer);

      document.getElementById('gr-f').textContent = F.toFixed(2);
      document.getElementById('gr-g').textContent = g.toFixed(2);
      document.getElementById('gr-r').textContent = (-g >= 0 ? '+' : '') + (-g).toFixed(2);
      const say = document.getElementById('gr-say');
      if (Math.abs(g) < 0.02) say.innerHTML = '<b>Bottom of the bowl.</b> Slope 0: nothing left to learn for this dot.';
      else if (kind === 'sq') {
        say.innerHTML = `Downhill is to the <b>${g < 0 ? 'right' : 'left'}</b>. −slope = <b>${(-g).toFixed(2)}</b>, ` +
          `which is exactly the leftover 6 − ${F.toFixed(2)}. So "fit the leftovers" = "take a step downhill".`;
      } else {
        say.innerHTML = 'With absolute error the slope is always <b>±1</b>. The next tree only learns the <b>direction</b>, not the size. ' +
          'One crazy outlier cannot pull the model far, so this loss stays calm around outliers.';
      }
    }
    V.drag(s, s, (_, q) => { F = V.clamp(f.sx.inv(q.x), 0, 10); draw(); });
    V.seg('grad-loss', (v) => { kind = v; draw(); });
    draw();
  })();
})();
