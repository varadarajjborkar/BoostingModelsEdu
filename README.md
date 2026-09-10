# Boosting, Visually

A small, visual course on **boosting** in machine learning: AdaBoost, Gradient Boosting,
XGBoost, LightGBM and CatBoost. Simple words, short stories, and interactive charts
instead of walls of text.

Every chart runs the real algorithm in your browser (see `assets/js/ml.js`), so what you
see is what the algorithm actually does.

## Chapters

| # | Page | Big idea |
|---|------|----------|
| 00 | Warm-up | A tree is a game of yes/no questions. Bagging vs boosting. |
| 01 | AdaBoost | Missed points get heavier. Good helpers vote louder. |
| 02 | Gradient Boosting | Each new tree fixes the leftover error. |
| 03 | XGBoost | Slope + curve, a split scorecard, and brakes (λ, γ). |
| 04 | LightGBM | Buckets, leaf-wise growth, GOSS and feature bundling. |
| 05 | CatBoost | Categories without leaking the answer. Symmetric trees. |
| 06 | Face-off | Which one to pick, same knobs with different names, early stopping. |

Every chapter has the same rhythm: a story, things to play with, "under the hood" tabs
(math, pseudo-code, a from-scratch Python class, library usage), then a short recap and quiz.

## Run it locally

No build step. Either open `index.html` in a browser, or serve the folder:

```sh
python3 -m http.server 8000
# then open http://localhost:8000
```

Math (KaTeX), code highlighting (Prism) and fonts load from public CDNs, so an internet
connection is needed for those. Everything else works offline.

## Deploy on Vercel

1. Import this repository in Vercel.
2. Framework preset: **Other**. Build command: none. Output directory: the repo root.
3. Deploy. `vercel.json` turns on clean URLs (for example `/pages/03-xgboost`) and caching.

## The Python classes

`code/` holds small, beginner-friendly implementations written from scratch. They only need numpy:

```sh
pip install numpy
python code/decision_tree.py
python code/adaboost.py
python code/gradient_boosting.py
python code/xgboost_lite.py
python code/lightgbm_lite.py
python code/catboost_lite.py
```

Each file ends with a tiny demo that prints a table and explains what to notice.
The same code is shown inside the pages. After editing a file in `code/`, refresh the pages with:

```sh
python3 tools/embed_code.py
```

## Project layout

```
index.html              home page and learning path
pages/                  one HTML page per chapter
assets/css/style.css    the whole design system (beige paper look)
assets/js/viz.js        small SVG helpers (axes, sliders, step player, tree diagrams)
assets/js/ml.js         the algorithms used by the charts
assets/js/common.js     navigation, tabs, quizzes, math rendering
assets/js/glyphs.js     the small chapter icons
assets/js/pages/        the interactive parts of each chapter
code/                   runnable from-scratch Python classes
tools/embed_code.py     copies code/*.py into the pages
```
