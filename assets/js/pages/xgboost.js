/* Chapter 03: XGBoost. Slope+curve steps, split scorecard, pruning, missing values. */
(() => {
  const f2 = (v) => (Math.abs(v) < 0.005 ? '0.00' : v.toFixed(2));
  const sig = (z) => 1 / (1 + Math.exp(-z));
  const sum = (a) => a.reduce((s, v) => s + v, 0);

  const drawTree = V.tree;   // shared tree diagram helper (viz.js)

  // ===================================================================
  // 1. Slope-only walker vs slope + curve walker
  // ===================================================================
  (function newtonViz() {
    const root = document.getElementById('nt-viz');
    // Loss of one leaf holding 3 "yes" dots and 1 "no" dot, as a function of the leaf value F.
    const L = (F) => 3 * Math.log(1 + Math.exp(-F)) + Math.log(1 + Math.exp(F));
    const G = (F) => -3 * sig(-F) + sig(F);
    const Hc = (F) => 4 * sig(F) * (1 - sig(F));
    const BEST = Math.log(3);
    const F0 = -1.2, LR = 0.25, MAXS = 12;
    let gd, nw, trailG, trailN, steps;

    const W = V.pick(520, 340), H = V.pick(330, 260);
    const s = V.svg(root.querySelector('.plot'), W, H, 'A loss bowl with two walkers heading to the bottom');
    const f = V.frame({ W, H, m: { t: 16, r: 16, b: 38, l: 42 }, x: [-2, 4], y: [1.5, 6.6] });
    const defs = V.el('defs', {}, s);
    const cp = V.el('clipPath', { id: 'nt-clip' }, defs);
    V.el('rect', { x: f.left, y: f.top, width: f.iw, height: f.ih }, cp);
    V.axes(s, f, { xTicks: 6, yTicks: 4, xLabel: 'leaf value', yLabel: 'loss' });
    const xs = Array.from({ length: 241 }, (_, i) => -2 + i / 40);
    V.el('path', { d: V.line(xs.map((x) => [f.sx(x), f.sy(L(x))])), fill: 'none', stroke: 'var(--ink-2)', 'stroke-width': 2.5 }, s);
    V.el('line', { x1: f.sx(BEST), x2: f.sx(BEST), y1: f.sy(L(BEST)) + 6, y2: f.bottom, stroke: 'var(--good)', 'stroke-width': 1.2 }, s);
    V.text(s, f.sx(BEST) + 5, f.bottom - 6, 'bottom', { class: 'lbl-sm' });
    const dyn = V.el('g', {}, s);

    const lamS = V.slider('nt-lam', () => reset(), (v) => Number(v).toFixed(1));

    function draw() {
      const lam = lamS.value;
      V.clear(dyn);
      // the matching bowl at the smart walker's spot (curve h + lambda)
      const g = G(nw), hh = Hc(nw) + lam;
      const q = (F) => L(nw) + g * (F - nw) + 0.5 * hh * (F - nw) ** 2;
      const qs = xs.filter((x) => Math.abs(x - nw) < 2.6);
      V.el('path', { d: V.line(qs.map((x) => [f.sx(x), f.sy(q(x))])), fill: 'none', stroke: 'var(--c1)', 'stroke-width': 1.8, 'stroke-opacity': 0.45, 'clip-path': 'url(#nt-clip)' }, dyn);
      trailG.slice(0, -1).forEach((F) => V.el('circle', { cx: f.sx(F), cy: f.sy(L(F)), r: 3.5, fill: 'var(--c2)', 'fill-opacity': 0.35 }, dyn));
      trailN.slice(0, -1).forEach((F) => V.el('circle', { cx: f.sx(F), cy: f.sy(L(F)), r: 3.5, fill: 'var(--c1)', 'fill-opacity': 0.35 }, dyn));
      V.el('circle', { cx: f.sx(nw), cy: f.sy(L(nw)), r: 10, fill: 'var(--c1)', stroke: 'var(--card)', 'stroke-width': 2 }, dyn);
      V.el('circle', { cx: f.sx(gd), cy: f.sy(L(gd)), r: 5, fill: 'var(--c2)', stroke: 'var(--card)', 'stroke-width': 2 }, dyn);

      const dG = Math.abs(gd - BEST), dN = Math.abs(nw - BEST);
      document.getElementById('nt-gd').textContent = f2(dG);
      document.getElementById('nt-nw').textContent = f2(dN);
      const say = document.getElementById('nt-say');
      if (!steps) say.innerHTML = 'Both walkers start at the same spot. Press <b>Step</b>.';
      else {
        say.innerHTML = `After <b>${steps}</b> step${steps > 1 ? 's' : ''}: slope-only is <b>${f2(dG)}</b> away, slope + curve is <b>${f2(dN)}</b> away.` +
          (lam > 0 ? ' With the brake on, the smart walker takes shorter, safer jumps.' : ' The smart walker jumps to the bottom of the pale bowl each time.');
      }
    }
    function reset() { gd = F0; nw = F0; trailG = [F0]; trailN = [F0]; steps = 0; draw(); }
    function step() {
      const lam = lamS.value;
      gd -= LR * G(gd);
      nw -= G(nw) / (Hc(nw) + lam);
      trailG.push(gd); trailN.push(nw); steps++;
      draw();
    }
    V.player({ host: root, speed: 700, canStep: () => steps < MAXS, step, reset });
    reset();
  })();

  // ===================================================================
  // 2. The split scorecard
  // ===================================================================
  (function scoreViz() {
    const xs = [1, 2, 3, 4, 5, 6, 7, 8];
    const r = [-3.2, -2.6, -2.9, -0.4, 1.1, 2.8, 3.4, 4.0];
    let k = 3;   // cut after the k-th dot
    const sim = (a, lam) => sum(a) ** 2 / (a.length + lam);
    const gainAt = (c, lam) => sim(r.slice(0, c), lam) + sim(r.slice(c), lam) - sim(r, lam);

    const W = V.pick(460, 340);
    const sp = V.svg('#sc-plot', W, 230, 'Eight dots with leftover bars and a cut line');
    const fp = V.frame({ W, H: 230, m: { t: 12, r: 12, b: 34, l: 34 }, x: [0.4, 8.6], y: [-4.6, 4.6] });
    V.axes(sp, fp, { xVals: xs, yVals: [-4, -2, 0, 2, 4], xLabel: 'feature value' });
    V.el('line', { x1: fp.left, x2: fp.right, y1: fp.sy(0), y2: fp.sy(0), stroke: 'var(--ink-2)', 'stroke-width': 1 }, sp);
    const barG = V.el('g', {}, sp);
    const cutLine = V.el('line', { y1: fp.top, y2: fp.bottom, stroke: 'var(--ink)', 'stroke-width': 2 }, sp);
    const cutKnob = V.el('circle', { cy: fp.top, r: 7, fill: 'var(--ink)', stroke: 'var(--card)', 'stroke-width': 2 }, sp);
    const cutHit = V.el('circle', { cy: fp.top, r: 22, fill: 'transparent', 'data-grip': '' }, sp);   // finger-sized handle

    const sg = V.svg('#sc-gains', W, 150, 'Gain for each of the seven possible cuts');
    const st = V.svg('#sc-tree', W, 250, 'The tree made by this cut');
    const lamS = V.slider('sc-lam', () => draw(), (v) => Number(v).toFixed(1));
    const gamS = V.slider('sc-gam', () => draw());

    function draw() {
      const lam = lamS.value, gam = gamS.value;
      // bars
      V.clear(barG);
      xs.forEach((x, i) => {
        const y0 = fp.sy(0), y1 = fp.sy(r[i]);
        V.el('rect', { x: fp.sx(x) - 9, y: Math.min(y0, y1), width: 18, height: Math.abs(y1 - y0), rx: 3, fill: i < k ? 'var(--c1)' : 'var(--c2)' }, barG);
        V.text(barG, fp.sx(x), r[i] >= 0 ? y1 - 5 : y1 + 13, r[i].toFixed(1), { class: 'lbl-sm', 'text-anchor': 'middle' });
      });
      const cx = fp.sx(k + 0.5);
      cutLine.setAttribute('x1', cx); cutLine.setAttribute('x2', cx); cutKnob.setAttribute('cx', cx); cutHit.setAttribute('cx', cx);

      // gain bars for every cut
      V.clear(sg);
      const gains = [1, 2, 3, 4, 5, 6, 7].map((c) => gainAt(c, lam));
      const gmax = Math.max(60, ...gains) * 1.08;
      const fg = V.frame({ W, H: 150, m: { t: 14, r: 12, b: 26, l: 34 }, x: [0.4, 8.6], y: [0, gmax] });
      V.axes(sg, fg, { xVals: [1.5, 2.5, 3.5, 4.5, 5.5, 6.5, 7.5], fmtX: (v) => `${v - 0.5}|${v + 0.5}`, yTicks: 3 });
      const best = gains.indexOf(Math.max(...gains)) + 1;
      gains.forEach((gv, i) => {
        const c = i + 1, x = fg.sx(c + 0.5), y = fg.sy(Math.max(0, gv));
        V.el('rect', {
          x: x - 11, y, width: 22, height: Math.max(0.5, fg.bottom - y), rx: 3,
          fill: c === k ? 'var(--ink)' : 'var(--c3)', 'fill-opacity': gv > gam ? 1 : 0.3,
        }, sg);
        if (c === best) V.text(sg, x, y - 5, 'best', { class: 'lbl-sm', 'text-anchor': 'middle' });
      });
      if (gam > 0) {
        const gy = fg.sy(Math.min(gam, gmax));
        V.el('line', { x1: fg.left, x2: fg.right, y1: gy, y2: gy, stroke: 'var(--c4)', 'stroke-width': 2 }, sg);
        V.text(sg, fg.right, gy - 5, `fee γ = ${gam}`, { class: 'lbl', 'text-anchor': 'end' });
      }

      // tree
      const Lr = r.slice(0, k), Rr = r.slice(k);
      const sP = sim(r, lam), sL = sim(Lr, lam), sR = sim(Rr, lam), gain = sL + sR - sP;
      const kept = gain > gam;
      drawTree(st, {
        tone: 'split',
        lines: [kept ? `cut between ${k} and ${k + 1}` : 'no split (pruned)', `all 8 dots, sum ${f2(sum(r))}`, `similarity ${f2(sP)}`, `gain ${f2(gain)} ${kept ? '> ' : '≤ '}γ ${gam}`],
        children: [
          { tone: 'a', faded: !kept, lines: [`left: ${Lr.length} dots`, `sum ${f2(sum(Lr))}`, `similarity ${f2(sL)}`, `output ${f2(sum(Lr) / (Lr.length + lam))}`] },
          { tone: 'b', faded: !kept, lines: [`right: ${Rr.length} dots`, `sum ${f2(sum(Rr))}`, `similarity ${f2(sR)}`, `output ${f2(sum(Rr) / (Rr.length + lam))}`] },
        ],
      }, { W, H: 250, boxW: V.pick(176, 160), boxH: 80, font: 12 });

      document.getElementById('sc-say').innerHTML =
        `Gain = ${f2(sL)} + ${f2(sR)} − ${f2(sP)} = <b>${f2(gain)}</b>. ` +
        (kept ? `That beats the fee γ = ${gam}, so the split is <b>kept</b>.` : `That does not beat the fee γ = ${gam}, so the split is <b>pruned</b>: the group stays one leaf.`) +
        (lam > 0 ? ` λ = ${lam} is added to every count, so similarities and outputs shrink.` : ' With λ = 0, each output is just the average leftover of its side.');
    }

    V.drag(sp, sp, (_, q) => {
      const nk = V.clamp(Math.round(fp.sx.inv(q.x) - 0.5), 1, 7);
      if (nk !== k) { k = nk; draw(); }
    });
    document.getElementById('sc-best').addEventListener('click', () => {
      const lam = lamS.value;
      const gains = [1, 2, 3, 4, 5, 6, 7].map((c) => gainAt(c, lam));
      k = gains.indexOf(Math.max(...gains)) + 1;
      draw();
    });
    draw();
  })();

  // ===================================================================
  // 3. A whole tree, pruned live
  // ===================================================================
  (function pruneViz() {
    const d = V.wave(30, 4, 0.4);
    const X = d.x.map((v) => [v]);
    const avg = ML.mean(d.y);
    const leftover = d.y.map((v) => v - avg);
    const g = leftover.map((v) => -v), h = leftover.map(() => 1);

    const W = V.pick(520, 340), HF = V.pick(250, 220);
    // Phones get a sideways tree (root on the left) so the 8 leaves have room.
    const treeOpts = V.pick({ W, H: 300, boxW: 60, boxH: 36, font: 10.5 }, { W, H: 360, boxW: 78, boxH: 34, font: 11, horizontal: true });
    const sTree = V.svg('#pr-tree', W, treeOpts.H, 'A depth-3 XGBoost tree; pruned parts are faded');
    const sFit = V.svg('#pr-fit', W, HF, 'Leftovers and the tree output as a step line');
    const ff = V.frame({ W, H: HF, m: { t: 12, r: 12, b: 30, l: 36 }, x: [0, 10], y: [-3.4, 3.4] });
    V.axes(sFit, ff, { xTicks: 5, yTicks: 4, xLabel: 'feature value' });
    V.el('line', { x1: ff.left, x2: ff.right, y1: ff.sy(0), y2: ff.sy(0), stroke: 'var(--ink-2)', 'stroke-width': 1 }, sFit);
    d.x.forEach((x, i) => V.el('circle', { cx: ff.sx(x), cy: ff.sy(leftover[i]), r: 4, fill: 'var(--ink-2)', 'fill-opacity': 0.55 }, sFit));
    const fullPath = V.el('path', { fill: 'none', stroke: 'var(--rule-2)', 'stroke-width': 2 }, sFit);
    const fitPath = V.el('path', { fill: 'none', stroke: 'var(--c1)', 'stroke-width': 2.5, 'stroke-linejoin': 'round' }, sFit);
    const lamS = V.slider('pr-lam', () => update());
    const gamS = V.slider('pr-gam', () => update(), (v) => Number(v).toFixed(1));
    const xs = Array.from({ length: 401 }, (_, i) => i / 40);

    function update() {
      const lam = lamS.value, gam = gamS.value;
      const tree = ML.fitXgbTree(X, g, h, { maxDepth: 3, lambda: lam, gamma: 0 });
      // mark pruning bottom-up: a split is cut if both children are (now) leaves and gain < gamma
      (function mark(n) {
        if (n.leaf) return;
        mark(n.left); mark(n.right);
        const isLeaf = (c) => c.leaf || c.cut;
        n.cut = isLeaf(n.left) && isLeaf(n.right) && n.gain < gam;
      })(tree);
      const eff = (n, x) => { while (!(n.leaf || n.cut)) n = x <= n.thr ? n.left : n.right; return n.value; };
      const full = (n, x) => { while (!n.leaf) n = x <= n.thr ? n.left : n.right; return n.value; };

      let leaves = 0, pruned = 0;
      function toDisp(n, faded) {
        if (n.leaf) {
          if (!faded) leaves++;
          return { tone: 'a', faded, lines: [`out ${f2(n.value)}`, `${n.n} dot${n.n === 1 ? '' : 's'}`] };
        }
        if (n.cut && !faded) { leaves++; }
        if (n.cut || faded) pruned++;
        const lines = n.cut && !faded
          ? [`out ${f2(n.value)}`, `✂ gain ${f2(n.gain)}`]
          : [`x ≤ ${n.thr.toFixed(1)}`, `gain ${f2(n.gain)}`];
        return {
          tone: n.cut && !faded ? 'a' : 'split', faded,
          lines,
          children: [toDisp(n.left, faded || n.cut), toDisp(n.right, faded || n.cut)],
        };
      }
      drawTree(sTree, toDisp(tree, false), treeOpts);
      fullPath.setAttribute('d', V.line(xs.map((x) => [ff.sx(x), ff.sy(full(tree, x))])));
      fitPath.setAttribute('d', V.line(xs.map((x) => [ff.sx(x), ff.sy(eff(tree, x))])));
      document.getElementById('pr-leaves').textContent = leaves;
      document.getElementById('pr-pruned').textContent = pruned;
    }
    update();
  })();

  // ===================================================================
  // 4. Missing values: try both sides
  // ===================================================================
  (function missingViz() {
    const known = [[1, -3.0], [2, -2.5], [3, -2.8], [5, 2.6], [6, 3.1], [7, 2.9]];
    const missing = [2.4, 3.0, -0.2];
    const LAM = 1, CUT = 4;
    const sim = (a) => sum(a) ** 2 / (a.length + LAM);

    const W = V.pick(900, 340), H = V.pick(170, 190);
    const s = V.svg('#ms-line', W, H, 'Known dots on a number line and three dots with missing values');
    const f = V.frame({ W, H, m: { t: 12, r: 12, b: 30, l: 34 }, x: [0.3, 10.2], y: [-3.6, 3.6] });
    V.axes(s, f, { xVals: [1, 2, 3, 4, 5, 6, 7], yVals: [-3, 0, 3] });
    V.el('line', { x1: f.left, x2: f.sx(7.8), y1: f.sy(0), y2: f.sy(0), stroke: 'var(--ink-2)', 'stroke-width': 1 }, s);
    const bar = (x, v, col, w = V.pick(18, 13)) => {
      const y0 = f.sy(0), y1 = f.sy(v);
      V.el('rect', { x: f.sx(x) - w / 2, y: Math.min(y0, y1), width: w, height: Math.abs(y1 - y0), rx: 3, fill: col }, s);
    };
    known.forEach(([x, v]) => bar(x, v, x <= CUT ? 'var(--c1)' : 'var(--c2)'));
    V.el('line', { x1: f.sx(CUT), x2: f.sx(CUT), y1: f.top, y2: f.bottom, stroke: 'var(--ink)', 'stroke-width': 2 }, s);
    V.text(s, f.sx(CUT) - 6, f.top + 12, 'cut: x ≤ 4 ?', { class: 'lbl halo', 'text-anchor': 'end' });   // left side is empty up top
    V.el('rect', { x: f.sx(8.1), y: f.top, width: f.sx(10.2) - f.sx(8.1), height: f.ih, rx: 10, fill: 'var(--c4-wash)' }, s);
    V.text(s, f.sx(9.15), f.bottom - 8, V.pick('missing (?)', 'missing'), { class: 'lbl', 'text-anchor': 'middle' });
    V.el('line', { x1: f.sx(8.2), x2: f.sx(10.1), y1: f.sy(0), y2: f.sy(0), stroke: 'var(--ink-2)', 'stroke-width': 1 }, s);
    missing.forEach((v, i) => bar(8.6 + i * 0.55, v, 'var(--c4)', V.pick(16, 11)));

    const leftK = known.filter(([x]) => x <= CUT).map((p) => p[1]);
    const rightK = known.filter(([x]) => x > CUT).map((p) => p[1]);
    const all = [...leftK, ...rightK, ...missing];
    const options = [
      { side: 'LEFT', L: [...leftK, ...missing], R: rightK, host: '#ms-left' },
      { side: 'RIGHT', L: leftK, R: [...rightK, ...missing], host: '#ms-right' },
    ].map((o) => ({ ...o, gain: sim(o.L) + sim(o.R) - sim(all) }));
    const win = options[0].gain > options[1].gain ? 0 : 1;
    const TW = V.pick(440, 340), TH = V.pick(200, 190);

    options.forEach((o, i) => {
      const host = document.querySelector(o.host);
      host.innerHTML = `<div class="panel-title">Send missing ${o.side} ${i === win ? '<span class="badge">chosen ✓</span>' : ''}</div>`;
      const sv = V.svg(host, TW, TH, `Tree when missing values go ${o.side.toLowerCase()}`);
      if (i !== win) sv.style.opacity = 0.6;
      drawTree(sv, {
        tone: 'split', lines: ['x ≤ 4 ?', `? goes ${o.side.toLowerCase()}`, `gain ${f2(o.gain)}`],
        children: [
          { tone: 'a', lines: [`left: ${o.L.length} dots`, `sum ${f2(sum(o.L))}`, `similarity ${f2(sim(o.L))}`] },
          { tone: 'b', lines: [`right: ${o.R.length} dots`, `sum ${f2(sum(o.R))}`, `similarity ${f2(sim(o.R))}`] },
        ],
      }, { W: TW, H: TH, boxW: 150, boxH: 66, font: 11.5 });
    });
    document.getElementById('ms-say').innerHTML =
      `Sending the ? dots <b>${options[win].side.toLowerCase()}</b> gives gain <b>${f2(options[win].gain)}</b>, versus ${f2(options[1 - win].gain)} the other way. ` +
      `So XGBoost remembers: at this split, missing values go <b>${options[win].side.toLowerCase()}</b>. Most of the ? dots look like the right side, and the math agrees.`;
  })();
})();
