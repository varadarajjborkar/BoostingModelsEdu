# Boosting, Visually: project memory (READ FIRST after any context reset)

This file is the persistent memory layer for this project. Keep it updated at the end
of every phase so work can resume exactly where it stopped. A local, untracked loader
file (listed in `.git/info/exclude`) points the coding assistant here automatically.

## Goal

A static multi-page learning website that teaches **boosting** in machine learning with
very simple words, strong metaphors, and lots of interactive visualizations.
Less text, more pictures. Math, pseudo-code and from-scratch Python classes are included
but tucked into tabs so pages never feel heavy.

Inspiration (layout/feel only, do NOT copy): arjunvirk.com/writing/ml-guide.

## Hard rules from the user

- Simple, easy words. Explain like to a smart beginner who is a bit slow at first.
- **Never mention exams, school grades, or age anywhere in site content.**
- **Never use em dashes** (the long dash) anywhere: site text, code comments, commit
  messages, this file, chat replies. Use commas, colons, periods or a plain hyphen.
- **Never mention the AI assistant or its maker, never add attribution trailers to
  commits or PRs, never write the user's personal email anywhere.** Commits use the
  GitHub noreply address already set in the local git config (`git config user.email`).
- Less text. Short lines. Visuals do the heavy lifting.
- Colour theme: **beige / milky-white** (not the dark look of the inspiration site).
- Core topics: **XGBoost, LightGBM, CatBoost** (most important) + max 2 more:
  **AdaBoost** and **Gradient Boosting (GBM)**. A short warm-up on trees + the boosting idea
  and a final comparison page are support pages, not extra "models".
