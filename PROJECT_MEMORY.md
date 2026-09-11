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
  `regions(parent,f,scoreFn)`, `tree(svg,root,{W,H,boxW,boxH,font,horizontal})` (node = `{lines, tone:'split'|'a'|'b', faded, children}`;
  `horizontal:true` = root on the left, leaves stacked, used for wide trees on phones),
  `tip(html,evt)`, `slider(id,cb,fmt)` (uses `<output for=id>`),
  `seg(id,cb)`, `player({host,step,reset,canStep,speed})` (buttons `data-act=step|play|reset`),
  `drag(svg,handle,cb,axis)` (axis may be a function; see "Phones and fingers"), `fmt`, `clamp`, `onVisible(el,fn)`,
  `phone` (true when the page loaded at <= 600px wide) and `pick(desktop, phone)`.
- `ML` (ml.js): `fitStump`, `AdaBoost`, `fitRegTree`, `predictTree`, `leaves`, `fitClassTree`,
  `GBM`, `fitXgbTree(X,g,h,{maxDepth,lambda,gamma})`, `growTree(X,r,{policy,maxLeaves})`.
- `SITE` (common.js): `CHAPTERS`, `visited()`, `tex()`. Pages set `<body data-page=slug data-root="../">`
  and include empty `<header id="site-nav">`, `<nav id="pager">`, `<footer id="site-foot">`.
- Page markup kit (style.css): `.hero .kicker .big-idea .meta-row .pill`, `.sec .sec-head .sec-num .lede`,
  `.metaphor .story-map`, `.viz .viz-top .controls .ctrl .btn .seg .stats .stat .legend .caption .say-live`,
  `.flow .step`, `.note`, `.hood[data-tabs] .tabs .tab .tab-panel .eq .say .symbols`,
  `pre.code > code.language-python`, `pre.pseudo (b/i/u)`, `.remember`, `.quiz[data-answer] .opt .why`,
  `.term[data-tip]`, `table.t` in `.table-wrap`, `.q-text`, `.ghost/.shown`, `.badge`.

## Phones and fingers (Phase 10, keep this working)

- **Charts get a phone drawing, not a shrunk desktop one.** Every chart picks its size with
  `V.pick(desktopW, 340)` (heights too), so on a phone the viewBox is about as wide as the
  screen and text is near real pixels. Phone-only CSS bumps chart text a little
  (`.chart .axis text` 11.5 etc.). Wide trees switch to `horizontal:true`; the CatBoost leaf
  table becomes 2 rows of 4; crowded labels get a shorter phone wording via `V.pick`.
  Layout is chosen once at load (no re-draw on rotate: charts still scale fluidly).
- **Drag model** (`V.drag`): mouse drags anywhere. Finger: tap = jump there, sideways swipe =
  drag, up/down swipe = page scroll (the svg gets `touch-action: pan-y`). Anything marked
  `data-grip` (big transparent hit circles/lines, r 22 / stroke 30) drags in every direction
  and blocks scrolling; use it for y-axis handles (flat guess lines, knobs).
  Never set `touch-action: none` on a whole chart again: it traps page scrolling.
- **Tap targets**: under `@media (pointer: coarse)` buttons, toggles, tabs, nav links, sliders
  and quiz options are at least 44px tall. Hover effects live in `@media (hover: hover)`.
- **Glossary words** (`.term[data-tip]`) use a JS bubble (`initTerms` in common.js) that works on
  tap, stays on screen, and closes on tap elsewhere, scroll or Esc.
- Wide tables, the hood tabs and long equations show soft edge shadows while there is more
  to scroll (background `local` covers). On phones the first table column is sticky.
- `.chart .halo` puts a paper-coloured outline behind a label that crosses lines or bars.
- Checks: `node tools/phone-audit.mjs` (390px phone with touch: overflow, tap targets < 44px,
  text < 12px, chart text < 10px on screen, overlapping or escaping labels, script errors;
  `W=360` for small phones, `DESKTOP=1 W=1300` for desktop, `SHOTS=1 DPR=1.5` for full-page PNGs
  in the temp folder; DPR 2 on pages taller than ~8000px hits Chrome's 16384px capture limit and
  the image repeats) and `node tools/touch-test.mjs` (24 real touch gestures: scroll past charts,
  tap, sideways drag, grip drag, slider, glossary, tabs, quiz, toggles). Both drive headless
  Chrome over the DevTools protocol with Node's built-in WebSocket (Node 22+), no packages.
  Known and accepted: at 360px the two sideways trees show their small second lines at ~9.6px.

