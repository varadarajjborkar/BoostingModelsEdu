/* A tiny, honest ML library. Every visual on this site runs these real algorithms. */
const ML = (() => {
  const sum = (a) => { let s = 0; for (const v of a) s += v; return s; };
  const mean = (a) => (a.length ? sum(a) / a.length : 0);
  const sign = (v) => (v >= 0 ? 1 : -1);
  const range = (n) => Array.from({ length: n }, (_, i) => i);
  const sigmoid = (z) => 1 / (1 + Math.exp(-z));

  // ---------------------------------------------------------------------------
  // Decision stump with sample weights. Labels are +1 / -1.
  // Returns the single question "is feature f > thr?" with the lowest weighted error.
  // ---------------------------------------------------------------------------
  function fitStump(X, y, w) {
    const n = X.length, d = X[0].length;
    let totPos = 0, totNeg = 0;
    for (let i = 0; i < n; i++) { if (y[i] > 0) totPos += w[i]; else totNeg += w[i]; }
    let best = null;
    for (let f = 0; f < d; f++) {
      const idx = range(n).sort((a, b) => X[a][f] - X[b][f]);
      let lp = 0, ln = 0;
      for (let k = 0; k < n - 1; k++) {
        const i = idx[k];
        if (y[i] > 0) lp += w[i]; else ln += w[i];
        const a = X[i][f], b = X[idx[k + 1]][f];
        if (a === b) continue;
        const thr = (a + b) / 2;
        const eRight = lp + (totNeg - ln); // polarity +1: right side says +1
        const eLeft = ln + (totPos - lp);  // polarity -1: left side says +1
        if (!best || eRight < best.err) best = { f, thr, pol: 1, err: eRight };
        if (eLeft < best.err) best = { f, thr, pol: -1, err: eLeft };
      }
    }
    const s = best;
    s.predict = (x) => (x[s.f] > s.thr ? s.pol : -s.pol);
    return s;
  }

  // ---------------------------------------------------------------------------
  // AdaBoost (discrete, with stumps). Call step() once per round.
  // ---------------------------------------------------------------------------
  class AdaBoost {
    constructor(X, y) {
      this.X = X; this.y = y; this.n = X.length;
      this.w = new Array(this.n).fill(1 / this.n);
      this.rounds = [];
    }
    step() {
      const { X, y, w, n } = this;
      const stump = fitStump(X, y, w);
      const err = Math.min(Math.max(stump.err, 1e-10), 1 - 1e-10);
      const alpha = 0.5 * Math.log((1 - err) / err);
      const before = w.slice();
      const wrong = [];
      let z = 0;
      for (let i = 0; i < n; i++) {
        const h = stump.predict(X[i]);
        wrong.push(h !== y[i]);
        w[i] *= Math.exp(-alpha * y[i] * h);
        z += w[i];
      }
      for (let i = 0; i < n; i++) w[i] /= z;
      const r = { stump, alpha, err, before, after: w.slice(), wrong };
      this.rounds.push(r);
      return r;
    }
    score(x, upto = this.rounds.length) {
      let s = 0;
      for (let t = 0; t < upto; t++) s += this.rounds[t].alpha * this.rounds[t].stump.predict(x);
      return s;
    }
    predict(x, upto) { return sign(this.score(x, upto)); }
    accuracy(upto, X = this.X, y = this.y) {
      let c = 0;
      for (let i = 0; i < X.length; i++) c += this.predict(X[i], upto) === y[i] ? 1 : 0;
      return c / X.length;
    }
  }

  // ---------------------------------------------------------------------------
  // Regression tree (squared error). X is an array of feature arrays.
  // ---------------------------------------------------------------------------
  function fitRegTree(X, r, { maxDepth = 2, minLeaf = 1 } = {}) {
    const d = X[0].length;
    function build(idx, depth) {
      const n = idx.length;
      let S = 0;
      for (const i of idx) S += r[i];
      const node = { leaf: true, value: S / n, n, depth, idx };
      if (depth >= maxDepth || n < 2 * minLeaf) return node;
      let best = null;
      for (let f = 0; f < d; f++) {
        const sorted = idx.slice().sort((a, b) => X[a][f] - X[b][f]);
        let SL = 0;
        for (let k = 0; k < n - 1; k++) {
          SL += r[sorted[k]];
          const nl = k + 1, nr = n - nl;
          if (nl < minLeaf || nr < minLeaf) continue;
          const a = X[sorted[k]][f], b = X[sorted[k + 1]][f];
          if (a === b) continue;
          const SR = S - SL;
          const gain = (SL * SL) / nl + (SR * SR) / nr - (S * S) / n; // drop in squared error
          if (!best || gain > best.gain) best = { f, thr: (a + b) / 2, gain, cut: k + 1, sorted };
        }
      }
      if (!best || best.gain <= 1e-12) return node;
      return {
        leaf: false, f: best.f, thr: best.thr, gain: best.gain, n, depth, value: node.value, idx,
        left: build(best.sorted.slice(0, best.cut), depth + 1),
        right: build(best.sorted.slice(best.cut), depth + 1),
      };
    }
    return build(range(X.length), 0);
  }

  function predictTree(node, x) {
    while (!node.leaf) node = x[node.f] <= node.thr ? node.left : node.right;
    return node.value;
  }
  function leaves(node, out = []) {
    if (node.leaf) out.push(node); else { leaves(node.left, out); leaves(node.right, out); }
    return out;
  }
  function depthOf(node) { return node.leaf ? 0 : 1 + Math.max(depthOf(node.left), depthOf(node.right)); }

  // ---------------------------------------------------------------------------
  // Classification tree (Gini). Labels 0/1. Leaf value = share of class 1.
  // ---------------------------------------------------------------------------
  const gini = (p) => 2 * p * (1 - p);
  function fitClassTree(X, y, { maxDepth = 3, minLeaf = 1 } = {}) {
    const d = X[0].length;
    function build(idx, depth) {
      const n = idx.length;
      let ones = 0;
      for (const i of idx) ones += y[i];
      const p = ones / n;
      const node = { leaf: true, value: p, n, depth };
      if (depth >= maxDepth || n < 2 * minLeaf || p === 0 || p === 1) return node;
      let best = null;
      const parent = gini(p);
      for (let f = 0; f < d; f++) {
        const sorted = idx.slice().sort((a, b) => X[a][f] - X[b][f]);
        let l1 = 0;
        for (let k = 0; k < n - 1; k++) {
          l1 += y[sorted[k]];
          const nl = k + 1, nr = n - nl;
          if (nl < minLeaf || nr < minLeaf) continue;
          const a = X[sorted[k]][f], b = X[sorted[k + 1]][f];
          if (a === b) continue;
          const child = (nl / n) * gini(l1 / nl) + (nr / n) * gini((ones - l1) / nr);
          const gain = parent - child;
          if (!best || gain > best.gain) best = { f, thr: (a + b) / 2, gain, cut: k + 1, sorted };
        }
      }
      if (!best || best.gain <= 1e-12) return node;
      return {
        leaf: false, f: best.f, thr: best.thr, gain: best.gain, n, depth, value: p,
        left: build(best.sorted.slice(0, best.cut), depth + 1),
        right: build(best.sorted.slice(best.cut), depth + 1),
      };
    }
    return build(range(X.length), 0);
  }

  // ---------------------------------------------------------------------------
  // Gradient boosting for regression (squared error).
  // ---------------------------------------------------------------------------
  class GBM {
    constructor(X, y, { lr = 0.3, maxDepth = 2 } = {}) {
      this.X = X; this.y = y; this.lr = lr; this.maxDepth = maxDepth;
      this.base = mean(y);
      this.pred = new Array(X.length).fill(this.base);
      this.trees = [];
      this.loss = [this.mse()];
    }
    mse() { let s = 0; for (let i = 0; i < this.y.length; i++) s += (this.y[i] - this.pred[i]) ** 2; return s / this.y.length; }
    residuals() { return this.y.map((v, i) => v - this.pred[i]); }
    step() {
      const res = this.residuals();
      const tree = fitRegTree(this.X, res, { maxDepth: this.maxDepth });
      for (let i = 0; i < this.X.length; i++) this.pred[i] += this.lr * predictTree(tree, this.X[i]);
      this.trees.push({ tree, res });
      this.loss.push(this.mse());
      return tree;
    }
    predict(x, upto = this.trees.length) {
      let v = this.base;
      for (let t = 0; t < upto; t++) v += this.lr * predictTree(this.trees[t].tree, x);
      return v;
    }
    mseOn(X, y, upto) { let s = 0; for (let i = 0; i < X.length; i++) s += (y[i] - this.predict(X[i], upto)) ** 2; return s / X.length; }
  }

  // ---------------------------------------------------------------------------
  // XGBoost-style tree. Uses gradients g and hessians h.
  //   similarity(G, H) = G^2 / (H + lambda)
  //   gain  = sim(left) + sim(right) - sim(parent)
  //   leaf  = -G / (H + lambda)
  // Grows to maxDepth, then prunes bottom-up any split whose gain < gamma.
  // ---------------------------------------------------------------------------
  function fitXgbTree(X, g, h, { maxDepth = 3, lambda = 1, gamma = 0, minChildWeight = 0 } = {}) {
    const d = X[0].length;
    const sim = (G, H) => (G * G) / (H + lambda);
    function build(idx, depth) {
      let G = 0, H = 0;
      for (const i of idx) { G += g[i]; H += h[i]; }
      const node = { leaf: true, G, H, n: idx.length, sim: sim(G, H), value: -G / (H + lambda), depth, idx };
      if (depth >= maxDepth || idx.length < 2) return node;
      let best = null;
      for (let f = 0; f < d; f++) {
        const sorted = idx.slice().sort((a, b) => X[a][f] - X[b][f]);
        let GL = 0, HL = 0;
        for (let k = 0; k < sorted.length - 1; k++) {
          GL += g[sorted[k]]; HL += h[sorted[k]];
          const a = X[sorted[k]][f], b = X[sorted[k + 1]][f];
          if (a === b) continue;
          const GR = G - GL, HR = H - HL;
          if (HL < minChildWeight || HR < minChildWeight) continue;
          const gain = sim(GL, HL) + sim(GR, HR) - sim(G, H);
          if (!best || gain > best.gain) best = { f, thr: (a + b) / 2, gain, cut: k + 1, sorted };
        }
      }
      if (!best || best.gain <= 0) return node;
      node.leaf = false;
      node.f = best.f; node.thr = best.thr; node.gain = best.gain;
      node.left = build(best.sorted.slice(0, best.cut), depth + 1);
      node.right = build(best.sorted.slice(best.cut), depth + 1);
      return node;
    }
    function prune(n) {
      if (n.leaf) return;
      prune(n.left); prune(n.right);
      if (n.left.leaf && n.right.leaf && n.gain < gamma) { n.leaf = true; n.pruned = true; }
    }
    const root = build(range(X.length), 0);
    prune(root);
    return root;
  }

  // ---------------------------------------------------------------------------
  // Best-first / level-order tree growth (for the LightGBM leaf-wise demo).
  // Returns snapshots after each split so the growth can be animated.
  // ---------------------------------------------------------------------------
  function growTree(X, r, { policy = 'leaf', maxLeaves = 8, minLeaf = 3 } = {}) {
    const d = X[0].length;
    let uid = 0;
    const mk = (idx, depth, box) => {
      let S = 0; for (const i of idx) S += r[i];
      const node = { id: uid++, leaf: true, idx, depth, box, value: S / idx.length, n: idx.length };
      node.best = bestSplit(node, S);
      return node;
    };
    function bestSplit(node, S) {
      const idx = node.idx, n = idx.length;
      let best = null;
      for (let f = 0; f < d; f++) {
        const sorted = idx.slice().sort((a, b) => X[a][f] - X[b][f]);
        let SL = 0;
        for (let k = 0; k < n - 1; k++) {
          SL += r[sorted[k]];
          const nl = k + 1, nr = n - nl;
          if (nl < minLeaf || nr < minLeaf) continue;
          const a = X[sorted[k]][f], b = X[sorted[k + 1]][f];
          if (a === b) continue;
          const SR = S - SL;
          const gain = (SL * SL) / nl + (SR * SR) / nr - (S * S) / n;
          if (!best || gain > best.gain) best = { f, thr: (a + b) / 2, gain, cut: k + 1, sorted };
        }
      }
      return best;
    }
    const root = mk(range(X.length), 0, [[0, 1], [0, 1]]);
    const leavesList = [root];
    const snapshots = [];
    let order = 0;
    const sse = () => {
      let s = 0;
      for (const lf of leavesList) for (const i of lf.idx) s += (r[i] - lf.value) ** 2;
      return s / X.length;
    };
    snapshots.push({ leaves: leavesList.length, loss: sse(), split: null });
    while (leavesList.length < maxLeaves) {
      const candidates = leavesList.filter((l) => l.best && l.best.gain > 1e-12);
      if (!candidates.length) break;
      let pick;
      if (policy === 'leaf') pick = candidates.reduce((a, b) => (b.best.gain > a.best.gain ? b : a));
      else pick = candidates.reduce((a, b) => (b.depth < a.depth || (b.depth === a.depth && b.id < a.id) ? b : a));
      const bs = pick.best;
      const boxL = pick.box.map((v) => v.slice()), boxR = pick.box.map((v) => v.slice());
      boxL[bs.f][1] = bs.thr; boxR[bs.f][0] = bs.thr;
      pick.leaf = false; pick.f = bs.f; pick.thr = bs.thr; pick.gain = bs.gain; pick.order = ++order;
      pick.left = mk(bs.sorted.slice(0, bs.cut), pick.depth + 1, boxL);
      pick.right = mk(bs.sorted.slice(bs.cut), pick.depth + 1, boxR);
      leavesList.splice(leavesList.indexOf(pick), 1, pick.left, pick.right);
      snapshots.push({ leaves: leavesList.length, loss: sse(), split: pick });
    }
    return { root, snapshots };
  }

  return {
    sum, mean, sign, range, sigmoid, gini,
    fitStump, AdaBoost, fitRegTree, predictTree, leaves, depthOf,
    fitClassTree, GBM, fitXgbTree, growTree,
  };
})();
