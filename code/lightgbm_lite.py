"""
LightGBM's main speed ideas, built from scratch ("lite": the ideas, not the C++ speed).

The idea (same as on the page):
    It is gradient boosting, made fast with tricks:
    1. BUCKETS: put every feature's values into a few buckets (a histogram), once.
       After that, only the bucket edges are tried as cuts.
    2. LEAF-WISE: grow the tree by always splitting the ONE leaf that helps most,
       until the tree has num_leaves leaves.
    3. GOSS: keep the dots with big leftovers (the hard ones) and only a random
       sample of the easy ones. The sampled easy dots count extra, to stay fair.

Needs only numpy.   Run it with:   python lightgbm_lite.py
"""
import time
import numpy as np


# --------------------------------------------------------------- trick 1: buckets
def make_bucket_edges(X, max_buckets=32):
    """For every feature, pick bucket edges at evenly spaced percentiles."""
    edges = []
    for feature in range(X.shape[1]):
        percentiles = np.linspace(0, 100, max_buckets + 1)[1:-1]
        edges.append(np.unique(np.percentile(X[:, feature], percentiles)))
    return edges


def to_buckets(X, edges):
    """Replace every value by its bucket number. Bucket b holds values <= edges[b]."""
    buckets = np.zeros(X.shape, dtype=int)
    for feature, cut_points in enumerate(edges):
        buckets[:, feature] = np.searchsorted(cut_points, X[:, feature], side="left")
    return buckets


# ------------------------------------------------------------------ trick 3: GOSS
def goss_weights(leftover_size, top_rate, other_rate, rng):
    """Keep the hardest dots, sample some easy ones, and give the easy ones extra weight."""
    n = len(leftover_size)
    hardest_first = np.argsort(-leftover_size)
    n_top = int(top_rate * n)
    n_other = int(other_rate * n)

    top = hardest_first[:n_top]                          # always kept
    easy = hardest_first[n_top:]
    sampled = rng.choice(easy, size=n_other, replace=False)

    weights = np.zeros(n)                                # weight 0 = not used for this tree
    weights[top] = 1.0
    weights[sampled] = (1 - top_rate) / other_rate      # each sampled easy dot stands in for several
    return weights


# ------------------------------------------------------------- trick 2: leaf-wise
class LeafWiseTree:
    def __init__(self, num_leaves=8, min_dots_in_leaf=10, lam=1.0):
        self.num_leaves = num_leaves
        self.min_dots_in_leaf = min_dots_in_leaf
        self.lam = lam

    def best_split(self, rows, buckets, g, h, n_buckets):
        """Build a histogram for these rows, then try every bucket edge as a cut."""
        G, H, N = g[rows].sum(), h[rows].sum(), len(rows)
        parent = G ** 2 / (H + self.lam)
        best = None

        for feature in range(buckets.shape[1]):
            b = buckets[rows, feature]
            # Step A: fill the histogram, i.e. add up g, h and the count in every bucket
            hist_g = np.bincount(b, weights=g[rows], minlength=n_buckets[feature])
            hist_h = np.bincount(b, weights=h[rows], minlength=n_buckets[feature])
            hist_n = np.bincount(b, minlength=n_buckets[feature])

            # Step B: walk along the buckets from left to right with running totals
            GL = HL = NL = 0.0
            for edge in range(n_buckets[feature] - 1):
                GL += hist_g[edge]
                HL += hist_h[edge]
                NL += hist_n[edge]
                GR, HR, NR = G - GL, H - HL, N - NL
                if NL < self.min_dots_in_leaf or NR < self.min_dots_in_leaf:
                    continue
                gain = GL ** 2 / (HL + self.lam) + GR ** 2 / (HR + self.lam) - parent
                if best is None or gain > best["gain"]:
                    best = {"gain": gain, "feature": feature, "edge": edge}

        return best

    def fit(self, buckets, g, h, n_buckets, rows):
        self.root = {"rows": rows}
        self.root["split"] = self.best_split(rows, buckets, g, h, n_buckets)
        leaves = [self.root]

        while len(leaves) < self.num_leaves:
            # Step 1: among ALL current leaves, pick the one whose best split helps most
            candidates = [leaf for leaf in leaves if leaf["split"] and leaf["split"]["gain"] > 0]
            if not candidates:
                break
            leaf = max(candidates, key=lambda l: l["split"]["gain"])

            # Step 2: split that leaf into two new leaves
            split = leaf["split"]
            goes_left = buckets[leaf["rows"], split["feature"]] <= split["edge"]
            leaf["left"] = {"rows": leaf["rows"][goes_left]}
            leaf["right"] = {"rows": leaf["rows"][~goes_left]}
            for child in (leaf["left"], leaf["right"]):
                child["split"] = self.best_split(child["rows"], buckets, g, h, n_buckets)
            leaves.remove(leaf)
            leaves += [leaf["left"], leaf["right"]]

        # Step 3: every leaf gets its value, -G / (H + lambda), like XGBoost
        for leaf in leaves:
            leaf["value"] = -g[leaf["rows"]].sum() / (h[leaf["rows"]].sum() + self.lam)
        return self

    def predict(self, buckets):
        out = np.zeros(len(buckets))
        for i, row in enumerate(buckets):
            node = self.root
            while "left" in node:
                split = node["split"]
                node = node["left"] if row[split["feature"]] <= split["edge"] else node["right"]
            out[i] = node["value"]
        return out