## Page structure (every lesson page follows this rhythm)

1. Hero: title + one-line "big idea".
2. Metaphor card (the story that makes it stick) with a story to ML map.
3. Interactive viz sections, each with 1 to 3 short lines of text.
4. "Under the hood" tabs: Math | Pseudo-code | Python class | Library usage.
5. "Remember it" card (3 bullets) + Quick check quiz (2 to 3 questions).
6. Prev / next navigation (auto from CHAPTERS).

No chapter numbers anywhere visible (user asked, 2026-09-11): the top nav shows titles only,
kickers are words ("Start here", "The classic booster", "The core recipe", "Core model",
"The finale"), home cards show the chapter's short line (`sub`), section numbers are plain
`1, 2, 3` (never `01`). The file slugs keep their `00-` prefixes (URLs only).

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
  `assets/js/glyphs.js` (chapter icons `GLYPHS[slug]`, load after common.js),
  `assets/js/pages/*.js` (one per page)
- `README.md`: run locally, deploy on Vercel, Python classes, layout (not deployed)
- `code/*.py`: runnable from-scratch implementations (`decision_tree.py` done)
- `tools/embed_code.py`, `tools/phone-audit.mjs`, `tools/touch-test.mjs` (not deployed)

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
- [x] Phase 8: Face-off (personas, pick-your-booster helper, side-by-side + knob translator
  tables, early stopping viz, one-screen cheat sheet; chapter icons in `assets/js/glyphs.js`
  used by home.js too; README.md)
- [x] Phase 9: polish (`type="button"` on seg buttons, `.sr-only` table headers, README,
  400px phone check via iframe wrapper: all pages fit, wide tables scroll in their box;
  console-error sweep: 0 errors on all 8 pages)
- [x] Phase 10 (2026-09-11): chapter numbers removed from the nav, kickers, home cards and
  section labels; full phone + finger pass (see "Phones and fingers"). Audit at 390px: zero
  findings on all 8 pages; touch test 24/24; desktop unchanged apart from fixes.

## Status: v1.1 (2026-09-11)

All 7 chapters + home are live-ready on desktop and phones. Ideas for later if the user asks:

- Replace remaining inline `style=` attributes with utility classes (editor warnings only).
- Optional extra topics the user may want later: SHAP / feature importance, tuning with Optuna.

## How to verify

- `for f in assets/js/*.js assets/js/pages/*.js; do node --check "$f"; done`
- `node tools/phone-audit.mjs` (also `W=360`, `DESKTOP=1 W=1300`) must print no findings
  (the 4 LightGBM tree panels with no text at step 0 are a known false flag), and
  `node tools/touch-test.mjs` must end with "all checks passed".
- Full-page PNGs: `SHOTS=1 DPR=1.5 node tools/phone-audit.mjs` (saved in the temp folder),
  crop them with Pillow in a scratch venv. For a single part of a page, clip a DevTools
  screenshot to the element's box (scroll it into view first).
- Quick desktop screenshot from the command line:
  `"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --user-data-dir=<scratch>/chrome --virtual-time-budget=6000 --screenshot=out.png --window-size=1300,2400 file://$PWD/pages/xx.html`
  (always use a scratch `--user-data-dir` so the user's real Chrome profile is untouched;
  CSS transitions do not advance under virtual time, so avoid transitions on live readouts).
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
  Chrome will not make a window narrower than ~500px from the command line. For phone checks
  use `tools/phone-audit.mjs` (DevTools device emulation gives a true 390px phone with touch).
  Console errors: the audit prints them per page.
- Steppers support a hash deep link for screenshots/sharing, e.g.
  `01-adaboost.html#ada=25&data=noisy` pre-runs 25 rounds. Add the same to later steppers.
- AdaBoost team shading uses `tanh(3 * score / sum|alpha|)` so the shape stays visible.
  "Circle + wrong labels" flips the 6 deepest dots (they end up with ~3x their fair weight).
