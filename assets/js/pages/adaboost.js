/* Chapter 01: AdaBoost. Main stepper + vote-power explorer. */
(() => {
  const POS = 'var(--pos)', NEG = 'var(--neg)';
  const pct = (v) => Math.round(v * 100) + '%';

  // ===================================================================
  // 1. Watch AdaBoost learn
  // ===================================================================
  (function mainViz() {
    const root = document.getElementById('ada-viz');
    const DATA = {
      ring: () => V.ring(140, 11),
      moons: () => V.moons(140, 0.12, 5),
      // Flip the labels of 6 dots that sit deep inside the "wrong" area: they can never be fixed.
      noisy: () => {
        const d = V.ring(140, 11);
        const dist = d.X.map((p) => Math.hypot(p[0] - 0.5, (p[1] - 0.5) * 1.1));
        const ids = d.X.map((_, i) => i);
        const deepIn = ids.filter((i) => d.y[i] > 0).sort((a, b) => dist[a] - dist[b]).slice(0, 3);
        const farOut = ids.filter((i) => d.y[i] < 0).sort((a, b) => dist[b] - dist[a]).slice(0, 3);
        const flipped = [...deepIn, ...farOut];
        const y = d.y.slice();
        flipped.forEach((k) => { y[k] = -y[k]; });
        return { X: d.X, y, flipped };
      },
    };
    const MAX = 60;
    let data, model, accs, view = 'team', f;

    const W = V.pick(520, 340), H = V.pick(460, 320);
    const s = V.svg(root.querySelector('.plot'), W, H, 'Dots whose size shows their weight, with straight cuts from each helper');
    const bg = V.el('g', {}, s);
    const axG = V.el('g', {}, s);
    const cutG = V.el('g', {}, s);
    const ptsG = V.el('g', {}, s);
    const ringG = V.el('g', {}, s);
    let dots = [];

    // side charts
    const aw = 320;
    const sAcc = V.svg('#ada-acc-chart', aw, 150, 'Team accuracy after each round');
    const fa = V.frame({ W: aw, H: 150, m: { t: 10, r: 12, b: 26, l: 38 }, x: [0, MAX], y: [0.5, 1] });
    V.axes(sAcc, fa, { xVals: [0, 20, 40, 60], yVals: [0.5, 0.75, 1], fmtY: pct });
    const accPath = V.el('path', { fill: 'none', stroke: 'var(--ink-2)', 'stroke-width': 2 }, sAcc);
    const accDot = V.el('circle', { r: 4.5, fill: 'var(--ink-2)', stroke: 'var(--card)', 'stroke-width': 2 }, sAcc);
    const sAl = V.svg('#ada-alpha-chart', aw, 120, 'Vote power of each helper, one bar per round');
    const alphaG = V.el('g', {}, sAl);

    const dotScale = V.pick(1, 0.8);   // smaller plot on phones, so slightly smaller dots
    function radius(w, n) { return dotScale * V.clamp(2.6 + Math.sqrt(w * n) * 3.4, 2.6, 17); }

    function setup(name) {
      data = DATA[name]();
      model = new ML.AdaBoost(data.X, data.y);
      accs = [];
      const ext = (k) => [Math.min(...data.X.map((p) => p[k])) - 0.04, Math.max(...data.X.map((p) => p[k])) + 0.04];
      f = V.frame({ W, H, m: { t: 14, r: 14, b: 34, l: 38 }, x: ext(0), y: ext(1) });
      V.clear(axG);
      V.axes(axG, f, { xTicks: 5, yTicks: 5, fmtX: (v) => v.toFixed(1), fmtY: (v) => v.toFixed(1), grid: false });
      V.clear(ptsG);
      dots = data.X.map((p, i) => V.el('circle', {
        cx: f.sx(p[0]), cy: f.sy(p[1]), r: radius(1 / data.X.length, data.X.length),
        fill: data.y[i] > 0 ? POS : NEG, stroke: 'var(--card)', 'stroke-width': 1.5, class: 'grow',
      }, ptsG));
      draw();
    }

    function question(st) {
      return `is feature ${st.f + 1} > ${st.thr.toFixed(2)}?`;
    }

    function draw() {
      const T = model.rounds.length;
      const n = data.X.length;
      const last = model.rounds[T - 1];

      // shading
      V.clear(bg);
      if (T > 0) {
        if (view === 'team') {
          // Normalise by the total vote power, then stretch with tanh so the shape stays readable.
          const total = model.rounds.reduce((a, r) => a + Math.abs(r.alpha), 0) || 1;
          V.regions(bg, f, (x, y) => Math.tanh((3 * model.score([x, y])) / total), { strength: 0.3 });
        } else {
          V.regions(bg, f, (x, y) => last.stump.predict([x, y]) * 0.55, { strength: 0.34 });
        }
      }

      // newest helper's cut
      V.clear(cutG);
      if (last) {
        const st = last.stump;
        if (st.f === 0) {
          const x = f.sx(st.thr);
          V.el('line', { x1: x, x2: x, y1: f.top, y2: f.bottom, stroke: 'var(--ink)', 'stroke-width': 2 }, cutG);
          V.text(cutG, x + 6, f.top + 12, `helper #${T}`, { class: 'lbl-sm' });
        } else {
          const y = f.sy(st.thr);
          V.el('line', { x1: f.left, x2: f.right, y1: y, y2: y, stroke: 'var(--ink)', 'stroke-width': 2 }, cutG);
          V.text(cutG, f.left + 6, y - 6, `helper #${T}`, { class: 'lbl-sm' });
        }
      }

      // dot sizes = current weights; rings = missed by newest helper
      dots.forEach((d, i) => d.setAttribute('r', radius(model.w[i], n)));
      V.clear(ringG);
      if (last) {
        last.wrong.forEach((isWrong, i) => {
          if (!isWrong) return;
          V.el('circle', {
            cx: f.sx(data.X[i][0]), cy: f.sy(data.X[i][1]), r: radius(model.w[i], n) + 2.5,
            fill: 'none', stroke: 'var(--ink-2)', 'stroke-width': 1, 'stroke-opacity': 0.8,
          }, ringG);
        });
      }
      if (data.flipped) {
        data.flipped.forEach((i) => V.text(ringG, f.sx(data.X[i][0]), f.sy(data.X[i][1]) - radius(model.w[i], n) - 5, '!', {
          class: 'lbl-strong', 'text-anchor': 'middle',
        }));
      }

      // stats
      document.getElementById('ada-t').textContent = T;
      document.getElementById('ada-err').textContent = last ? pct(last.err) : '·';
      document.getElementById('ada-alpha').textContent = last ? last.alpha.toFixed(2) : '·';
      document.getElementById('ada-acc').textContent = T ? pct(accs[T - 1]) : '·';

      // accuracy chart
      const pts = accs.map((a, k) => [fa.sx(k + 1), fa.sy(a)]);
      accPath.setAttribute('d', pts.length ? V.line(pts) : '');
      accDot.setAttribute('visibility', pts.length ? 'visible' : 'hidden');
      if (pts.length) { accDot.setAttribute('cx', pts[pts.length - 1][0]); accDot.setAttribute('cy', pts[pts.length - 1][1]); }

      // vote power bars
      V.clear(alphaG);
      const maxA = Math.max(1, ...model.rounds.map((r) => r.alpha));
      const fb = V.frame({ W: aw, H: 120, m: { t: 10, r: 12, b: 24, l: 38 }, x: [0.5, MAX + 0.5], y: [0, maxA] });
      V.axes(alphaG, fb, { xVals: [1, 20, 40, 60], yVals: [0, +(maxA / 2).toFixed(1), +maxA.toFixed(1)] });
      const bw = Math.max(1.5, fb.iw / MAX - 2);
      model.rounds.forEach((r, k) => {
        const x = fb.sx(k + 1) - bw / 2, y = fb.sy(Math.max(0, r.alpha));
        V.el('rect', { x, y, width: bw, height: Math.max(0.5, fb.bottom - y), rx: Math.min(2, bw / 2), fill: k === T - 1 ? 'var(--ink)' : 'var(--c3)' }, alphaG);
      });

      // words
      const say = document.getElementById('ada-say');
      if (!last) {
        say.innerHTML = 'All dots start with the <b>same weight</b>. Press <b>Step</b> to train the first helper.';
      } else {
        const yes = last.stump.pol > 0 ? 'class A' : 'class B';
        say.innerHTML = `Helper <b>#${T}</b> asked <b>"${question(last.stump)}"</b> (yes → ${yes}). ` +
          `It missed <b>${pct(last.err)}</b> of the weight, so its vote power is <b>${last.alpha.toFixed(2)}</b>. ` +
          'The circled dots just got heavier.';
      }
      if (data.flipped) {
        const share = data.flipped.reduce((a, i) => a + model.w[i], 0);
        say.innerHTML += ` <br>The ${data.flipped.length} wrong-label dots (marked <b>!</b>) are ${pct(data.flipped.length / n)} of the data` +
          ` but hold <b>${pct(share)}</b> of the weight.`;
      }
    }

    function step() {
      model.step();
      accs.push(model.accuracy());
      draw();
    }

    V.player({ host: root, speed: 520, canStep: () => model.rounds.length < MAX, step, reset: () => setup(dataSeg.value) });
    const dataSeg = V.seg('ada-data', (v) => setup(v));
    V.seg('ada-view', (v) => { view = v; draw(); });

    // Optional deep link, e.g. #ada=25&data=noisy : start already 25 rounds in.
    const hash = new URLSearchParams(location.hash.slice(1));
    const startData = DATA[hash.get('data')] ? hash.get('data') : 'ring';
    if (startData !== 'ring') dataSeg.set(startData); else setup('ring');
    for (let k = Math.min(MAX, Number(hash.get('ada')) || 0); k > 0; k--) step();
  })();

  // ===================================================================
  // 2. How loud is each helper? (alpha vs error)
  // ===================================================================
  (function alphaViz() {
    const root = document.getElementById('alpha-viz');
    const alpha = (e) => 0.5 * Math.log((1 - e) / e);
    const W = V.pick(520, 340), H = V.pick(320, 260);
    const s = V.svg(root.querySelector('.plot'), W, H, 'Vote power alpha for every error from 0 to 1');
    const f = V.frame({ W, H, m: { t: 18, r: 16, b: 38, l: 42 }, x: [0, 1], y: [-2.5, 2.5] });
    V.el('rect', { x: f.left, y: f.top, width: f.sx(0.5) - f.left, height: f.ih, fill: 'var(--c3-wash)' }, s);
    V.el('rect', { x: f.sx(0.5), y: f.top, width: f.right - f.sx(0.5), height: f.ih, fill: 'var(--c4-wash)' }, s);
    V.axes(s, f, { xVals: [0, 0.25, 0.5, 0.75, 1], yVals: [-2, -1, 0, 1, 2], xLabel: 'helper\'s error ε', yLabel: 'vote power α' });
    V.el('line', { x1: f.left, x2: f.right, y1: f.sy(0), y2: f.sy(0), stroke: 'var(--rule-2)', 'stroke-width': 1.5 }, s);
    V.text(s, f.left + 8, f.top + 16, 'better than a coin flip', { class: 'lbl' });
    V.text(s, f.right - 8, f.bottom - 10, 'worse than a coin flip', { class: 'lbl', 'text-anchor': 'end' });
    const es = Array.from({ length: 200 }, (_, i) => 0.012 + (i * 0.976) / 199);
    V.el('path', { d: V.line(es.map((e) => [f.sx(e), f.sy(V.clamp(alpha(e), -2.5, 2.5))])), fill: 'none', stroke: 'var(--c1)', 'stroke-width': 2.5 }, s);
    const guideV = V.el('line', { stroke: 'var(--ink)', 'stroke-width': 1 }, s);
    const guideH = V.el('line', { stroke: 'var(--ink)', 'stroke-width': 1 }, s);
    const dot = V.el('circle', { r: 6, fill: 'var(--ink)', stroke: 'var(--card)', 'stroke-width': 2 }, s);

    // Two bars: how much correct / missed dots get multiplied by. Columns: label | bar | value.
    const bw = 320, bh = 104;
    const sb = V.svg('#al-bars', bw, bh, 'How much correct and missed dots are multiplied by');
    function bars(a) {
      V.clear(sb);
      const MAXF = 4, LABEL_W = 92, VALUE_W = 72;
      const fx = V.scale(0, MAXF, LABEL_W, bw - VALUE_W);
      const refX = fx(1);
      const rows = [['correct dots', Math.exp(-a), 10], ['missed dots', Math.exp(a), 48]];
      V.el('line', { x1: refX, x2: refX, y1: 4, y2: 78, stroke: 'var(--ink-2)', 'stroke-width': 1 }, sb);
      rows.forEach(([name, factor, y0]) => {
        const end = fx(Math.min(factor, MAXF));
        V.text(sb, 0, y0 + 16, name, { class: 'lbl' });
        V.el('rect', { x: LABEL_W, y: y0 + 4, width: Math.max(1, end - LABEL_W), height: 16, rx: 4, fill: factor >= 1 ? 'var(--c2)' : 'var(--c1)' }, sb);
        V.text(sb, Math.max(end, refX) + 8, y0 + 17, `× ${factor.toFixed(2)}${factor > MAXF ? '+' : ''}`, { class: 'lbl-strong' });
      });
      V.text(sb, refX, bh - 8, '× 1 = no change', { class: 'lbl-sm', 'text-anchor': 'middle' });
    }

    function update(v) {
      const e = v / 100, a = alpha(e);
      const x = f.sx(e), y = f.sy(V.clamp(a, -2.5, 2.5));
      dot.setAttribute('cx', x); dot.setAttribute('cy', y);
      Object.entries({ x1: x, x2: x, y1: f.bottom, y2: y }).forEach(([k, val]) => guideV.setAttribute(k, val));
      Object.entries({ x1: f.left, x2: x, y1: y, y2: y }).forEach(([k, val]) => guideH.setAttribute(k, val));
      document.getElementById('al-e').textContent = e.toFixed(2);
      document.getElementById('al-a').textContent = a.toFixed(2);
      bars(a);
      document.getElementById('al-say').innerHTML =
        Math.abs(e - 0.5) < 0.005 ? '<b>A coin flip.</b> Vote power is zero. Its opinion is worth nothing, and the weights do not change.'
          : e < 0.5 ? `<b>Better than a coin flip</b> → positive voice. Missed dots grow ×${Math.exp(a).toFixed(2)}.`
            : '<b>Worse than a coin flip</b> → negative voice. The team simply does the <b>opposite</b> of what it says!';
    }
    V.slider('al-err', update, (v) => (v / 100).toFixed(2));
    update(20);
  })();
})();
