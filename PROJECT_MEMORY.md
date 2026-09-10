# Boosting, Visually: project memory (READ FIRST after any compaction)

This file is the persistent memory layer for this project. Keep it updated at the end
of every phase so work can resume exactly where it stopped.

## Goal
A static multi-page learning website that teaches **boosting** in machine learning with
very simple words, strong metaphors, and lots of interactive visualizations.
Less text, more pictures. Math, pseudo-code and from-scratch Python classes are included
but tucked into tabs so pages never feel heavy.

Inspiration (layout/feel only, do NOT copy): arjunvirk.com/writing/ml-guide.

## Hard rules from the user
- Simple, easy words. Explain like to a smart beginner who is a bit slow at first.
- **Never mention exams (JEE etc.), school grades, or age anywhere in site content.**
- Less text. Short lines. Visuals do the heavy lifting.
- Colour theme: **beige / milky-white** (not the dark look of the inspiration site).
- Core topics: **XGBoost, LightGBM, CatBoost** (most important) + max 2 more:
  **AdaBoost** and **Gradient Boosting (GBM)**. A short warm-up on trees + the boosting idea
  and a final comparison page are support pages, not extra "models".
- Commit phase-wise, regularly, with clear messages.

## Tech decisions
- Pure static site: HTML + CSS + vanilla JS. No build step. Open `index.html` directly.
- Visuals: hand-written SVG/Canvas driven by a tiny in-browser ML lib (`assets/js/ml.js`)
  so every chart shows *real* algorithm output, not fake drawings.
- Math: KaTeX from cdn.jsdelivr.net (auto-render, `$...$` inline, `$$...$$` display).
- Code highlight: Prism from cdnjs (Python).
- Fonts (Google Fonts): Fraunces (headings), Inter (body), JetBrains Mono (code).
- Python from-scratch classes live in `code/*.py` (runnable, numpy only) and are
  embedded into pages by `tools/embed_code.py` between markers:
  `<!-- CODE:file.py -->` ... `<!-- /CODE -->`. Edit the .py, then run the tool.

## Page structure (every lesson page follows this rhythm)
1. Hero: title + one-line "big idea".
2. Metaphor card (the story that makes it stick).
3. Interactive viz sections, each with 1–3 short lines of text.
4. "Under the hood" tabs: Math | Pseudo-code | Python class | Library usage.
5. "Remember it" card (3 bullets) + Quick check quiz (2–3 questions).
6. Prev / next navigation.

## Palette (tokens in assets/css/style.css)
- Paper `#FBF7EF`, card `#F4ECDD`, ink `#2A2520`, muted ink `#6B6258`, rule `#E2D6C2`.
- Chart surface (milky) `#FFFCF6`.
- Series colours (fixed order, validated vs #fffcf6, all checks PASS):
  `--c1 #2b6cb0` blue · `--c2 #d4602a` terracotta · `--c3 #239a74` green ·
  `--c4 #c98a00` mustard (contrast 2.88 → only use with visible label) · `--c5 #8a4fa6` plum.
  First 3 pass all-pairs (safe for scatter). Class A = `--pos` (c1), class B = `--neg` (c2).
- Single light theme on purpose (beige look is the brand); no dark mode.

## File map
- `index.html`: home + learning path
- `pages/00-warmup.html`: trees, weak learners, bagging vs boosting
- `pages/01-adaboost.html`
- `pages/02-gradient-boosting.html`
- `pages/03-xgboost.html`
- `pages/04-lightgbm.html`
- `pages/05-catboost.html`
- `pages/06-faceoff.html`: comparison, cheat-sheet, "which one to pick"
- `assets/css/style.css`, `assets/js/common.js` (nav, tabs, quiz, math), `assets/js/ml.js`,
  `assets/js/viz.js` (SVG helpers), `assets/js/pages/*.js` (one per page)
- `code/*.py`: runnable from-scratch implementations
- `tools/embed_code.py`

## Phase status  (update after each commit)
- [x] Phase 0: repo, memory, plan
- [ ] Phase 1: design system, shared JS, home page
- [ ] Phase 2: Warm-up page
- [ ] Phase 3: AdaBoost
- [ ] Phase 4: Gradient Boosting
- [ ] Phase 5: XGBoost
- [ ] Phase 6: LightGBM
- [ ] Phase 7: CatBoost
- [ ] Phase 8: Face-off / comparison
- [ ] Phase 9: polish, screenshots check, README

## How to verify
- `node --check assets/js/**/*.js` for syntax.
- Headless screenshot:
  `"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --screenshot=out.png --window-size=1300,2400 file://$PWD/pages/xx.html`
- Python: run each `code/*.py` with a numpy venv (scratch venv, not committed).

## Notes / decisions log
- (append short notes here as work progresses)
