/* Chapter 04: LightGBM. Buckets, leaf-wise growth, GOSS, feature bundling. */
(() => {
  const sum = (a) => a.reduce((s, v) => s + v, 0);

  // ===================================================================
  // 1. Buckets (histogram binning)
  // ===================================================================
  (function bucketViz() {
    const root = document.getElementById('bn-viz');
    const BUCKETS = [2, 4, 8, 16, 32, 64, 255];
    const d = V.wave(300, 5, 0.35);
    const avg = ML.mean(d.y);
    const order = d.x.map((_, i) => i).sort((a, b) => d.x[a] - d.x[b]);
    const xs = order.map((i) => d.x[i]);
    const rs = order.map((i) => d.y[i] - avg);
    const n = xs.length;
    const S = sum(rs);
    const prefix = [0];
    rs.forEach((v) => prefix.push(prefix[prefix.length - 1] + v));
    // gain of the cut that puts the first k dots on the left (squared error, h = 1)
    const gainAt = (k) => { const SL = prefix[k], SR = S - SL; return (SL * SL) / k + (SR * SR) / (n - k) - (S * S) / n; };
    const cutX = (k) => (xs[k - 1] + xs[k]) / 2;
    let exactK = 1;
    for (let k = 1; k < n; k++) if (gainAt(k) > gainAt(exactK)) exactK = k;

    const W = V.pick(520, 340), H1 = V.pick(250, 220), H2 = V.pick(150, 130);
    const s = V.svg(root.querySelector('.plot'), W, H1, '300 dots with bucket edges and the best cuts');
    const f = V.frame({ W, H: H1, m: { t: 10, r: 12, b: 28, l: 36 }, x: [0, 10], y: [-3.6, 3.6] });
    V.axes(s, f, { xTicks: 5, yTicks: 4 });
    const edgeG = V.el('g', {}, s);
    xs.forEach((x, i) => V.el('circle', { cx: f.sx(x), cy: f.sy(rs[i]), r: 2.6, fill: 'var(--ink-2)', 'fill-opacity': 0.5 }, s));
    const ex = f.sx(cutX(exactK));
    V.el('line', { x1: ex, x2: ex, y1: f.top, y2: f.bottom, stroke: 'var(--ink)', 'stroke-width': 2 }, s);
    const binLine = V.el('line', { y1: f.top, y2: f.bottom, stroke: 'var(--c2)', 'stroke-width': 2.5 }, s);
    const sh = V.svg('#bn-hist', W, H2, 'Sum of leftovers in each bucket');

    function update(v) {
      const B = BUCKETS[v];
      const cuts = [];
      for (let b = 1; b < B; b++) {
        const k = Math.round((b * n) / B);
        if (k > 0 && k < n && k !== cuts[cuts.length - 1]) cuts.push(k);
      }
      V.clear(edgeG);
      cuts.forEach((k) => {
        const x = f.sx(cutX(k));
        V.el('line', { x1: x, x2: x, y1: f.top, y2: f.bottom, stroke: 'var(--rule-2)', 'stroke-width': B > 64 ? 0.5 : 1 }, edgeG);
      });
      let bestK = cuts[0];
      cuts.forEach((k) => { if (gainAt(k) > gainAt(bestK)) bestK = k; });
      const bx = f.sx(cutX(bestK));
      binLine.setAttribute('x1', bx); binLine.setAttribute('x2', bx);

      // the histogram: one bar per bucket = sum of the leftovers inside it
      V.clear(sh);
      const bounds = [0, ...cuts, n];
      const sums = bounds.slice(0, -1).map((lo, b) => prefix[bounds[b + 1]] - prefix[lo]);
      const mx = Math.max(1, ...sums.map(Math.abs)) * 1.1;
      const fh = V.frame({ W, H: H2, m: { t: 8, r: 12, b: 24, l: 36 }, x: [0, 10], y: [-mx, mx] });
      V.axes(sh, fh, { xTicks: 5, yVals: [-Math.round(mx * 0.8), 0, Math.round(mx * 0.8)] });
      sums.forEach((v2, b) => {
        const lo = b === 0 ? 0 : cutX(bounds[b]);
        const hi = b === sums.length - 1 ? 10 : cutX(bounds[b + 1]);
        const x0 = fh.sx(lo) + 1, w = Math.max(0.5, fh.sx(hi) - fh.sx(lo) - 2);
        const y0 = fh.sy(0), y1 = fh.sy(v2);
        V.el('rect', { x: x0, y: Math.min(y0, y1), width: w, height: Math.max(0.5, Math.abs(y1 - y0)), fill: 'var(--ink-2)', 'fill-opacity': 0.5 }, sh);
      });
      V.el('line', { x1: fh.left, x2: fh.right, y1: fh.sy(0), y2: fh.sy(0), stroke: 'var(--ink-2)', 'stroke-width': 1 }, sh);

      const share = gainAt(bestK) / gainAt(exactK);
      document.getElementById('bn-cuts').textContent = cuts.length;
      document.getElementById('bn-exact').textContent = gainAt(exactK).toFixed(0);
      document.getElementById('bn-binned').textContent = gainAt(bestK).toFixed(0);
      document.getElementById('bn-say').innerHTML =
        `With <b>${B}</b> buckets, LightGBM checks <b>${cuts.length}</b> cut${cuts.length === 1 ? '' : 's'} instead of 299, ` +
        `and its best one keeps <b>${Math.round(share * 1000) / 10}%</b> of the best possible gain.` +
        (B <= 4 ? ' Too few buckets: the cut can only land in a few places.' : '') +
        (B === 255 ? ' 255 is the default. Here that is almost every cut (we only have 300 dots), but real data has millions of values, so 255 is a huge saving.' : '');
    }
    V.slider('bn-k', update, (v) => BUCKETS[v]);
    update(3);
  })();

  // ===================================================================
  // 2. Level-wise vs leaf-wise
  // ===================================================================
  (function growViz() {
    const root = document.getElementById('gw-viz');
    const data = V.moons(160, 0.18, 3);
    const MAXL = 12;
    const runs = ['level', 'leaf'].map((policy) => ({ policy, ...ML.growTree(data.X, data.y, { policy, maxLeaves: MAXL, minLeaf: 4 }) }));
    const steps = Math.min(...runs.map((r) => r.snapshots.length)) - 1;
    let k = 0;

    const MW = V.pick(480, 340), MH = V.pick(280, 220), TW = V.pick(480, 340), TH = V.pick(170, 150);
    runs.forEach((r) => {
      r.map = V.svg(root.querySelector(`.gw-${r.policy}-map`), MW, MH, `${r.policy}-wise partition of the plane`);
      r.tree = V.svg(root.querySelector(`.gw-${r.policy}-tree`), TW, TH, `${r.policy}-wise tree, split order numbered`);
      r.f = V.frame({ W: MW, H: MH, m: { t: 4, r: 4, b: 4, l: 4 }, x: [0, 1], y: [0, 1] });
      r.boxG = V.el('g', {}, r.map);
      r.dotG = V.el('g', {}, r.map);
      r.cutG = V.el('g', {}, r.map);
      data.X.forEach((p, i) => V.el('circle', {
        cx: r.f.sx(V.clamp(p[0], 0, 1)), cy: r.f.sy(V.clamp(p[1], 0, 1)), r: 3.2,
        fill: data.y[i] > 0 ? 'var(--pos)' : 'var(--neg)', stroke: 'var(--card)', 'stroke-width': 1,
      }, r.dotG));
    });

    // error chart
    const CW = V.pick(1000, 340), CH = V.pick(160, 170);
    const sc = V.svg('#gw-chart', CW, CH, 'Error for level-wise and leaf-wise as leaves are added');
    const fc = V.frame({ W: CW, H: CH, m: { t: 10, r: V.pick(70, 14), b: 28, l: 40 }, x: [1, steps + 1], y: [0, 1] });
    const leafTicks = Array.from({ length: steps + 1 }, (_, i) => i + 1).filter((v) => !V.phone || v % 2 === 1);
    V.axes(sc, fc, { xVals: leafTicks, yVals: [0, 0.5, 1], xLabel: 'leaves' });
    const cols = { level: 'var(--ink-2)', leaf: 'var(--c3)' };
    runs.forEach((r) => {
      const pts = r.snapshots.slice(0, steps + 1).map((sn, i) => [fc.sx(i + 1), fc.sy(sn.loss)]);
      V.el('path', { d: V.line(pts), fill: 'none', stroke: cols[r.policy], 'stroke-width': 2 }, sc);
    });
    const mark = V.el('line', { y1: fc.top, y2: fc.bottom, stroke: 'var(--ink)', 'stroke-width': 1 }, sc);
    const dots = runs.map((r) => V.el('circle', { r: 4.5, fill: cols[r.policy], stroke: 'var(--card)', 'stroke-width': 2 }, sc));

    const internal = (nd) => !!nd.order && nd.order <= k;
    function leavesAt(nd, out = []) {
      if (internal(nd)) { leavesAt(nd.left, out); leavesAt(nd.right, out); } else out.push(nd);
      return out;
    }
    function splitsAt(nd, out = []) {
      if (internal(nd)) { out.push(nd); splitsAt(nd.left, out); splitsAt(nd.right, out); }
      return out;
    }
    const disp = (nd) => (internal(nd)
      ? { tone: 'split', lines: [String(nd.order)], children: [disp(nd.left), disp(nd.right)] }
      : { tone: nd.value >= 0 ? 'a' : 'b', lines: [''] });

    function draw() {
      runs.forEach((r) => {
        const f = r.f;
        V.clear(r.boxG); V.clear(r.cutG);
        leavesAt(r.root).forEach((lf) => {
          const [[x0, x1], [y0, y1]] = lf.box;
          V.el('rect', {
            x: f.sx(x0), y: f.sy(y1), width: f.sx(x1) - f.sx(x0), height: f.sy(y0) - f.sy(y1),
            fill: lf.value >= 0 ? 'var(--pos)' : 'var(--neg)', 'fill-opacity': 0.06 + 0.3 * Math.min(1, Math.abs(lf.value)),
            stroke: 'var(--card)', 'stroke-width': 2,
          }, r.boxG);
        });
        splitsAt(r.root).forEach((nd) => {
          const [[x0, x1], [y0, y1]] = nd.box;
          const cx = nd.f === 0 ? f.sx(nd.thr) : (f.sx(x0) + f.sx(x1)) / 2;
          const cy = nd.f === 0 ? (f.sy(y0) + f.sy(y1)) / 2 : f.sy(nd.thr);
          V.el('circle', { cx, cy, r: V.pick(9, 10), fill: 'var(--ink)', stroke: 'var(--card)', 'stroke-width': 1.5 }, r.cutG);
          V.text(r.cutG, cx, cy + 3.5, String(nd.order), { 'text-anchor': 'middle', 'font-size': V.pick(10, 11), fill: 'var(--paper)', 'font-weight': 600 });
        });
        V.tree(r.tree, disp(r.root), { W: TW, H: TH, boxW: 22, boxH: 18, font: 10 });
        document.getElementById(`gw-${r.policy}-err`).textContent = `· error ${r.snapshots[k].loss.toFixed(2)}`;
      });
      mark.setAttribute('x1', fc.sx(k + 1)); mark.setAttribute('x2', fc.sx(k + 1));
      runs.forEach((r, i) => { dots[i].setAttribute('cx', fc.sx(k + 1)); dots[i].setAttribute('cy', fc.sy(r.snapshots[k].loss)); });
      document.getElementById('gw-n').textContent = k + 1;
      const a = runs[0].snapshots[k].loss, b = runs[1].snapshots[k].loss;
      document.getElementById('gw-say').innerHTML = !k
        ? 'One leaf: every dot gets the same answer. Press <b>Step</b>.'
        : `<b>${k + 1}</b> leaves each. Level-wise error <b>${a.toFixed(2)}</b>, leaf-wise error <b>${b.toFixed(2)}</b>.` +
          (b < a - 0.02 ? ' Leaf-wise is ahead: it put its splits where the mistakes were, even if that makes the tree lopsided.' : ' Same so far: both happened to pick the same splits.');
    }
    V.player({ host: root, speed: 800, canStep: () => k < steps, step: () => { k++; draw(); }, reset: () => { k = 0; draw(); } });
    k = Math.min(steps, Number(new URLSearchParams(location.hash.slice(1)).get('lw')) || 0);
    draw();
  })();

  // ===================================================================
  // 3. GOSS
  // ===================================================================
  (function gossViz() {
    const root = document.getElementById('gs-viz');
    const N = 100;
    const rg = V.rng(17);
    const grads = Array.from({ length: N }, () => Math.abs(rg.normal()) ** 1.6 + 0.02).sort((a, b) => b - a);
    const trueTotal = sum(grads);
    let seed = 1;
    const W = V.pick(1000, 340), H = 230;
    const s = V.svg(root.querySelector('.plot'), W, H, 'One bar per dot, sorted from biggest leftover to smallest');

    function draw() {
      const a = aS.value / 100, b = bS.value / 100;
      const nTop = Math.round(a * N);
      const nOther = Math.min(N - nTop, Math.round(b * N));
      const w = (1 - a) / b;
      const r = V.rng(seed * 7919);
      const sampled = new Set(r.shuffle(Array.from({ length: N - nTop }, (_, i) => nTop + i)).slice(0, nOther));
      const est = sum(grads.slice(0, nTop)) + w * [...sampled].reduce((acc, i) => acc + grads[i], 0);

      V.clear(s);
      const ymax = grads[0] * 1.08;          // scale to the hardest dot; tall weighted bars get clipped
      const f = V.frame({ W, H, m: { t: 12, r: 10, b: 24, l: 40 }, x: [0, N], y: [0, ymax] });
      V.axes(s, f, { xVals: [], yTicks: 3, fmtY: (v) => v.toFixed(1), yLabel: 'leftover size' });
      const bw = f.iw / N - V.pick(2, 0.6);
      let anyClipped = false;
      grads.forEach((g, i) => {
        const x = f.sx(i) + 1;
        if (sampled.has(i)) {
          const clipped = g * w > ymax;
          const yw = f.sy(Math.min(g * w, ymax));
          V.el('rect', { x, y: yw, width: bw, height: f.bottom - yw, rx: 2, fill: 'var(--c1-wash)', stroke: 'var(--c1)', 'stroke-width': 0.8 }, s);
          if (clipped) {
            anyClipped = true;
            if (!V.phone) V.text(s, x + bw / 2, f.top + 9, '↑', { class: 'lbl-sm', 'text-anchor': 'middle' });
          }
        }
        const y = f.sy(g);
        const fill = i < nTop ? 'var(--c2)' : sampled.has(i) ? 'var(--c1)' : 'var(--rule)';
        V.el('rect', { x, y, width: bw, height: Math.max(0.5, f.bottom - y), rx: 2, fill }, s);
      });
      const bx = f.sx(nTop);
      V.el('line', { x1: bx, x2: bx, y1: f.top, y2: f.bottom, stroke: 'var(--ink)', 'stroke-width': 1.2 }, s);
      // Phone bars are too thin for one arrow each, so one note says it instead.
      if (anyClipped && V.phone) V.text(s, f.right, f.top + 9, '↑ = bar cut off', { class: 'lbl-sm', 'text-anchor': 'end' });
      V.text(s, bx + 6, f.top + 28, V.pick(`← hardest ${Math.round(a * 100)}%, always kept`, `← top ${Math.round(a * 100)}% kept`), { class: 'lbl halo' });

      document.getElementById('gs-used').textContent = nTop + nOther;
      document.getElementById('gs-w').textContent = '×' + (Math.round(w * 10) / 10);
      document.getElementById('gs-true').textContent = trueTotal.toFixed(1);
      document.getElementById('gs-est').textContent = est.toFixed(1);
      document.getElementById('gs-say').innerHTML =
        `This tree looks at only <b>${nTop + nOther}</b> of 100 dots. The <b>${nTop}</b> hardest are always kept. ` +
        `<b>${nOther}</b> easy dots are picked at random, and each one counts <b>×${Math.round(w * 10) / 10}</b> to stand in for all ${N - nTop} easy dots. ` +
        `Estimated total ${est.toFixed(1)} vs true ${trueTotal.toFixed(1)}. Press "New random sample" to see it wobble, but stay close.`;
    }
    const aS = V.slider('gs-a', () => draw(), (v) => v + '%');
    const bS = V.slider('gs-b', () => draw(), (v) => v + '%');
    document.getElementById('gs-new').addEventListener('click', () => { seed++; draw(); });
    draw();
  })();

  // ===================================================================
  // 4. EFB: bundle never-together columns
  // ===================================================================
  (function efbViz() {
    const root = document.getElementById('ef-viz');
    const feats = [
      ['is_red', 'var(--c2)', 'var(--c2-wash)'],
      ['is_green', 'var(--c3)', 'var(--c3-wash)'],
      ['is_blue', 'var(--c1)', 'var(--c1-wash)'],
      ['is_yellow', 'var(--c4)', 'var(--c4-wash)'],
    ];
    const hot = [0, 2, 1, 3, 2, 0, 1, 2];   // which column is 1 in each row
    const W = V.pick(560, 340), H = 330;
    const s = V.svg(root.querySelector('.plot'), W, H, 'A small table of four mostly-empty columns, and the same data packed into one column');

    function cell(x, y, w, h, fill, stroke, label, strong) {
      V.el('rect', { x, y, width: w, height: h, rx: 6, fill, stroke, 'stroke-width': 1 }, s);
      V.text(s, x + w / 2, y + h / 2 + 4.5, label, { 'text-anchor': 'middle', 'font-size': 13, 'font-weight': strong ? 600 : 400, fill: strong ? 'var(--ink)' : 'var(--muted)' });
    }
    function draw(mode) {
      V.clear(s);
      const top = 36, rowH = 34, left = V.pick(64, 46);
      hot.forEach((_, r) => V.text(s, 8, top + r * rowH + rowH / 2 + 4, `row ${r + 1}`, { class: 'lbl-sm' }));
      if (mode === 'before') {
        const colW = V.pick(118, (W - left) / 4);
        feats.forEach(([name], c) => V.text(s, left + c * colW + colW / 2, 22, name, { class: 'lbl', 'text-anchor': 'middle' }));
        hot.forEach((h, r) => feats.forEach(([, col, wash], c) => {
          const on = c === h;
          cell(left + c * colW + 4, top + r * rowH + 3, colW - 8, rowH - 6, on ? wash : 'var(--paper)', on ? col : 'var(--rule)', on ? '1' : '0', on);
        }));
      } else {
        const colW = V.pick(190, 150);
        V.text(s, left + colW / 2, 22, 'color_bundle', { class: 'lbl', 'text-anchor': 'middle' });
        hot.forEach((h, r) => {
          const [name, col, wash] = feats[h];
          cell(left + 4, top + r * rowH + 3, colW - 8, rowH - 6, wash, col, `${h + 1}   (${name.replace('is_', '')})`, true);
        });
        const lx = left + colW + V.pick(40, 16);
        V.text(s, lx, 60, 'The offsets:', { class: 'lbl-strong' });
        feats.forEach(([name, col], i) => {
          V.el('rect', { x: lx, y: 76 + i * 28, width: 12, height: 12, rx: 3, fill: col }, s);
          V.text(s, lx + 20, 86 + i * 28, `${name.replace('is_', '')} → ${i + 1}`, { class: 'lbl' });
        });
        V.pick(['Every value still means', 'exactly one thing.'], ['Each value still', 'means exactly', 'one thing.'])
          .forEach((t, i) => V.text(s, lx, 206 + i * 16, t, { class: 'lbl-sm' }));
      }
      document.getElementById('ef-cols').textContent = mode === 'before' ? 4 : 1;
      document.getElementById('ef-say').innerHTML = mode === 'before'
        ? 'Four columns, but each row has only one <b>1</b>. Most of the table is zeros: wasted work for every split search.'
        : 'Now it is <b>one</b> column. Because the old columns never had a 1 in the same row, nothing is lost. 4× less work for these features.';
    }
    V.seg('ef-mode', draw);
    draw('before');
  })();
})();
