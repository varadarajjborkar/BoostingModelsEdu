/* Shared site behaviour: nav, pager, footer, tabs, quizzes, math, copy buttons. */
(function () {
  const CHAPTERS = [
    { slug: '00-warmup', title: 'Warm-up', sub: 'Trees & the team idea',
      idea: 'One tiny tree is weak. A team of tiny trees is strong.' },
    { slug: '01-adaboost', title: 'AdaBoost', sub: 'Mistakes get louder',
      idea: 'Every round, the points we got wrong get heavier.' },
    { slug: '02-gradient-boosting', title: 'Gradient Boosting', sub: 'Fix what is left',
      idea: 'Each new tree fixes the leftover error of the team so far.' },
    { slug: '03-xgboost', title: 'XGBoost', sub: 'Boosting with brakes',
      idea: 'Knows the slope and the bend, and pays a fee for every branch.' },
    { slug: '04-lightgbm', title: 'LightGBM', sub: 'Built for speed',
      idea: 'Put numbers into buckets. Grow the most useful leaf first.' },
    { slug: '05-catboost', title: 'CatBoost', sub: 'Categories, no cheating',
      idea: 'Turn words into numbers without peeking at the answer.' },
    { slug: '06-faceoff', title: 'Face-off', sub: 'Which one to pick?',
      idea: 'Same idea, three personalities. Pick the right one fast.' },
  ];

  const body = document.body;
  const root = body.dataset.root || '';
  const page = body.dataset.page || 'home';
  const href = (c) => `${root}pages/${c.slug}.html`;

  const brandMark =
    '<svg class="brand-mark" viewBox="0 0 28 28" aria-hidden="true">' +
    '<rect x="2" y="17" width="6" height="9" rx="2" fill="var(--c1)"/>' +
    '<rect x="11" y="10" width="6" height="16" rx="2" fill="var(--c3)"/>' +
    '<rect x="20" y="2" width="6" height="24" rx="2" fill="var(--c2)"/></svg>';

  function visited() {
    try { return JSON.parse(localStorage.getItem('bv-visited') || '[]'); } catch (e) { return []; }
  }
  function markVisited() {
    if (page === 'home') return;
    try {
      const v = visited();
      if (!v.includes(page)) { v.push(page); localStorage.setItem('bv-visited', JSON.stringify(v)); }
    } catch (e) { /* storage blocked: fine */ }
  }

  function buildNav() {
    const host = document.getElementById('site-nav');
    if (!host) return;
    host.className = 'site-nav';
    host.innerHTML =
      `<div class="wrap"><a class="brand" href="${root}index.html">${brandMark}` +
      '<span class="brand-text">Boosting, Visually</span></a>' +
      '<nav class="chap-links" aria-label="Chapters">' +
      CHAPTERS.map((c) =>
        `<a href="${href(c)}"${c.slug === page ? ' class="active" aria-current="page"' : ''}>${c.title}</a>`).join('') +
      '</nav></div><div class="progress-bar"></div>';
    const links = host.querySelector('.chap-links');
    const act = host.querySelector('a.active');
    if (act) links.scrollLeft = act.offsetLeft - links.offsetLeft - (links.clientWidth - act.offsetWidth) / 2;
    const bar = host.querySelector('.progress-bar');
    const onScroll = () => {
      const h = document.documentElement;
      const max = h.scrollHeight - h.clientHeight;
      bar.style.width = (max > 0 ? (h.scrollTop / max) * 100 : 0) + '%';
    };
    addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  function buildPager() {
    const host = document.getElementById('pager');
    if (!host) return;
    const i = CHAPTERS.findIndex((c) => c.slug === page);
    if (i < 0) return;
    const prev = CHAPTERS[i - 1];
    const next = CHAPTERS[i + 1];
    host.className = 'wrap pager';
    host.innerHTML =
      (prev
        ? `<a class="prev" href="${href(prev)}"><div class="dir">← Previous</div><div class="t">${prev.title}</div></a>`
        : `<a class="prev" href="${root}index.html"><div class="dir">← Back</div><div class="t">The map</div></a>`) +
      (next
        ? `<a class="next" href="${href(next)}"><div class="dir">Next →</div><div class="t">${next.title}</div></a>`
        : `<a class="next" href="${root}index.html"><div class="dir">All done →</div><div class="t">Back to the map</div></a>`);
  }

  function buildFoot() {
    const host = document.getElementById('site-foot');
    if (!host) return;
    host.className = 'site-foot';
    host.innerHTML =
      '<div class="wrap"><span>Boosting, Visually: learn by playing, not by reading walls of text.</span>' +
      '<span>Every chart runs the real algorithm in your browser.</span></div>';
  }

  function initTabs() {
    document.querySelectorAll('[data-tabs]').forEach((box) => {
      const tabs = [...box.querySelectorAll('.tab')];
      const panels = [...box.querySelectorAll('.tab-panel')];
      const select = (i) => {
        tabs.forEach((t, j) => t.setAttribute('aria-selected', String(j === i)));
        panels.forEach((p, j) => { p.hidden = j !== i; });
      };
      box.querySelector('.tabs')?.setAttribute('role', 'tablist');
      tabs.forEach((t, i) => {
        t.setAttribute('role', 'tab');
        t.addEventListener('click', () => select(i));
      });
      select(0);
    });
  }

  function initQuiz() {
    document.querySelectorAll('.quiz').forEach((q) => {
      const ans = Number(q.dataset.answer);
      const opts = [...q.querySelectorAll('.opt')];
      const why = q.querySelector('.why');
      const whyText = why ? why.innerHTML : '';
      opts.forEach((o, i) => o.addEventListener('click', () => {
        if (q.classList.contains('done')) return;
        q.classList.add('done');
        opts[ans].classList.add('right');
        if (i !== ans) o.classList.add('wrong');
        if (why) {
          why.innerHTML = (i === ans ? '<b>Yes!</b> ' : '<b>Not quite.</b> ') + whyText +
            '<button class="again" type="button">try again</button>';
          why.querySelector('.again').addEventListener('click', () => {
            q.classList.remove('done');
            opts.forEach((x) => x.classList.remove('right', 'wrong'));
            why.innerHTML = whyText;
          });
        }
      }));
    });
  }

  function initCopy() {
    document.querySelectorAll('pre.code').forEach((pre) => {
      if (pre.parentElement.classList.contains('code-wrap')) return;
      const wrap = document.createElement('div');
      wrap.className = 'code-wrap';
      pre.parentNode.insertBefore(wrap, pre);
      wrap.appendChild(pre);
      const b = document.createElement('button');
      b.className = 'copy';
      b.type = 'button';
      b.textContent = 'Copy';
      b.addEventListener('click', async () => {
        try { await navigator.clipboard.writeText(pre.innerText); b.textContent = 'Copied ✓'; } catch (e) { b.textContent = 'Select & copy'; }
        setTimeout(() => { b.textContent = 'Copy'; }, 1400);
      });
      wrap.appendChild(b);
    });
  }

  // Glossary words: tap, hover or focus shows a small bubble that always stays on screen.
  function initTerms() {
    const terms = document.querySelectorAll('.term[data-tip]');
    if (!terms.length) return;
    const bub = document.createElement('div');
    bub.className = 'term-tip';
    bub.id = 'term-tip';
    bub.setAttribute('role', 'tooltip');
    bub.hidden = true;
    document.body.appendChild(bub);
    let cur = null;
    const hide = () => { bub.hidden = true; cur?.removeAttribute('aria-describedby'); cur = null; };
    const show = (t) => {
      if (cur && cur !== t) cur.removeAttribute('aria-describedby');
      cur = t;
      bub.textContent = t.dataset.tip;
      bub.hidden = false;
      t.setAttribute('aria-describedby', 'term-tip');
      const r = t.getBoundingClientRect(), b = bub.getBoundingClientRect();
      const above = r.top - b.height - 8;
      bub.style.left = Math.min(Math.max(8, r.left + r.width / 2 - b.width / 2), innerWidth - b.width - 8) + 'px';
      bub.style.top = (above > 8 ? above : r.bottom + 8) + 'px';
    };
    terms.forEach((t) => {
      if (!t.hasAttribute('tabindex')) t.tabIndex = 0;
      t.addEventListener('mouseenter', () => show(t));
      t.addEventListener('mouseleave', hide);
      t.addEventListener('focus', () => show(t));
      t.addEventListener('blur', hide);
      t.addEventListener('click', (e) => { e.stopPropagation(); show(t); });
    });
    document.addEventListener('click', hide);            // a tap anywhere else closes it
    addEventListener('scroll', hide, { passive: true });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') hide(); });
  }

  function renderMath() {
    if (typeof window.renderMathInElement !== 'function') return;
    window.renderMathInElement(document.body, {
      delimiters: [
        { left: '$$', right: '$$', display: true },
        { left: '\\(', right: '\\)', display: false },
        { left: '$', right: '$', display: false },
      ],
      throwOnError: false,
    });
  }

  // Render a KaTeX string into an element (used by live-updating readouts).
  function tex(elOrId, str, display = false) {
    const el = typeof elOrId === 'string' ? document.getElementById(elOrId) : elOrId;
    if (!el) return;
    if (window.katex) window.katex.render(str, el, { throwOnError: false, displayMode: display });
    else el.textContent = str;
  }

  window.SITE = { CHAPTERS, visited, tex, root, page };

  buildNav();
  buildPager();
  buildFoot();
  initTabs();
  initQuiz();
  initCopy();
  initTerms();
  renderMath();
  markVisited();
})();
