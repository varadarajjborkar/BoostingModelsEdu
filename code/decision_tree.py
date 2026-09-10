"""
A decision tree, built from scratch.

The idea (same as on the page):
    A tree plays "20 questions" with the data.
    At every step it tries many yes/no questions, like
        "is feature 1 <= 0.42 ?"
    and keeps the one that leaves the two groups the LEAST mixed.

We measure "how mixed" with the mess score (Gini):
    0.0  = the group is all one class   (pure, great)
    0.5  = the group is half and half   (total mess)

Needs only numpy.   Run it with:   python decision_tree.py
"""
import numpy as np


def mess_score(labels):
    """Gini mess score of a group of 0/1 labels."""
    if len(labels) == 0:
        return 0.0
    p = np.mean(labels)                 # share of class 1 in the group
    return 2 * p * (1 - p)


def mess_after_split(yes_labels, no_labels):
    """Mess of the two groups together. Bigger groups count more."""
    n = len(yes_labels) + len(no_labels)
    return (len(yes_labels) / n) * mess_score(yes_labels) + \
           (len(no_labels) / n) * mess_score(no_labels)


class Node:
    """One box in the tree: either a question (with 2 children) or a leaf (an answer)."""

    def __init__(self, answer):
        self.answer = answer            # share of class 1 here (used when this is a leaf)
        self.feature = None             # the question is:  x[feature] <= threshold ?
        self.threshold = None
        self.yes = None                 # where to go if the answer is yes
        self.no = None                  # where to go if the answer is no

    def is_leaf(self):
        return self.yes is None


class DecisionTree:
    def __init__(self, max_depth=3):
        self.max_depth = max_depth      # at most this many questions in a row

    # ------------------------------------------------------------------ learning
    def fit(self, X, y):
        X = np.asarray(X, dtype=float)
        y = np.asarray(y, dtype=int)
        self.root = self.grow(X, y, depth=0)
        return self

    def find_best_question(self, X, y):
        """Try every feature and every cut. Keep the question with the lowest mess."""
        best = {"mess": mess_score(y), "feature": None, "threshold": None}   # "ask nothing" is the bar to beat

        for feature in range(X.shape[1]):
            values = np.unique(X[:, feature])            # sorted, no repeats
            cuts = (values[:-1] + values[1:]) / 2         # halfway between neighbours

            for threshold in cuts:
                says_yes = X[:, feature] <= threshold
                mess = mess_after_split(y[says_yes], y[~says_yes])
                if mess < best["mess"]:
                    best = {"mess": mess, "feature": feature, "threshold": threshold}

        return best

    def grow(self, X, y, depth):
        node = Node(answer=np.mean(y))

        # Step 1: stop if we asked enough questions, or the group is already pure
        if depth == self.max_depth or mess_score(y) == 0:
            return node

        # Step 2: find the best question for this group
        best = self.find_best_question(X, y)
        if best["feature"] is None:                      # no question makes it less mixed
            return node

        # Step 3: split into a "yes" group and a "no" group, then grow each one
        node.feature = best["feature"]
        node.threshold = best["threshold"]
        says_yes = X[:, node.feature] <= node.threshold
        node.yes = self.grow(X[says_yes], y[says_yes], depth + 1)
        node.no = self.grow(X[~says_yes], y[~says_yes], depth + 1)
        return node

    # ----------------------------------------------------------------- answering
    def predict_one(self, x):
        """Walk down the tree, answering each question, until we reach a leaf."""
        node = self.root
        while not node.is_leaf():
            node = node.yes if x[node.feature] <= node.threshold else node.no
        return node.answer

    def predict(self, X):
        shares = np.array([self.predict_one(x) for x in np.asarray(X, dtype=float)])
        return (shares >= 0.5).astype(int)              # the most common class in that leaf


# ---------------------------------------------------------------------- try it
if __name__ == "__main__":
    # A toy dataset: class 1 lives inside a circle, class 0 lives outside.
    rng = np.random.default_rng(0)
    X = rng.uniform(0, 1, size=(600, 2))
    y = ((X[:, 0] - 0.5) ** 2 + (X[:, 1] - 0.5) ** 2 < 0.1).astype(int)

    # Real data is messy, so flip 10% of the labels.
    flip = rng.random(len(y)) < 0.1
    y[flip] = 1 - y[flip]

    X_train, y_train = X[:400], y[:400]      # the tree learns from these
    X_new, y_new = X[400:], y[400:]          # kept hidden, to test the tree fairly

    print("depth | training data | new data")
    for depth in [1, 3, 5, 8, 14]:
        tree = DecisionTree(max_depth=depth).fit(X_train, y_train)
        train_acc = np.mean(tree.predict(X_train) == y_train)
        new_acc = np.mean(tree.predict(X_new) == y_new)
        print(f"{depth:5d} | {train_acc:13.0%} | {new_acc:8.0%}")

    # Training accuracy climbs toward 100%, but new-data accuracy stops improving.
    # That gap is overfitting: the deep tree is memorizing, not learning.
