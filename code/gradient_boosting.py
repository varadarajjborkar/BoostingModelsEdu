"""
Gradient Boosting (for predicting numbers), built from scratch.

The idea (same as on the page):
    1. Start with a simple guess for everyone: the average.
    2. Look at what is LEFT OVER:   leftover = true value - guess.
    3. Train a small tree to predict those leftovers.
    4. Add a little bit of that tree to the guess (the learning rate).
    5. Repeat. Every tree fixes part of what is still wrong.

Needs only numpy.   Run it with:   python gradient_boosting.py
"""
import numpy as np


class SmallRegressionTree:
    """A small tree that predicts NUMBERS. Each leaf answers the average of its dots."""

    def __init__(self, max_depth=2):
        self.max_depth = max_depth

    def fit(self, X, y):
        self.root = self.grow(np.asarray(X, dtype=float), np.asarray(y, dtype=float), depth=0)
        return self

    def grow(self, X, y, depth):
        leaf = {"answer": np.mean(y)}
        if depth == self.max_depth or len(y) < 2:
            return leaf

        # Try every cut. Keep the one with the smallest squared error after the split.
        best_cut = None
        best_error = np.sum((y - y.mean()) ** 2)            # error if we do not split at all
        for feature in range(X.shape[1]):
            values = np.unique(X[:, feature])
            for threshold in (values[:-1] + values[1:]) / 2:
                left = X[:, feature] <= threshold
                error = np.sum((y[left] - y[left].mean()) ** 2) + \
                        np.sum((y[~left] - y[~left].mean()) ** 2)
                if error < best_error:
                    best_error = error
                    best_cut = (feature, threshold)

        if best_cut is None:
            return leaf

        feature, threshold = best_cut
        left = X[:, feature] <= threshold
        return {
            "feature": feature,
            "threshold": threshold,
            "left": self.grow(X[left], y[left], depth + 1),
            "right": self.grow(X[~left], y[~left], depth + 1),
        }

    def predict_one(self, x):
        node = self.root
        while "answer" not in node:
            node = node["left"] if x[node["feature"]] <= node["threshold"] else node["right"]
        return node["answer"]

    def predict(self, X):
        return np.array([self.predict_one(x) for x in np.asarray(X, dtype=float)])


class GradientBoosting:
    def __init__(self, n_trees=100, learning_rate=0.1, max_depth=2):
        self.n_trees = n_trees
        self.learning_rate = learning_rate      # how strong each "shot" is
        self.max_depth = max_depth              # how big each tree is

    def fit(self, X, y):
        X = np.asarray(X, dtype=float)
        y = np.asarray(y, dtype=float)

        # Step 0: the first guess is just the average, the same for everyone
        self.first_guess = np.mean(y)
        guess = np.full(len(y), self.first_guess)
        self.trees = []

        for _ in range(self.n_trees):
            # Step 1: what is left over?
            leftover = y - guess

            # Step 2: train a small tree to predict the leftover
            tree = SmallRegressionTree(self.max_depth).fit(X, leftover)

            # Step 3: take a small step toward the truth
            guess = guess + self.learning_rate * tree.predict(X)
            self.trees.append(tree)

        return self

    def predict(self, X, n_trees=None):
        """Start from the average, then add a little of every tree (or only the first n_trees)."""
        guess = np.full(len(X), self.first_guess)
        for tree in self.trees[:n_trees]:
            guess = guess + self.learning_rate * tree.predict(X)
        return guess


# ---------------------------------------------------------------------- try it
if __name__ == "__main__":
    # A wavy line with some noise on top.
    rng = np.random.default_rng(2)
    x = rng.uniform(0, 10, size=300)
    y = 2 * np.sin(x) + 0.3 * x + rng.normal(0, 0.4, size=300)
    X = x.reshape(-1, 1)
    X_train, y_train = X[:200], y[:200]
    X_new, y_new = X[200:], y[200:]

    model = GradientBoosting(n_trees=200, learning_rate=0.1, max_depth=2).fit(X_train, y_train)

    def error(guess, truth):
        return np.mean((guess - truth) ** 2)

    print("trees | error on training data | error on new data")
    for k in [0, 1, 5, 20, 50, 100, 200]:
        print(f"{k:5d} | {error(model.predict(X_train, k), y_train):22.3f} | {error(model.predict(X_new, k), y_new):17.3f}")

    # What to notice:
    #  - Training error keeps going down, forever.
    #  - Error on NEW data is lowest somewhere in the middle (near 0.16, the noise we added:
    #    0.4 squared). Nobody can predict pure noise.
    #  - After that, new-data error creeps back up: extra trees start learning the noise.
    #    That is why people stop early, at the point where new-data error is lowest.
