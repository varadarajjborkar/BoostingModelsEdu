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
- **Never use em dashes** (the long dash) anywhere: site text, code comments, commit
  messages, this file, chat replies. Use commas, colons, periods or a plain hyphen.
  Before every commit run: `grep -rn $'\xe2\x80\x94' --exclude-dir=.git .` and fix any hit.
- Less text. Short lines. Visuals do the heavy lifting.
- Colour theme: **beige / milky-white** (not the dark look of the inspiration site).
- Core topics: **XGBoost, LightGBM, CatBoost** (most important) + max 2 more:
  **AdaBoost** and **Gradient Boosting (GBM)**. A short warm-up on trees + the boosting idea
  and a final comparison page are support pages, not extra "models".
- Commit phase-wise, regularly, with clear messages, then push.

## Git

- Branch `main`, remote `origin` = <https://github.com/varadarajjborkar/BoostingModelsEdu.git>
- After each phase commit: `git push -u origin main` (user asked for this).

## Tech decisions

- Pure static site: HTML + CSS + vanilla JS. No build step. Open `index.html` directly.
- Visuals: hand-written SVG driven by a tiny in-browser ML lib (`assets/js/ml.js`)
  so every chart shows *real* algorithm output, not fake drawings.
- Math: KaTeX from cdn.jsdelivr.net (auto-render, `$...$` inline, `$$...$$` display).
  Live readouts use `SITE.tex(el, str)`.
- Code highlight: Prism from cdnjs (Python). Token colours are in style.css.
- Fonts (Google Fonts): Fraunces (headings), Inter (body), JetBrains Mono (code).
- Python from-scratch classes live in `code/*.py` (runnable, numpy only) and are
  embedded into pages by `tools/embed_code.py` between markers:
  `<!-- CODE:file.py -->` ... `<!-- /CODE -->`. Edit the .py, then run the tool.

## Shared JS API (so pages stay consistent)

- `V` (viz.js): `svg(host,W,H,label)`, `frame({W,H,m,x,y})` gives `{sx,sy,left,right,top,bottom,iw,ih}`,
  `axes(parent,f,opts)`, `el`, `text`, `line(pts)`, `rng(seed)`, datasets `wave/moons/ring/blobs`,
  `regions(parent,f,scoreFn)`, `tip(html,evt)`, `slider(id,cb,fmt)` (uses `<output for=id>`),
  `seg(id,cb)`, `player({host,step,reset,canStep,speed})` (buttons `data-act=step|play|reset`),
  `drag(svg,handle,cb,axis)`, `fmt`, `clamp`, `onVisible(el,fn)`.
- `ML` (ml.js): `fitStump`, `AdaBoost`, `fitRegTree`, `predictTree`, `leaves`, `fitClassTree`,
  `GBM`, `fitXgbTree(X,g,h,{maxDepth,lambda,gamma})`, `growTree(X,r,{policy,maxLeaves})`.
- `SITE` (common.js): `CHAPTERS`, `visited()`, `tex()`. Pages set `<body data-page=slug data-root="../">`
  and include empty `<header id="site-nav">`, `<nav id="pager">`, `<footer id="site-foot">`.
- Page markup kit (style.css): `.hero .kicker .big-idea .meta-row .pill`, `.sec .sec-head .sec-num .lede`,
  `.metaphor .story-map`, `.viz .viz-top .controls .ctrl .btn .seg .stats .stat .legend .caption .say-live`,
  `.flow .step`, `.note`, `.hood[data-tabs] .tabs .tab .tab-panel .eq .say .symbols`,
  `pre.code > code.language-python`, `pre.pseudo (b/i/u)`, `.remember`, `.quiz[data-answer] .opt .why`,
  `.term[data-tip]`, `table.t` in `.table-wrap`.

## Page structure (every lesson page follows this rhythm)

1. Hero: title + one-line "big idea".
2. Metaphor card (the story that makes it stick) with a story to ML map.
3. Interactive viz sections, each with 1 to 3 short lines of text.
4. "Under the hood" tabs: Math | Pseudo-code | Python class | Library usage.
5. "Remember it" card (3 bullets) + Quick check quiz (2 to 3 questions).
6. Prev / next navigation (auto from CHAPTERS).

## Palette (tokens in assets/css/style.css)

- Paper `#FBF7EF`, band `#F4ECDF`, card/chart surface `#FFFCF6`, ink `#2A2520`, ink-2 `#5B5248`,
  muted `#8A8074`, rules `#E9E0D0` / `#D6C8B1`.
- Series colours (fixed order, validated vs #fffcf6, all checks PASS):
  `--c1 #2b6cb0` blue, `--c2 #d4602a` terracotta, `--c3 #239a74` green,
  `--c4 #c98a00` mustard (contrast 2.88, only use with visible label), `--c5 #8a4fa6` plum.
  First 3 pass all-pairs (safe for scatter). Class A = `--pos` (c1), class B = `--neg` (c2).
- Single light theme on purpose (beige look is the brand); no dark mode.

## File map

- `index.html`: home + learning path (`assets/js/pages/home.js`)
- `pages/00-warmup.html`: trees, weak learners, measuring mistakes, bagging vs boosting
- `pages/01-adaboost.html`
- `pages/02-gradient-boosting.html`
- `pages/03-xgboost.html`
- `pages/04-lightgbm.html`
- `pages/05-catboost.html`
- `pages/06-faceoff.html`: comparison, cheat-sheet, "which one to pick", tuning viz
- `assets/css/style.css`, `assets/js/common.js`, `assets/js/viz.js`, `assets/js/ml.js`,
  `assets/js/pages/*.js` (one per page)
- `code/*.py`: runnable from-scratch implementations
- `tools/embed_code.py`

## Phase status (update after each commit)

- [x] Phase 0: repo, memory, plan
- [x] Phase 1: design system, shared JS, home page
- [ ] Phase 2: Warm-up page
- [ ] Phase 3: AdaBoost
- [ ] Phase 4: Gradient Boosting
- [ ] Phase 5: XGBoost
- [ ] Phase 6: LightGBM
- [ ] Phase 7: CatBoost
- [ ] Phase 8: Face-off / comparison
- [ ] Phase 9: polish, screenshot check, README

## How to verify

- `for f in assets/js/*.js assets/js/pages/*.js; do node --check "$f"; done`
- Headless screenshot:
  `"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --user-data-dir=<scratch>/chrome --virtual-time-budget=6000 --screenshot=out.png --window-size=1300,2400 file://$PWD/pages/xx.html`
  (always use a scratch `--user-data-dir` so the user's real Chrome profile is untouched;
  CSS transitions do not advance under virtual time, so avoid transitions on live readouts)
- Python: run each `code/*.py` with a numpy venv (scratch venv, not committed).

## Notes / decisions log

- XGBoost gain is taught as `sim(L) + sim(R) - sim(parent)`, prune if gain < gamma
  (matches the library code; the paper's version has a 1/2 factor, mentioned in the Math tab).
