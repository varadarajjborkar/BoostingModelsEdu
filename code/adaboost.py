"""
AdaBoost, built from scratch.

The idea (same as on the page):
    1. Every dot starts with the same weight.
    2. Train a tiny helper: a stump (a tree with just ONE yes/no question).
    3. The dots that helper got wrong become HEAVIER,
       so the next helper is forced to care about them.
    4. Each helper gets a vote power. Better helpers get a louder voice.
    5. To predict, all helpers vote. Louder voices count more.

Labels must be +1 or -1.   Needs only numpy.   Run it with:   python adaboost.py
"""
import numpy as np


class Stump:
    """A tiny tree with ONE question:  'is x[feature] > threshold ?'"""

    def __init__(self):
        self.feature = None
        self.threshold = None
        self.says_if_yes = 1             # the label it answers when the question is true (+1 or -1)

    def predict(self, X):
        yes = X[:, self.feature] > self.threshold
        return np.where(yes, self.says_if_yes, -self.says_if_yes)

    def fit(self, X, y, weights):
        """Find the question with the smallest WEIGHTED error (heavy dots count more)."""
        best_error = np.inf

        for feature in range(X.shape[1]):
            values = np.unique(X[:, feature])
            for threshold in (values[:-1] + values[1:]) / 2:
                for says_if_yes in (1, -1):
                    yes = X[:, feature] > threshold
                    guess = np.where(yes, says_if_yes, -says_if_yes)
                    error = np.sum(weights[guess != y])      # add up the weight of the missed dots

                    if error < best_error:
                        best_error = error
                        self.feature = feature
                        self.threshold = threshold
                        self.says_if_yes = says_if_yes

        return best_error


class AdaBoost:
    def __init__(self, n_rounds=50):
        self.n_rounds = n_rounds
        self.helpers = []                # the stumps, in the order they were trained
        self.vote_powers = []            # how loud each helper is

    def fit(self, X, y):
        X = np.asarray(X, dtype=float)
        y = np.asarray(y)
        n = len(y)
        weights = np.full(n, 1 / n)      # everyone starts equal

        for round_number in range(self.n_rounds):
            # Step 1: train a helper on the weighted dots
            helper = Stump()
            error = helper.fit(X, y, weights)
            error = np.clip(error, 1e-10, 1 - 1e-10)      # stay away from 0 and 1 (no dividing by zero)

            # Step 2: turn its error into a vote power
            #   error small  -> big positive vote power
            #   error = 0.5  -> vote power 0 (a coin flip gets no voice)
            vote_power = 0.5 * np.log((1 - error) / error)

            # Step 3: make its mistakes heavier and its hits lighter
            missed = helper.predict(X) != y
            weights[missed] *= np.exp(vote_power)          # grow
            weights[~missed] *= np.exp(-vote_power)        # shrink
            weights /= weights.sum()                       # rescale so all weights add up to 1

            self.helpers.append(helper)
            self.vote_powers.append(vote_power)

        return self

    def team_score(self, X):
        """Every helper votes +1 or -1, times its vote power. We add it all up."""
        X = np.asarray(X, dtype=float)
        score = np.zeros(len(X))
        for helper, vote_power in zip(self.helpers, self.vote_powers):
            score += vote_power * helper.predict(X)
        return score

    def predict(self, X):
        return np.where(self.team_score(X) >= 0, 1, -1)   # the sign of the total is the answer


# ---------------------------------------------------------------------- try it
if __name__ == "__main__":
    # A toy dataset: class +1 inside a circle, class -1 outside.
    rng = np.random.default_rng(1)
    X = rng.uniform(0, 1, size=(500, 2))
    y = np.where((X[:, 0] - 0.5) ** 2 + (X[:, 1] - 0.5) ** 2 < 0.08, 1, -1)

    X_train, y_train = X[:350], y[:350]
    X_new, y_new = X[350:], y[350:]

    print("helpers | training data | new data")
    for n_rounds in [1, 5, 20, 60]:
        model = AdaBoost(n_rounds=n_rounds).fit(X_train, y_train)
        train_acc = np.mean(model.predict(X_train) == y_train)
        new_acc = np.mean(model.predict(X_new) == y_new)
        print(f"{n_rounds:7d} | {train_acc:13.0%} | {new_acc:8.0%}")

    # One stump alone can only draw one straight line, so it is weak.
    # A team of stumps, each fixing the last one's misses, draws the circle.
