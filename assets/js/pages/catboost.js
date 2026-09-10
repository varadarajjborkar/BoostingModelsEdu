/* Chapter 05: CatBoost. The leak, the waiting line, symmetric trees. */
(() => {
  const pct = (v) => Math.round(v * 100) + '%';

  // ===================================================================
  // 1. The cheat, caught on camera (leaky vs ordered target encoding)
  // ===================================================================
  (function leakViz() {
    const root = document.getElementById('lk-viz');
    const N = 200, SHOPS = 100, A = 1;
    let seed = 1;
    const W = 520, H = 280;
    const s = V.svg(root.querySelector('.plot'), W, H, 'Accuracy on training rows and new rows, for leaky and ordered encoding');

    // A tiny "model": answer 1 when the encoded number is above a threshold. Pick the best threshold on training rows.
    function fitThreshold(enc, y) {
      const cands = [-1, ...new Set(enc)].sort((a, b) => a - b);
      let best = { acc: 0, t: 0 };
      cands.forEach((t) => {
        const acc = enc.reduce((c, e, i) => c + ((e > t ? 1 : 0) === y[i] ? 1 : 0), 0) / y.length;
        if (acc > best.acc) best = { acc, t };
      });
      return best;
    }
    const accAt = (enc, y, t) => enc.reduce((c, e, i) => c + ((e > t ? 1 : 0) === y[i] ? 1 : 0), 0) / y.length;

    function simulate() {
      const r = V.rng(seed * 101);
      const shop = Array.from({ length: N }, () => r.int(SHOPS));
      const y = Array.from({ length: N }, () => (r() < 0.5 ? 1 : 0));          // pure coin flips
      const shopNew = Array.from({ length: N }, () => r.int(SHOPS));
      const yNew = Array.from({ length: N }, () => (r() < 0.5 ? 1 : 0));
      const p = ML.mean(y);
      const S = {}, C = {};
      shop.forEach((c, i) => { S[c] = (S[c] || 0) + y[i]; C[c] = (C[c] || 0) + 1; });
      const leaky = shop.map((c) => (S[c] + A * p) / (C[c] + A));             // includes its own answer
      const queue = r.shuffle([...Array(N).keys()]);
      const seenS = {}, seenC = {}, ordered = new Array(N);
      queue.forEach((i) => {                                                    // only rows ahead in the line
        const c = shop[i], s0 = seenS[c] || 0, c0 = seenC[c] || 0;
        ordered[i] = (s0 + A * p) / (c0 + A);
        seenS[c] = s0 + y[i]; seenC[c] = c0 + 1;
      });
      const encNew = shopNew.map((c) => ((S[c] || 0) + A * p) / ((C[c] || 0) + A));
      const res = {};
      [['leaky', leaky], ['ordered', ordered]].forEach(([name, enc]) => {
        const fit = fitThreshold(enc, y);
        res[name] = { train: fit.acc, fresh: accAt(encNew, yNew, fit.t) };
      });
      return { res, shop, y, leaky, ordered };
    }

    function draw() {
      const { res, shop, y, leaky, ordered } = simulate();
      V.clear(s);
      const f = V.frame({ W, H, m: { t: 20, r: 12, b: 40, l: 40 }, x: [0, 2], y: [0, 1] });
      V.axes(s, f, { xVals: [], yVals: [0, 0.25, 0.5, 0.75, 1], fmtY: pct });
      const y50 = f.sy(0.5);
      V.el('line', { x1: f.left, x2: f.right, y1: y50, y2: y50, stroke: 'var(--ink)', 'stroke-width': 1 }, s);
      V.text(s, f.sx(1), y50 - 6, 'coin flip = 50%', { class: 'lbl-sm', 'text-anchor': 'middle' });   // sits in the gap between the two groups
      [['leaky', 'Leaky (all rows)'], ['ordered', 'Ordered (CatBoost)']].forEach(([key, label], g) => {
        const cx = f.sx(g + 0.5);
        [['train', 'var(--ink-2)', -1], ['fresh', 'var(--c3)', 1]].forEach(([k, col, side]) => {
          const v = res[key][k];
          const x = cx + side * 30 - 22, yv = f.sy(v);
          V.el('rect', { x, y: yv, width: 44, height: f.bottom - yv, rx: 4, fill: col }, s);
          V.text(s, x + 22, yv - 6, pct(v), { class: 'lbl-strong', 'text-anchor': 'middle' });
        });
        V.text(s, cx, f.bottom + 20, label, { class: 'lbl', 'text-anchor': 'middle' });
      });

      const rowsHtml = [0, 1, 2, 3, 4, 5].map((i) =>
        `<tr><td>shop ${shop[i]}</td><td class="num">${y[i]}</td><td class="num">${leaky[i].toFixed(2)}</td><td class="num">${ordered[i].toFixed(2)}</td></tr>`).join('');
      document.getElementById('lk-table').innerHTML =
        `<div class="table-wrap"><table class="t"><thead><tr><th>shop</th><th>answer</th><th>leaky</th><th>ordered</th></tr></thead><tbody>${rowsHtml}</tbody></table></div>`;
      document.getElementById('lk-say').innerHTML =
        `The answers are coin flips, so an honest model should score about <b>50%</b>. ` +
        `Leaky encoding scores <b>${pct(res.leaky.train)}</b> on its own training rows (it copied the answers!) but only <b>${pct(res.leaky.fresh)}</b> on new rows. ` +
        `Ordered encoding stays honest: <b>${pct(res.ordered.train)}</b> and <b>${pct(res.ordered.fresh)}</b>. Look at the table: the leaky number leans toward each row's own answer.`;
    }
    document.getElementById('lk-new').addEventListener('click', () => { seed++; draw(); });
    draw();
  })();

  // ===================================================================
  // 2. The waiting line (ordered target statistics, step by step)
  // ===================================================================
  (function queueViz() {
    const root = document.getElementById('qu-viz');
    const CITIES = [['Pune', 'a'], ['Delhi', 'b'], ['Chennai', 'c']];
    const rows = [[0, 1], [1, 0], [0, 1], [2, 1], [0, 0], [1, 0], [2, 1], [0, 1], [1, 1], [2, 0]];   // [city, answer], in line order
    const P = 0.5, A = 1;
    let k = -1;

    const ahead = (i) => {
      let S = 0, C = 0;
      for (let j = 0; j < i; j++) if (rows[j][0] === rows[i][0]) { S += rows[j][1]; C++; }
      return { S, C, val: (S + A * P) / (C + A) };
    };

    function render() {
      const body = rows.map(([c, ans], i) => {
        let cls = '';
        if (k >= 0) {
          if (i === k) cls = 'active';
          else if (i > k) cls = 'future';
          else if (c === rows[k][0]) cls = 'seen';
        }
        const num = i <= k ? ahead(i).val.toFixed(2) : '·';
        const ansCell = i === k ? `${ans} <span class="muted">(not used)</span>` : ans;
        return `<tr class="${cls}"><td>${i + 1}</td><td><span class="chip ${CITIES[c][1]}">${CITIES[c][0]}</span></td><td>${ansCell}</td><td>${num}</td></tr>`;
      }).join('');
      document.getElementById('qu-table').innerHTML =
        `<table class="t qt"><thead><tr><th>place in line</th><th>city</th><th>answer</th><th>its number</th></tr></thead><tbody>${body}</tbody></table>`;

      const fEl = document.getElementById('qu-formula');
      const say = document.getElementById('qu-say');
      if (k < 0) {
        fEl.textContent = 'Press Step.';
        say.innerHTML = 'The rows are already shuffled into a line. Press <b>Step</b> to compute each row\'s number, front to back.';
        return;
      }
      const { S, C, val } = ahead(k);
      const city = CITIES[rows[k][0]][0];
      fEl.textContent = `(${S} + 1 × 0.5) / (${C} + 1) = ${val.toFixed(2)}`;
      say.innerHTML = `Row <b>${k + 1}</b> is from <b>${city}</b>. Ahead of it, <b>${C}</b> row${C === 1 ? '' : 's'} from ${city}, with <b>${S}</b> "yes" answer${S === 1 ? '' : 's'}. ` +
        'Its own answer is <b>not</b> used.' + (C === 0 ? ' No history yet, so it simply gets the prior, 0.5.' : '');
    }
    V.player({ host: root, speed: 1100, canStep: () => k < rows.length - 1, step: () => { k++; render(); }, reset: () => { k = -1; render(); } });
    // Optional deep link, e.g. #qu=5 : start with row 5 highlighted.
    const q0 = Number(new URLSearchParams(location.hash.slice(1)).get('qu')) || 0;
    k = Math.min(rows.length, q0) - 1;
    render();
  })();

  // ===================================================================
  // 3. Symmetric (oblivious) tree
  // ===================================================================
  (function obliviousViz() {
    const Q = ['size > 5?', 'is red?', 'weight > 2?'];
    const leafVals = [-0.8, -0.3, 0.2, 0.6, -0.1, 0.4, 0.9, 1.3];
    const ans = [0, 1, 0];
    const W = 1000, H = 250;
    const st = V.svg('#ob-tree', W, H, 'A depth-3 symmetric tree; the path for the chosen answers is highlighted');
    const sl = V.svg('#ob-leaves', W, 86, 'The 8-leaf lookup table');

    const bits = (d) => ans.slice(0, d).reduce((a, b) => a * 2 + b, 0);
    function node(d, prefix) {
      const onPath = prefix === bits(d);
      if (d === 3) {
        return { tone: onPath ? 'b' : 'split', lines: [`leaf ${prefix}`, prefix.toString(2).padStart(3, '0')] };
      }
      return { tone: onPath ? 'a' : 'split', lines: [Q[d], `level ${d + 1}`], children: [node(d + 1, prefix * 2), node(d + 1, prefix * 2 + 1)] };
    }

    function draw() {
      const idx = bits(3);
      V.tree(st, node(0, 0), { W, H, boxW: 104, boxH: 38, font: 11.5 });
      V.clear(sl);
      const cw = W / 8;
      leafVals.forEach((v, i) => {
        const on = i === idx;
        V.el('rect', { x: i * cw + 3, y: 4, width: cw - 6, height: 70, rx: 10, fill: on ? 'var(--c2-wash)' : 'var(--paper)', stroke: on ? 'var(--c2)' : 'var(--rule)', 'stroke-width': on ? 1.5 : 1 }, sl);
        V.text(sl, i * cw + cw / 2, 26, i.toString(2).padStart(3, '0'), { 'text-anchor': 'middle', 'font-size': 13, 'font-family': 'var(--mono)', fill: 'var(--ink-2)' });
        V.text(sl, i * cw + cw / 2, 46, `leaf ${i}`, { class: 'lbl-sm', 'text-anchor': 'middle' });
        V.text(sl, i * cw + cw / 2, 64, `value ${v.toFixed(1)}`, { 'text-anchor': 'middle', 'font-size': 12.5, 'font-weight': on ? 600 : 400, fill: 'var(--ink)' });
      });
      const b = idx.toString(2).padStart(3, '0');
      document.getElementById('ob-say').innerHTML =
        `Answers: <b>${ans.map((a) => (a ? 'yes' : 'no')).join(', ')}</b> → binary <b>${b}</b> → leaf <b>#${idx}</b> → value <b>${leafVals[idx].toFixed(1)}</b>. ` +
        'Left branch = no, right branch = yes. Whatever the path, each level asks the same question.';
    }
    ['ob-q1', 'ob-q2', 'ob-q3'].forEach((id, i) => V.seg(id, (v) => { ans[i] = Number(v); draw(); }));
    draw();
  })();
})();
