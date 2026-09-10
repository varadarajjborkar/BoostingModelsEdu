"""
XGBoost's core idea, built from scratch ("lite": the ideas, not the speed).

The idea (same as on the page):
    It is gradient boosting, plus three upgrades.
    1. For every dot it measures the SLOPE (g) and the CURVE (h) of the loss.
       Knowing the curve tells it HOW FAR to step, not just which way.
    2. It judges every possible split with a scorecard:
           similarity = (sum of g)^2 / (sum of h + lambda)
           gain       = similarity(left) + similarity(right) - similarity(parent)
    3. It has brakes:
           lambda  shrinks every leaf value  (no wild jumps)
           gamma   is an entry fee: a split whose gain is below gamma gets pruned

Needs only numpy.   Run it with:   python xgboost_lite.py
"""
import numpy as np


# ------------------------------------------------------------------ the losses
# For each loss we need two things at the current guess: its slope (g) and its curve (h).

def squared_loss_slope_and_curve(y, guess):
    g = guess - y                          # slope of  0.5 * (guess - y)^2
    h = np.ones_like(y)                    # the curve is the same everywhere: 1
    return g, h


def logistic_loss_slope_and_curve(y, raw_score):
    p = 1 / (1 + np.exp(-raw_score))       # turn the raw score into a chance between 0 and 1
    g = p - y                              # slope
    h = p * (1 - p)                        # curve: biggest when p is near 0.5 (most unsure)
    return g, h


def count_leaves(node):
    if "left" not in node:
        return 1
    return count_leaves(node["left"]) + count_leaves(node["right"])


class XGBTree:
    """One tree, grown with the similarity / gain scorecard, then pruned."""

    def __init__(self, max_depth=3, lam=1.0, gamma=0.0, min_child_weight=1.0, n_cuts=32):
        self.max_depth = max_depth
        self.lam = lam                             # lambda: the brake
        self.gamma = gamma                         # gamma: the entry fee for every split
        self.min_child_weight = min_child_weight   # each side needs at least this much "curve"
        self.n_cuts = n_cuts                       # speed trick: only try this many cuts per feature

    def similarity(self, g, h):
        return np.sum(g) ** 2 / (np.sum(h) + self.lam)

    def leaf_value(self, g, h):
        return -np.sum(g) / (np.sum(h) + self.lam)

    def fit(self, X, g, h):
        self.root = self.grow(np.asarray(X, dtype=float), g, h, depth=0)
        self.prune(self.root)
        return self

    def candidate_cuts(self, column):
        """XGBoost trick: do not try every value, only a few percentiles."""
        percentiles = np.linspace(0, 100, self.n_cuts + 2)[1:-1]
        return np.unique(np.percentile(column, percentiles))

    def grow(self, X, g, h, depth):
        node = {"value": self.leaf_value(g, h)}          # the answer if this stays a leaf
        if depth == self.max_depth or len(g) < 2:
            return node

        parent_score = self.similarity(g, h)
        best = None
        for feature in range(X.shape[1]):
            for threshold in self.candidate_cuts(X[:, feature]):
                left = X[:, feature] <= threshold
                if h[left].sum() < self.min_child_weight or h[~left].sum() < self.min_child_weight:
                    continue                             # one side would be too small
                gain = self.similarity(g[left], h[left]) + self.similarity(g[~left], h[~left]) - parent_score
                if best is None or gain > best[0]:
                    best = (gain, feature, threshold)

        if best is None or best[0] <= 0:
            return node

        gain, feature, threshold = best
        left = X[:, feature] <= threshold
        node["gain"] = gain
        node["feature"] = feature
        node["threshold"] = threshold
        node["left"] = self.grow(X[left], g[left], h[left], depth + 1)
        node["right"] = self.grow(X[~left], g[~left], h[~left], depth + 1)
        return node

    def prune(self, node):
        """Walk from the bottom up. A split that did not earn its entry fee is cut off."""
        if "left" not in node:
            return
        self.prune(node["left"])
        self.prune(node["right"])
        children_are_leaves = "left" not in node["left"] and "left" not in node["right"]
        if children_are_leaves and node["gain"] < self.gamma:
            for key in ("left", "right", "feature", "threshold", "gain"):
                del node[key]                            # now this node is a leaf again

    def predict_one(self, x):
        node = self.root
        while "left" in node:
            node = node["left"] if x[node["feature"]] <= node["threshold"] else node["right"]
        return node["value"]

    def predict(self, X):
        return np.array([self.predict_one(x) for x in np.asarray(X, dtype=float)])


class XGBoostLite:
    def __init__(self, n_trees=50, learning_rate=0.3, max_depth=3, lam=1.0, gamma=0.0, loss="squared"):
        self.n_trees = n_trees
        self.learning_rate = learning_rate
        self.tree_settings = dict(max_depth=max_depth, lam=lam, gamma=gamma)
        self.loss = loss                                 # "squared" (numbers) or "logistic" (yes/no)

    def slope_and_curve(self, y, guess):
        if self.loss == "squared":
            return squared_loss_slope_and_curve(y, guess)
        return logistic_loss_slope_and_curve(y, guess)

    def fit(self, X, y):
        X = np.asarray(X, dtype=float)
        y = np.asarray(y, dtype=float)

        # Step 0: a starting guess (for yes/no, a raw score of 0 means a 50% chance)
        self.start = np.mean(y) if self.loss == "squared" else 0.0
        guess = np.full(len(y), self.start)
        self.trees = []

        for _ in range(self.n_trees):
            # Step 1: slope and curve of the loss, for every dot
            g, h = self.slope_and_curve(y, guess)

            # Step 2 + 3: grow a tree with the scorecard, then prune weak splits
            tree = XGBTree(**self.tree_settings).fit(X, g, h)

            # Step 4: take a small step
            guess = guess + self.learning_rate * tree.predict(X)
            self.trees.append(tree)

        return self

    def raw_score(self, X):
        score = np.full(len(X), self.start)
        for tree in self.trees:
            score = score + self.learning_rate * tree.predict(X)
        return score

    def predict(self, X):
        score = self.raw_score(X)
        if self.loss == "squared":
            return score
        return (score > 0).astype(int)                  # chance above 50%  ->  class 1


# ---------------------------------------------------------------------- try it
if __name__ == "__main__":
    # Yes/no data: class 1 lives inside a circle. 5% of the labels are wrong (real data is messy).
    rng = np.random.default_rng(3)
    X = rng.uniform(0, 1, size=(600, 2))
    y = ((X[:, 0] - 0.5) ** 2 + (X[:, 1] - 0.5) ** 2 < 0.08).astype(float)
    flip = rng.random(len(y)) < 0.05
    y[flip] = 1 - y[flip]
    X_train, y_train = X[:400], y[:400]
    X_new, y_new = X[400:], y[400:]

    print("lambda | gamma | leaves in first tree | accuracy on new data")
    for lam, gamma in [(0, 0), (1, 0), (1, 1), (5, 3)]:
        model = XGBoostLite(n_trees=30, learning_rate=0.3, max_depth=4,
                            lam=lam, gamma=gamma, loss="logistic").fit(X_train, y_train)
        leaves = count_leaves(model.trees[0].root)
        accuracy = np.mean(model.predict(X_new) == y_new)
        print(f"{lam:6} | {gamma:5} | {leaves:20d} | {accuracy:20.0%}")

    # Bigger lambda and gamma = smaller, calmer trees.
    # Too little braking can overfit; too much can underfit. You tune them.