- Commit phase-wise, regularly, with clear messages, then push.
- **Teaching code must be hand-crafted for beginners** (applies to the Python classes and
  pseudo-code shown as lesson content, not to the site's own JS). See style guide below.

### Style guide for lesson code (`code/*.py` and `pre.pseudo`)

- Use the **same words as the page**: "mess score", "yes group / no group", "leftover error",
  "vote power", "brake", "bucket". A reader should recognise the story in the code.
- Plain `for` loops over clever numpy tricks (no cumsum/mask gymnastics). Speed does not matter.
- Everyday variable names: `leftover`, `learning_rate`, `says_yes`, `heavier`, not `r`, `lr`, `m`.
- Short functions, one idea each, with a one-line docstring in plain words.
- `# Step 1 / Step 2 / Step 3` comments that mirror the pseudo-code steps.
- A module docstring that restates the big idea in 5 to 8 short lines.
- A small `__main__` demo that prints a readable table and ends with a comment saying
  what to notice.
- Pseudo-code: plain English, 3 or 4 named steps, same vocabulary, about 10 to 16 lines,
  keywords in `<b>`, notes in `<i>`, key ideas in `<u>`.
- Library tab: short, every argument commented with what it *means* in the story.

Pre-commit check (all must print nothing):

```sh
grep -rn $'\xe2\x80\x94' --exclude-dir=.git .
grep -rniE 'cl[a]ude|co-a[u]thored|gm[a]il\.com|anthrop[i]c' --exclude-dir=.git .
```

## Git

- Branch `main`, remote `origin` = <https://github.com/varadarajjborkar/BoostingModelsEdu.git>
- After each phase commit: `git push -u origin main` (user asked for this).
- Commit email = GitHub noreply address in the repo's local git config (user approved).
- 2026-09-10: Phase 0 and 1 commits were rewritten (attribution line, personal email and
  old memory filename removed) and force-pushed with the user's approval. Never force-push
  again without asking.

## Hosting (Vercel)

- User hosts on **Vercel** as a plain static site (no framework, no build command,
  output dir = repo root). `vercel.json`: `cleanUrls` (so `/pages/03-xgboost` works and
  `.html` links redirect), cache headers for `/assets`, `.py` served as text.
- `.vercelignore` keeps `PROJECT_MEMORY.md`, `README.md`, `tools/` off the live site.
  `code/*.py` stays public on purpose (learners can open/download the classes).
- Keep links **relative** (`../assets/...`, `pages/x.html`) so the site works both on
  Vercel and when opened straight from disk. Only `404.html` uses root-absolute paths
  (Vercel serves it at any depth).

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
  `regions(parent,f,scoreFn)`, `tree(svg,root,{W,H,boxW,boxH,font})` (node = `{lines, tone:'split'|'a'|'b', faded, children}`),
  `tip(html,evt)`, `slider(id,cb,fmt)` (uses `<output for=id>`),
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
  `.term[data-tip]`, `table.t` in `.table-wrap`, `.q-text`, `.ghost/.shown`, `.badge`.

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
- `pages/00-warmup.html` (`warmup.js`): best question (Gini), depth vs overfitting,
  mistakes as squares (bowl), bagging vs boosting stepper
- `pages/01-adaboost.html`
- `pages/02-gradient-boosting.html`
- `pages/03-xgboost.html`
- `pages/04-lightgbm.html`
- `pages/05-catboost.html`
- `pages/06-faceoff.html`: comparison, cheat-sheet, "which one to pick", tuning viz
- `assets/css/style.css`, `assets/js/common.js`, `assets/js/viz.js`, `assets/js/ml.js`,
  `assets/js/pages/*.js` (one per page)
- `code/*.py`: runnable from-scratch implementations (`decision_tree.py` done)
- `tools/embed_code.py`

## Phase status (update after each commit)

- [x] Phase 0: repo, memory, plan
- [x] Phase 1: design system, shared JS, home page
- [x] Phase 2: Warm-up page + Vercel config (vercel.json, .vercelignore, 404.html)
- [x] Phase 3: AdaBoost (flashcard metaphor, stepper with weights as dot size, alpha explorer)
- [x] Phase 4: Gradient Boosting (golf metaphor, leftover stepper `#gb=N`, learning-rate race,
  gradient bowl with squared vs absolute loss)
- [x] Phase 5: XGBoost (careful-hiker metaphor, slope vs slope+curve walkers, split scorecard,
  live pruning tree, missing-value default path, speed tiles; shared `drawTree` in xgboost.js)
- [x] Phase 6: LightGBM (post-office metaphor, buckets viz, level vs leaf-wise race `#lw=N`,
  GOSS bars, EFB table, lightgbm_lite.py)
- [x] Phase 7: CatBoost (waiting-line metaphor, leak simulation, queue stepper table `#qu=N`,
  symmetric tree toggles, catboost_lite.py)
- [ ] Phase 8: Face-off / comparison
- [ ] Phase 9: polish, screenshot check, README

## How to verify

- `for f in assets/js/*.js assets/js/pages/*.js; do node --check "$f"; done`
- Headless screenshot:
  `"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --user-data-dir=<scratch>/chrome --virtual-time-budget=6000 --screenshot=out.png --window-size=1300,2400 file://$PWD/pages/xx.html`
  (always use a scratch `--user-data-dir` so the user's real Chrome profile is untouched;
  CSS transitions do not advance under virtual time, so avoid transitions on live readouts).
  Crop tall shots with `sips -c <h> <w> --cropOffset <y> 0 in.png --out part.png`.
- Python: run each `code/*.py` with a numpy venv (scratch venv, not committed).

## Notes / decisions log

- XGBoost gain is taught as `sim(L) + sim(R) - sim(parent)`, prune if gain < gamma
  (matches the library code; the paper's version has a 1/2 factor, mentioned in the Math tab).
- `V.regions` paints a small canvas (120x90) stretched into an SVG `<image>`: smooth shading,
  no grid seams. Pass colour tokens by name (`pos:'--c1'`).
- Datasets are tuned so the lesson is visible: warm-up depth demo uses `moons(120, 0.28, 8)`
  (best new-data accuracy at depth 2, depth 10 = 100% train vs 86% new). Before choosing
  data for a demo, test candidate settings in node (load viz.js + ml.js with `vm`).
- Headless Chrome with a fresh `--user-data-dir` can hang after writing the PNG: run it in the
  background, wait for the file, then kill it (add `--no-first-run --disable-extensions`).
  Crop with Pillow (scratch venv), not `sips` (its crop offset is unreliable).
- Steppers support a hash deep link for screenshots/sharing, e.g.
  `01-adaboost.html#ada=25&data=noisy` pre-runs 25 rounds. Add the same to later steppers.
- AdaBoost team shading uses `tanh(3 * score / sum|alpha|)` so the shape stays visible.
  "Circle + wrong labels" flips the 6 deepest dots (they end up with ~3x their fair weight).

## Polish to-do (Phase 9)

- Replace inline `style="margin-top:..."` etc. with small utility classes (editor warnings).
- Add `type="button"` to every `.seg` button.
- Mobile check at 400px width for every page; long SVG labels.
- README with how to run locally + deploy on Vercel.