# -------------------------------------------------------------------- the booster
class LightGBMLite:
    def __init__(self, n_trees=100, learning_rate=0.1, num_leaves=8, max_buckets=32,
                 use_goss=True, top_rate=0.2, other_rate=0.1, seed=0):
        self.n_trees = n_trees
        self.learning_rate = learning_rate
        self.num_leaves = num_leaves
        self.max_buckets = max_buckets
        self.use_goss = use_goss
        self.top_rate = top_rate
        self.other_rate = other_rate
        self.rng = np.random.default_rng(seed)

    def fit(self, X, y):
        X = np.asarray(X, dtype=float)
        y = np.asarray(y, dtype=float)

        # Trick 1: bucket the data ONCE, before any tree is built
        self.edges = make_bucket_edges(X, self.max_buckets)
        buckets = to_buckets(X, self.edges)
        n_buckets = [len(e) + 1 for e in self.edges]

        self.start = y.mean()
        guess = np.full(len(y), self.start)
        self.trees, self.rows_used = [], []

        for _ in range(self.n_trees):
            g = guess - y                        # slope of the squared error
            h = np.ones_like(y)                  # curve of the squared error

            if self.use_goss:                    # Trick 3: GOSS picks which rows this tree sees
                w = goss_weights(np.abs(g), self.top_rate, self.other_rate, self.rng)
                rows = np.nonzero(w)[0]
                g, h = g * w, h * w
            else:
                rows = np.arange(len(y))

            tree = LeafWiseTree(self.num_leaves).fit(buckets, g, h, n_buckets, rows)   # Trick 2
            guess = guess + self.learning_rate * tree.predict(buckets)
            self.trees.append(tree)
            self.rows_used.append(len(rows))

        return self

    def predict(self, X):
        buckets = to_buckets(np.asarray(X, dtype=float), self.edges)
        guess = np.full(len(buckets), self.start)
        for tree in self.trees:
            guess = guess + self.learning_rate * tree.predict(buckets)
        return guess


# ---------------------------------------------------------------------- try it
if __name__ == "__main__":
    rng = np.random.default_rng(4)
    X = rng.uniform(0, 10, size=(6000, 2))
    y = 2 * np.sin(X[:, 0]) + np.cos(X[:, 1]) + rng.normal(0, 0.3, size=6000)
    X_train, y_train = X[:4000], y[:4000]
    X_new, y_new = X[4000:], y[4000:]

    print("setting                  | rows per tree | seconds | error on new data")
    for name, settings in [
        ("255 buckets, no GOSS", dict(max_buckets=255, use_goss=False)),
        ("32 buckets, no GOSS", dict(max_buckets=32, use_goss=False)),
        ("32 buckets, GOSS 20%+10%", dict(max_buckets=32, use_goss=True)),
    ]:
        start = time.perf_counter()
        model = LightGBMLite(n_trees=60, learning_rate=0.2, num_leaves=12, **settings).fit(X_train, y_train)
        seconds = time.perf_counter() - start
        error = np.mean((model.predict(X_new) - y_new) ** 2)
        print(f"{name:24} | {model.rows_used[-1]:13d} | {seconds:7.2f} | {error:17.3f}")

    # What to notice:
    #  - 32 buckets instead of 255: much less work, the error gets only a little worse.
    #  - GOSS: each tree looks at 1,200 rows instead of 4,000, again for a small cost.
    #  You trade a bit of accuracy for a lot of speed. On millions of rows, that trade wins.
    #  (The noise we added is 0.3 squared = 0.09, so that is the best possible error.)
