"""
CatBoost's two big ideas, built from scratch ("lite").

The idea (same as on the page):
    1. ORDERED TARGET STATISTICS: turn a category (a word, like a city) into a number:
       "for this category, how often was the answer 1?"
       But each row may only look at rows that came BEFORE it in a random order,
       so it can never peek at its own answer.
    2. SYMMETRIC TREES: every level of the tree asks the SAME question.
       The yes/no answers then form a binary number: the address of the leaf.

Needs only numpy.   Run it with:   python catboost_lite.py
"""
import numpy as np


# --------------------------------------------- idea 1: categories -> numbers
def greedy_target_encode(categories, y, prior, a=1.0):
    """The LEAKY way: every row uses ALL rows of its category, including itself."""
    encoded = np.zeros(len(y))
    for i, cat in enumerate(categories):
        same = categories == cat
        encoded[i] = (y[same].sum() + a * prior) / (same.sum() + a)
    return encoded


def ordered_target_encode(categories, y, prior, a=1.0, seed=0):
    """The CatBoost way: shuffle the rows into a queue, each row only uses rows BEFORE it."""
    queue = np.random.default_rng(seed).permutation(len(y))
    seen_sum, seen_count = {}, {}                     # running totals per category
    encoded = np.zeros(len(y))
    for i in queue:                                   # walk the queue from front to back
        cat = categories[i]
        s, c = seen_sum.get(cat, 0.0), seen_count.get(cat, 0)
        encoded[i] = (s + a * prior) / (c + a)        # row i itself is NOT counted yet
        seen_sum[cat] = s + y[i]                      # now row i joins the "seen" rows
        seen_count[cat] = c + 1
    return encoded


def encode_new_rows(train_categories, train_y, new_categories, prior, a=1.0):
    """New data may use ALL training rows: none of them is the new row's own answer."""
    encoded = np.zeros(len(new_categories))
    for i, cat in enumerate(new_categories):
        same = train_categories == cat
        encoded[i] = (train_y[same].sum() + a * prior) / (same.sum() + a)
    return encoded


# ------------------------------------------------------ idea 2: symmetric trees
class SymmetricTree:
    """A depth-D tree where every level asks ONE question, shared by all its nodes."""

    def __init__(self, depth=4, lam=3.0, n_cuts=16):
        self.depth = depth
        self.lam = lam                     # the brake on leaf values (l2_leaf_reg in CatBoost)
        self.n_cuts = n_cuts

    def leaf_index(self, X):
        """Read the yes/no answers as a binary number: yes, no, yes -> 1 0 1 -> leaf 5."""
        index = np.zeros(len(X), dtype=int)
        for feature, threshold in self.questions:
            index = index * 2 + (X[:, feature] > threshold)
        return index

    def total_score(self, index, g, h):
        """How good is this set of leaves? Add up every leaf's similarity score."""
        G = np.bincount(index, weights=g)
        H = np.bincount(index, weights=h)
        return np.sum(G ** 2 / (H + self.lam))

    def fit(self, X, g, h):
        self.questions = []
        for level in range(self.depth):
            current = self.leaf_index(X)                 # which leaf every row sits in right now
            best = None
            for feature in range(X.shape[1]):
                percentiles = np.linspace(0, 100, self.n_cuts + 2)[1:-1]
                for threshold in np.unique(np.percentile(X[:, feature], percentiles)):
                    # the SAME question is asked in every current leaf
                    new_index = current * 2 + (X[:, feature] > threshold)
                    score = self.total_score(new_index, g, h)
                    if best is None or score > best[0]:
                        best = (score, feature, threshold)
            self.questions.append((best[1], best[2]))

        # every leaf gets its value, -G / (H + lambda)
        index = self.leaf_index(X)
        n_leaves = 2 ** self.depth
        G = np.bincount(index, weights=g, minlength=n_leaves)
        H = np.bincount(index, weights=h, minlength=n_leaves)
        self.leaf_values = -G / (H + self.lam)
        return self

    def predict(self, X):
        return self.leaf_values[self.leaf_index(X)]      # one lookup, very fast


# ---------------------------------------------------------------- the booster
class CatBoostLite:
    def __init__(self, n_trees=60, learning_rate=0.2, depth=4, lam=3.0, encoding="ordered"):
        self.n_trees = n_trees
        self.learning_rate = learning_rate
        self.depth = depth
        self.lam = lam
        self.encoding = encoding           # "ordered" (CatBoost) or "greedy" (leaky, for comparison)

    def training_table(self, X_num, cats, y):
        """Numbers + encoded categories, the way the model sees its OWN training rows."""
        columns = [X_num]
        for j in range(cats.shape[1]):
            if self.encoding == "ordered":
                enc = ordered_target_encode(cats[:, j], y, self.prior, seed=j)
            else:
                enc = greedy_target_encode(cats[:, j], y, self.prior)
            columns.append(enc.reshape(-1, 1))
        return np.hstack(columns)

    def new_table(self, X_num, cats):
        columns = [X_num]
        for j in range(cats.shape[1]):
            enc = encode_new_rows(self.train_cats[:, j], self.train_y, cats[:, j], self.prior)
            columns.append(enc.reshape(-1, 1))
        return np.hstack(columns)

    def fit(self, X_num, cats, y):
        self.prior = y.mean()
        self.train_cats, self.train_y = cats, y
        X = self.training_table(X_num, cats, y)

        raw = np.zeros(len(y))                            # raw score 0 = a 50% chance
        self.trees = []
        for _ in range(self.n_trees):
            p = 1 / (1 + np.exp(-raw))
            g, h = p - y, p * (1 - p)                     # slope and curve of the log-loss
            tree = SymmetricTree(self.depth, self.lam).fit(X, g, h)
            raw = raw + self.learning_rate * tree.predict(X)
            self.trees.append(tree)

        self.training_accuracy = np.mean((raw > 0) == y)
        return self

    def predict(self, X_num, cats):
        X = self.new_table(X_num, cats)
        raw = sum(self.learning_rate * tree.predict(X) for tree in self.trees)
        return (raw > 0).astype(int)


# ---------------------------------------------------------------------- try it
if __name__ == "__main__":
    rng = np.random.default_rng(5)
    n = 3000
    city = rng.integers(0, 6, n)                  # 6 cities: this REALLY matters
    shop = rng.integers(0, 1500, n)               # 1,500 shop ids: pure noise, most seen once or twice
    x = rng.normal(size=n)                        # one ordinary number column
    city_effect = np.array([-1.5, -0.8, 0.0, 0.5, 1.0, 1.8])
    chance = 1 / (1 + np.exp(-(city_effect[city] + 0.8 * x)))
    y = (rng.random(n) < chance).astype(float)

    cats = np.column_stack([city, shop])
    X_num = x.reshape(-1, 1)
    tr, new = slice(0, 2000), slice(2000, None)

    print("encoding | accuracy on training data | accuracy on new data")
    for encoding in ["greedy", "ordered"]:
        model = CatBoostLite(encoding=encoding).fit(X_num[tr], cats[tr], y[tr])
        new_acc = np.mean(model.predict(X_num[new], cats[new]) == y[new])
        print(f"{encoding:8} | {model.training_accuracy:25.0%} | {new_acc:20.0%}")

    # What to notice:
    #  Greedy encoding looks amazing on training data: the useless shop ids "know" the answers,
    #  because each row's encoding contains its own label. On new data that trick stops working.
    #  Ordered encoding is honest: training and new-data accuracy stay close.
