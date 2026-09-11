/* Chapter 00: best question, depth, measuring mistakes, bagging vs boosting. */
(() => {
  const POS = 'var(--pos)', NEG = 'var(--neg)';

  // ===================================================================
  // 1. Find the best question (drag a split, watch the Gini mess score)
  // ===================================================================
  (function splitFinder() {
    const root = document.getElementById('split-viz');
    const { X, y } = V.blobs(60, 21, 0.15);
    let feat = 0, thr = 0.5, scanTimer = null;

    const W = V.pick(520, 340), H = V.pick(420, 300);
    const s = V.svg(root.querySelector('.plot'), W, H, 'Blue and orange dots with a line you can drag to split them');
    const f = V.frame({ W, H, m: { t: 20, r: 16, b: 40, l: 40 }, x: [0, 1], y: [0, 1] });
    const sideG = V.el('g', {}, s);
    const sideA = V.el('rect', {}, sideG), sideB = V.el('rect', {}, sideG);
    V.axes(s, f, { xTicks: 5, yTicks: 5, fmtX: (v) => v.toFixed(1), fmtY: (v) => v.toFixed(1), xLabel: 'feature 1 →', yLabel: 'feature 2 ↑' });
    const ptsG = V.el('g', {}, s);
    X.forEach((p, i) => V.el('circle', {
      cx: f.sx(p[0]), cy: f.sy(p[1]), r: 5.5, fill: y[i] > 0 ? POS : NEG, stroke: 'var(--card)', 'stroke-width': 2,
    }, ptsG));
    const ln = V.el('line', { stroke: 'var(--ink)', 'stroke-width': 2 }, s);
    const knob = V.el('circle', { r: 8, fill: 'var(--ink)', stroke: 'var(--card)', 'stroke-width': 2 }, s);
    const tagYes = V.text(s, 0, 0, 'YES side', { class: 'lbl-sm' });
    const tagNo = V.text(s, 0, 0, 'NO side', { class: 'lbl-sm' });
    // Invisible, finger-sized handles on top of the line and its knob.
    const lnHit = V.el('line', { stroke: 'transparent', 'stroke-width': 30 }, s);
    const knobHit = V.el('circle', { r: 22, fill: 'transparent', 'data-grip': '' }, s);

    function counts(fe, t) {
      let lp = 0, ln_ = 0, rp = 0, rn = 0;
      for (let i = 0; i < X.length; i++) {
        if (X[i][fe] <= t) { if (y[i] > 0) lp++; else ln_++; } else if (y[i] > 0) rp++; else rn++;
      }
      const nL = lp + ln_, nR = rp + rn;
      const gL = nL ? ML.gini(lp / nL) : 0, gR = nR ? ML.gini(rp / nR) : 0;
      return { lp, ln: ln_, rp, rn, nL, nR, gL, gR, w: (nL * gL + nR * gR) / X.length };
    }

    // Mess-score curve for every cut of the current feature.
    const ts = Array.from({ length: 197 }, (_, i) => 0.02 + i * 0.005);
    let curve = [], bestT = 0.5, bestW = 1;
    function computeCurve() {
      curve = ts.map((t) => [t, counts(feat, t).w]);
      const b = curve.reduce((a, c) => (c[1] < a[1] ? c : a));
      bestT = b[0]; bestW = b[1];
      document.getElementById('sp-bestv').textContent = bestW.toFixed(2);
    }

    // Bars: how mixed each group is.
    const bw = 320, bh = 110;
    const sb = V.svg('#sp-bars', bw, bh, 'Share of each class in the yes and no groups');
    function drawBars(c) {
      V.clear(sb);
      [['YES group', c.lp, c.ln, c.gL, 4], ['NO group', c.rp, c.rn, c.gR, 58]].forEach(([name, p, q, g, y0]) => {
        const n = p + q;
        V.text(sb, 0, y0 + 12, `${name} · ${n} dots`, { class: 'lbl' });
        V.text(sb, bw, y0 + 12, `mess ${g.toFixed(2)}`, { class: 'lbl', 'text-anchor': 'end' });
        const full = bw;
        const wp = n ? (p / n) * full : 0;
        if (n === 0) { V.el('rect', { x: 0, y: y0 + 20, width: full, height: 14, rx: 4, fill: 'var(--rule)' }, sb); return; }
        if (p) V.el('rect', { x: 0, y: y0 + 20, width: Math.max(0, wp - (q ? 1 : 0)), height: 14, rx: 4, fill: POS }, sb);
        if (q) V.el('rect', { x: wp + (p ? 1 : 0), y: y0 + 20, width: Math.max(0, full - wp - (p ? 1 : 0)), height: 14, rx: 4, fill: NEG }, sb);
      });
    }

    // Curve chart.
    const cw = 320, ch = 170;
    const sc = V.svg('#sp-curve', cw, ch, 'Mess score for every possible cut');
    const cf = V.frame({ W: cw, H: ch, m: { t: 12, r: 10, b: 30, l: 34 }, x: [0, 1], y: [0, 0.5] });
    V.axes(sc, cf, { xTicks: 5, yVals: [0, 0.25, 0.5], fmtX: (v) => v.toFixed(1), fmtY: (v) => v.toFixed(2) });
    const cPath = V.el('path', { fill: 'none', stroke: 'var(--c1)', 'stroke-width': 2 }, sc);
    const cBest = V.el('circle', { r: 4, fill: 'var(--good)', stroke: 'var(--card)', 'stroke-width': 2 }, sc);
    const cBestT = V.text(sc, 0, 0, 'best', { class: 'lbl-sm', 'text-anchor': 'middle' });
    const cNow = V.el('line', { stroke: 'var(--ink)', 'stroke-width': 1 }, sc);
    const cDot = V.el('circle', { r: 5, fill: 'var(--ink)', stroke: 'var(--card)', 'stroke-width': 2 }, sc);

    function drawCurve() {
      cPath.setAttribute('d', V.line(curve.map(([t, w]) => [cf.sx(t), cf.sy(w)])));
      cBest.setAttribute('cx', cf.sx(bestT)); cBest.setAttribute('cy', cf.sy(bestW));
      cBestT.setAttribute('x', cf.sx(bestT)); cBestT.setAttribute('y', cf.sy(bestW) + 16);
    }

    function update() {
      const c = counts(feat, thr);
      const tint = (p, n) => {
        if (!n) return ['none', 0];
        const share = p / n;
        return [share >= 0.5 ? POS : NEG, 0.03 + 0.12 * Math.abs(2 * share - 1)];
      };
      const [fa, oa] = tint(c.lp, c.nL), [fb, ob] = tint(c.rp, c.nR);
      if (feat === 0) {
        const x = f.sx(thr);
        Object.entries({ x1: x, x2: x, y1: f.top, y2: f.bottom }).forEach(([k, v]) => ln.setAttribute(k, v));
        knob.setAttribute('cx', x); knob.setAttribute('cy', f.top);
        Object.entries({ x: f.left, y: f.top, width: x - f.left, height: f.ih }).forEach(([k, v]) => sideA.setAttribute(k, v));
        Object.entries({ x, y: f.top, width: f.right - x, height: f.ih }).forEach(([k, v]) => sideB.setAttribute(k, v));
        tagYes.setAttribute('x', f.left + 6); tagYes.setAttribute('y', f.top + 14); tagYes.setAttribute('text-anchor', 'start');
        tagNo.setAttribute('x', f.right - 6); tagNo.setAttribute('y', f.top + 14); tagNo.setAttribute('text-anchor', 'end');
      } else {
        const yy = f.sy(thr);
        Object.entries({ x1: f.left, x2: f.right, y1: yy, y2: yy }).forEach(([k, v]) => ln.setAttribute(k, v));
        knob.setAttribute('cx', f.right); knob.setAttribute('cy', yy);
        Object.entries({ x: f.left, y: yy, width: f.iw, height: f.bottom - yy }).forEach(([k, v]) => sideA.setAttribute(k, v));
        Object.entries({ x: f.left, y: f.top, width: f.iw, height: yy - f.top }).forEach(([k, v]) => sideB.setAttribute(k, v));
        tagYes.setAttribute('x', f.left + 6); tagYes.setAttribute('y', f.bottom - 8); tagYes.setAttribute('text-anchor', 'start');
        tagNo.setAttribute('x', f.left + 6); tagNo.setAttribute('y', f.top + 14); tagNo.setAttribute('text-anchor', 'start');
      }
      ['x1', 'x2', 'y1', 'y2'].forEach((k) => lnHit.setAttribute(k, ln.getAttribute(k)));
      knobHit.setAttribute('cx', knob.getAttribute('cx')); knobHit.setAttribute('cy', knob.getAttribute('cy'));
      lnHit.toggleAttribute('data-grip', feat !== 0);   // a flat line can be grabbed anywhere along it
      sideA.setAttribute('fill', fa); sideA.setAttribute('fill-opacity', oa);
      sideB.setAttribute('fill', fb); sideB.setAttribute('fill-opacity', ob);
      document.getElementById('sp-q').textContent = `Is feature ${feat + 1} ≤ ${thr.toFixed(2)}?`;
      document.getElementById('sp-gini').textContent = c.w.toFixed(2);
      drawBars(c);
      cNow.setAttribute('x1', cf.sx(thr)); cNow.setAttribute('x2', cf.sx(thr));
      cNow.setAttribute('y1', cf.top); cNow.setAttribute('y2', cf.bottom);
      cDot.setAttribute('cx', cf.sx(thr)); cDot.setAttribute('cy', cf.sy(c.w));
    }

    const stopScan = () => { clearInterval(scanTimer); scanTimer = null; };
    V.drag(s, s, (_, q) => {
      stopScan();
      thr = V.clamp(feat === 0 ? f.sx.inv(q.x) : f.sy.inv(q.y), 0.02, 0.98);
      update();
    }, () => (feat === 0 ? 'x' : 'y'));
    document.getElementById('sp-scan').addEventListener('click', () => {
      stopScan();
      let t = 0.02;
      scanTimer = setInterval(() => {
        t += 0.012;
        if (t >= 0.98) { stopScan(); thr = bestT; update(); return; }
        thr = t; update();
      }, 25);
    });
    document.getElementById('sp-best').addEventListener('click', () => { stopScan(); thr = bestT; update(); });
    V.seg('sp-feat', (v) => { stopScan(); feat = Number(v); thr = 0.5; computeCurve(); drawCurve(); update(); });

    computeCurve(); drawCurve(); update();
  })();

  // ===================================================================
  // 2. Depth: tiny tree vs giant tree
  // ===================================================================
  (function depthViz() {
    const root = document.getElementById('depth-viz');
    const tr = V.moons(120, 0.28, 8), te = V.moons(400, 0.28, 99);
    const to01 = (arr) => arr.map((v) => (v > 0 ? 1 : 0));
    const ytr = to01(tr.y), yte = to01(te.y);
    const DMAX = 10;
    const acc = (tree, X, y) => X.reduce((c, x, i) => c + (((ML.predictTree(tree, x) >= 0.5) ? 1 : 0) === y[i] ? 1 : 0), 0) / X.length;
    const models = [];
    for (let d = 1; d <= DMAX; d++) {
      const t = ML.fitClassTree(tr.X, ytr, { maxDepth: d });
      models.push({ d, t, tr: acc(t, tr.X, ytr), te: acc(t, te.X, yte), leaves: ML.leaves(t).length });
    }
    const bestD = models.reduce((a, m) => (m.te > a.te ? m : a)).d;

    const W = V.pick(520, 340), H = V.pick(400, 280);
    const s = V.svg(root.querySelector('.plot'), W, H, 'Two moons of dots with the tree answer shaded behind them');
    const ext = (k) => [Math.min(...tr.X.map((p) => p[k])) - 0.04, Math.max(...tr.X.map((p) => p[k])) + 0.04];
    const f = V.frame({ W, H, m: { t: 14, r: 14, b: 34, l: 38 }, x: ext(0), y: ext(1) });
    const bg = V.el('g', {}, s);
    V.axes(s, f, { xTicks: 5, yTicks: 5, fmtX: (v) => v.toFixed(1), fmtY: (v) => v.toFixed(1), grid: false });
    const ptsG = V.el('g', {}, s);
    tr.X.forEach((p, i) => V.el('circle', {
      cx: f.sx(p[0]), cy: f.sy(p[1]), r: 4.5, fill: tr.y[i] > 0 ? POS : NEG, stroke: 'var(--card)', 'stroke-width': 1.5,
    }, ptsG));

    // accuracy chart
    const aw = 320, ah = 210;
    const sa = V.svg('#dp-chart', aw, ah, 'Training and new-data accuracy for depths 1 to 10');
    const af = V.frame({ W: aw, H: ah, m: { t: 14, r: 60, b: 30, l: 38 }, x: [1, DMAX], y: [0.6, 1] });
    V.axes(sa, af, { xVals: [1, 2, 4, 6, 8, 10], yVals: [0.6, 0.7, 0.8, 0.9, 1], fmtY: (v) => Math.round(v * 100) + '%' });
    const series = [['tr', 'var(--ink-2)', 'training'], ['te', 'var(--c3)', 'new data']];
    series.forEach(([k, col, name]) => {
      const pts = models.map((m) => [af.sx(m.d), af.sy(m[k])]);
      V.el('path', { d: V.line(pts), fill: 'none', stroke: col, 'stroke-width': 2 }, sa);
      const last = pts[pts.length - 1];
      V.text(sa, last[0] + 6, last[1] + 4, name, { class: 'lbl-sm' });
    });
    const mark = V.el('line', { stroke: 'var(--ink)', 'stroke-width': 1 }, sa);
    const dotTr = V.el('circle', { r: 4.5, fill: 'var(--ink-2)', stroke: 'var(--card)', 'stroke-width': 2 }, sa);
    const dotTe = V.el('circle', { r: 4.5, fill: 'var(--c3)', stroke: 'var(--card)', 'stroke-width': 2 }, sa);

    const pct = (v) => Math.round(v * 100) + '%';
    function draw(d) {
      const m = models[d - 1];
      V.clear(bg);
      V.regions(bg, f, (x, yv) => 2 * ML.predictTree(m.t, [x, yv]) - 1);
      document.getElementById('dp-leaves').textContent = m.leaves;
      document.getElementById('dp-tr').textContent = pct(m.tr);
      document.getElementById('dp-te').textContent = pct(m.te);
      const x = af.sx(d);
      mark.setAttribute('x1', x); mark.setAttribute('x2', x); mark.setAttribute('y1', af.top); mark.setAttribute('y2', af.bottom);
      dotTr.setAttribute('cx', x); dotTr.setAttribute('cy', af.sy(m.tr));
      dotTe.setAttribute('cx', x); dotTe.setAttribute('cy', af.sy(m.te));
      let msg;
      if (d === 1) msg = '<b>A stump.</b> One question. Weak, but it cannot memorize anything.';
      else if (d === bestD) msg = '<b>Sweet spot.</b> The best score on new data.';
      else if (m.tr - m.te > 0.07 && d > bestD) msg = '<b>Memorizing!</b> Almost perfect on training data, worse on new data. This is overfitting.';
      else if (d < bestD) msg = '<b>Still learning</b> the big shape. More questions help.';
      else msg = '<b>Getting greedy.</b> It starts chasing single dots.';
      document.getElementById('dp-say').innerHTML = msg;
    }
    V.slider('dp-depth', draw);
    draw(1);
  })();

  // ===================================================================
  // 3. A mistake is a square
  // ===================================================================
  (function lossViz() {
    const root = document.getElementById('loss-viz');
    const ys = [3.1, 5.4, 4.2, 6.8, 2.6, 5.0, 4.4];
    const avg = ys.reduce((a, b) => a + b, 0) / ys.length;
    const total = (c) => ys.reduce((a, v) => a + (v - c) ** 2, 0);
    let c = 2.2, anim = null;

    const W = V.pick(560, 340), H = V.pick(360, 280);
    const s = V.svg(root.querySelector('.plot'), W, H, 'Seven dots, a flat guess line, and a square for each mistake');
    const f = V.frame({ W, H, m: { t: 18, r: 16, b: 34, l: 40 }, x: [0.4, 8.4], y: [0, 8] });
    V.axes(s, f, { xVals: [1, 2, 3, 4, 5, 6, 7], fmtX: (v) => '#' + v, yTicks: 4, yLabel: 'value' });
    // Big squares near the right edge would spill out of the card, so trim them at the chart edge.
    const clip = V.el('clipPath', { id: 'ls-clip' }, V.el('defs', {}, s));
    V.el('rect', { x: f.left, y: f.top, width: W - f.left, height: f.ih }, clip);
    const sqG = V.el('g', { 'clip-path': 'url(#ls-clip)' }, s), resG = V.el('g', {}, s);
    const guess = V.el('line', { stroke: 'var(--ink)', 'stroke-width': 2.5, x1: f.left, x2: f.right }, s);
    const knob = V.el('circle', { r: 8, cx: f.left, fill: 'var(--ink)', stroke: 'var(--card)', 'stroke-width': 2, class: 'dragy' }, s);
    const gl = V.text(s, f.right, 0, 'your guess', { class: 'lbl halo', 'text-anchor': 'end' });
    const ptsG = V.el('g', {}, s);
    ys.forEach((v, i) => V.el('circle', { cx: f.sx(i + 1), cy: f.sy(v), r: 6, fill: 'var(--ink-2)', stroke: 'var(--card)', 'stroke-width': 2 }, ptsG));
    // Finger-sized handles: grab the guess line anywhere along it, or its knob.
    const guessHit = V.el('line', { x1: f.left, x2: f.right, stroke: 'transparent', 'stroke-width': 32, 'data-grip': '' }, s);
    const knobHit = V.el('circle', { cx: f.left, r: 22, fill: 'transparent', 'data-grip': '' }, s);

    // the bowl
    const bw = 320, bh = 200;
    const sbowl = V.svg('#ls-bowl', bw, bh, 'Total square area for every guess: a bowl shape');
    const maxL = Math.max(total(0.4), total(7.8));
    const bf = V.frame({ W: bw, H: bh, m: { t: 14, r: 12, b: 30, l: 40 }, x: [0.4, 7.8], y: [0, maxL] });
    V.axes(sbowl, bf, { xTicks: 5, yTicks: 3, xLabel: 'guess' });
    const cs = Array.from({ length: 120 }, (_, i) => 0.4 + (i * 7.4) / 119);
    V.el('path', { d: V.line(cs.map((v) => [bf.sx(v), bf.sy(total(v))])), fill: 'none', stroke: 'var(--c1)', 'stroke-width': 2 }, sbowl);
    const minX = bf.sx(avg), minY = bf.sy(total(avg));
    V.el('line', { x1: minX, x2: minX, y1: minY - 36, y2: minY - 6, stroke: 'var(--rule-2)', 'stroke-width': 1 }, sbowl);
    V.text(sbowl, minX, minY - 42, 'lowest = average', { class: 'lbl-sm', 'text-anchor': 'middle' });
    V.el('circle', { cx: minX, cy: minY, r: 4, fill: 'var(--good)', stroke: 'var(--card)', 'stroke-width': 2 }, sbowl);
    const bDot = V.el('circle', { r: 5.5, fill: 'var(--ink)', stroke: 'var(--card)', 'stroke-width': 2 }, sbowl);

    function update() {
      V.clear(sqG); V.clear(resG);
      const gy = f.sy(c);
      ys.forEach((v, i) => {
        const x = f.sx(i + 1), py = f.sy(v);
        const side = Math.abs(py - gy);
        const col = v > c ? 'var(--c1)' : 'var(--c2)';
        V.el('rect', { x, y: Math.min(py, gy), width: side, height: side, fill: col, 'fill-opacity': 0.13, stroke: col, 'stroke-opacity': 0.55 }, sqG);
        V.el('line', { x1: x, x2: x, y1: py, y2: gy, stroke: col, 'stroke-width': 2 }, resG);
      });
      guess.setAttribute('y1', gy); guess.setAttribute('y2', gy);
      knob.setAttribute('cy', gy);
      guessHit.setAttribute('y1', gy); guessHit.setAttribute('y2', gy); knobHit.setAttribute('cy', gy);
      gl.setAttribute('y', gy - 8);
      bDot.setAttribute('cx', bf.sx(c)); bDot.setAttribute('cy', bf.sy(total(c)));
      document.getElementById('ls-c').textContent = c.toFixed(2);
      document.getElementById('ls-total').textContent = total(c).toFixed(1);
      const gap = c - avg;
      document.getElementById('ls-say').innerHTML = Math.abs(gap) < 0.05
        ? '<b>Bottom of the bowl!</b> Your guess equals the average.'
        : gap < 0 ? 'Guess is <b>too low</b>: the blue squares are big. Slide up.' : 'Guess is <b>too high</b>: the orange squares are big. Slide down.';
    }
    V.drag(s, s, (_, q) => { clearInterval(anim); c = V.clamp(f.sy.inv(q.y), 0.4, 7.8); update(); }, 'y');
    document.getElementById('ls-best').addEventListener('click', () => {
      clearInterval(anim);
      anim = setInterval(() => {
        c += (avg - c) * 0.18;
        if (Math.abs(avg - c) < 0.005) { c = avg; clearInterval(anim); }
        update();
      }, 30);
    });
    update();
  })();

  // ===================================================================
  // 4. Bagging vs boosting, step by step
  // ===================================================================
  (function teamViz() {
    const root = document.getElementById('team-viz');
    const W = V.pick(460, 340), H = 320, mid = W / 2;
    const labels = [1, -1, 1, 1, -1, 1, -1, -1, 1, -1];
    const sb = V.svg(root.querySelector('.bag'), W, H, 'Bagging: three trees built at the same time on random bags, then a vote');
    const so = V.svg(root.querySelector('.boost'), W, H, 'Boosting: trees built one after another, each focusing on earlier mistakes');
    const cols = [W * 0.174, mid, W * 0.826];
    const gap = V.pick(44, 30);   // room between a tree icon and the arrow to the next tree

    function dotRow(g, cx, cy, idx, sizes, rings = []) {
      const gap = 14, x0 = cx - ((idx.length - 1) * gap) / 2;
      idx.forEach((k, j) => {
        const x = x0 + j * gap;
        if (rings.includes(k)) V.el('circle', { cx: x, cy, r: (sizes ? sizes[j] : 4) + 3, fill: 'none', stroke: 'var(--ink)', 'stroke-width': 1.2 }, g);
        V.el('circle', { cx: x, cy, r: sizes ? sizes[j] : 4, fill: labels[k] > 0 ? POS : NEG, stroke: 'var(--card)', 'stroke-width': 1.5 }, g);
      });
    }
    function tree(g, cx, cy, name) {
      V.el('path', { d: `M${cx},${cy - 12} L${cx - 14},${cy + 8} M${cx},${cy - 12} L${cx + 14},${cy + 8}`, stroke: 'var(--rule-2)', 'stroke-width': 2, fill: 'none' }, g);
      V.el('circle', { cx, cy: cy - 12, r: 6, fill: 'var(--ink-2)' }, g);
      V.el('rect', { x: cx - 22, y: cy + 6, width: 16, height: 10, rx: 3, fill: POS }, g);
      V.el('rect', { x: cx + 6, y: cy + 6, width: 16, height: 10, rx: 3, fill: NEG }, g);
      V.text(g, cx, cy + 34, name, { class: 'lbl', 'text-anchor': 'middle' });
    }
    const arrow = (g, x1, y1, x2, y2) => {
      V.el('line', { x1, y1, x2, y2, stroke: 'var(--muted)', 'stroke-width': 1.3 }, g);
      const a = Math.atan2(y2 - y1, x2 - x1), L = 6;
      V.el('path', { d: `M${x2},${y2} L${x2 - L * Math.cos(a - 0.45)},${y2 - L * Math.sin(a - 0.45)} L${x2 - L * Math.cos(a + 0.45)},${y2 - L * Math.sin(a + 0.45)} Z`, fill: 'var(--muted)' }, g);
    };
    const box = (g, cx, cy, label) => {
      const bw = Math.min(W - 8, Math.max(160, label.length * 7.8 + 28));   // wide enough for its words
      V.el('rect', { x: cx - bw / 2, y: cy - 17, width: bw, height: 34, rx: 10, fill: 'var(--paper)', stroke: 'var(--ink-2)' }, g);
      V.text(g, cx, cy + 5, label, { class: 'lbl-strong', 'text-anchor': 'middle' });
    };
    const all = [...labels.keys()];

    // --- bagging
    const b0 = V.el('g', {}, sb), b1 = V.el('g', { class: 'ghost' }, sb), b2 = V.el('g', { class: 'ghost' }, sb);
    V.text(b0, mid, 16, 'all the data', { class: 'lbl-sm', 'text-anchor': 'middle' });
    dotRow(b0, mid, 32, all);
    const bags = [[0, 3, 3, 7, 9], [1, 2, 5, 5, 8], [0, 4, 6, 6, 9]];
    cols.forEach((cx, k) => {
      arrow(b1, mid, 42, cx, 66);
      V.text(b1, cx, 80, `random bag ${k + 1}`, { class: 'lbl-sm', 'text-anchor': 'middle' });
      dotRow(b1, cx, 96, bags[k]);
      tree(b1, cx, 150, `Tree ${k + 1}`);
      arrow(b2, cx, 196, mid, 236);
    });
    box(b2, mid, 254, 'Vote / average');
    V.text(b2, mid, 300, 'final answer ✓', { class: 'lbl', 'text-anchor': 'middle' });

    // --- boosting
    const o0 = V.el('g', {}, so);
    const oc = cols.map(() => V.el('g', { class: 'ghost' }, so));
    const o4 = V.el('g', { class: 'ghost' }, so);
    V.text(o0, mid, 16, V.pick('same data every time, but dots grow when they were missed', 'same data, but missed dots grow'), { class: 'lbl-sm', 'text-anchor': 'middle' });
    const sizes = [
      all.map(() => 4),
      all.map((k) => ([2, 5].includes(k) ? 6.5 : 3)),
      all.map((k) => (k === 8 ? 6.5 : [2, 5].includes(k) ? 4.5 : 2.6)),
    ];
    const missed = [[2, 5], [8], []];
    const shortIdx = [0, 2, 4, 5, 6, 8];   // show 6 dots per column so they fit
    cols.forEach((cx, k) => {
      const idx = shortIdx;
      dotRow(oc[k], cx, 46, idx, idx.map((i) => sizes[k][i]), missed[k]);
      tree(oc[k], cx, 118, `Tree ${k + 1}`);
      V.text(oc[k], cx, 176, missed[k].length ? `missed ${missed[k].length} (circled)` : 'missed 0', { class: 'lbl-sm', 'text-anchor': 'middle' });
      if (k < 2) arrow(oc[k + 1], cx + gap, 118, cols[k + 1] - gap, 118);
      arrow(o4, cx, 190, mid, 236);
    });
    box(o4, mid, 254, 'Add up (good trees count more)');
    V.text(o4, mid, 300, 'final answer ✓', { class: 'lbl', 'text-anchor': 'middle' });

    const say = [
      'Press Step. Watch how each team is built.',
      '<b>Bagging</b> builds all 3 trees at once, each on a random bag. <b>Boosting</b> builds only tree 1.',
      '<b>Bagging</b> votes: done! <b>Boosting</b> builds tree 2, which studies what tree 1 missed (bigger dots).',
      '<b>Boosting</b> builds tree 3. It studies what is still wrong.',
      '<b>Boosting</b> adds all trees up. Better trees get a louder voice. Done.',
    ];
    let step = 0;
    const show = (g, on) => g.setAttribute('class', on ? 'shown' : 'ghost');
    function render() {
      show(b1, step >= 1); show(b2, step >= 2);
      oc.forEach((g, k) => show(g, step >= k + 1));
      show(o4, step >= 4);
      document.getElementById('tm-bag-done').style.visibility = step >= 2 ? 'visible' : 'hidden';
      document.getElementById('tm-boost-done').style.visibility = step >= 4 ? 'visible' : 'hidden';
      document.getElementById('tm-n').textContent = step;
      document.getElementById('tm-say').innerHTML = say[step];
    }
    V.player({
      host: root, speed: 1600,
      canStep: () => step < 4,
      step: () => { step++; render(); },
      reset: () => { step = 0; render(); },
    });
    render();
  })();
})();
