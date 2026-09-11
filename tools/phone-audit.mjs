// Open site pages in headless Chrome as a phone (mobile viewport + touch) and audit them.
// Usage: node tools/phone-audit.mjs [page ...]
// env: W=390 H=844 DPR=2 SHOTS=1 OUT=dir ALLCHARTS=1 DESKTOP=1 CHROME=/path/to/chrome
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';
import { tmpdir } from 'node:os';

const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');   // repo root (this file lives in tools/)
const TMP = tmpdir() + '/';   // scratch space for the Chrome profile and screenshots
const OUT = process.env.OUT || TMP + 'bv-phone';
const W = Number(process.env.W || 390), H = Number(process.env.H || 844);
const SHOTS = process.env.SHOTS === '1';
const PORT = 9333;
const ALL = ['index.html', 'pages/00-warmup.html', 'pages/01-adaboost.html', 'pages/02-gradient-boosting.html',
  'pages/03-xgboost.html', 'pages/04-lightgbm.html', 'pages/05-catboost.html', 'pages/06-faceoff.html'];
const pages = process.argv.slice(2).length ? process.argv.slice(2) : ALL;
mkdirSync(OUT, { recursive: true });

const chrome = spawn(process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', [
  '--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${TMP}bv-chrome-audit`,
  '--no-first-run', '--disable-extensions', '--hide-scrollbars', 'about:blank'], { stdio: 'ignore' });
const watchdog = setTimeout(() => { console.error('watchdog: timeout'); chrome.kill('SIGKILL'); process.exit(2); }, 240000);

async function waitPort() {
  for (let i = 0; i < 100; i++) {
    try { const r = await fetch(`http://127.0.0.1:${PORT}/json/list`); const j = await r.json(); const p = j.find((t) => t.type === 'page'); if (p) return p; } catch (e) { /* not up yet */ }
    await sleep(150);
  }
  throw new Error('chrome did not start');
}

export function connect(url) {
  return new Promise((res, rej) => {
    const ws = new WebSocket(url);
    let id = 0;
    const pending = new Map(), listeners = new Set();
    ws.onmessage = (m) => {
      const d = JSON.parse(m.data);
      if (d.id && pending.has(d.id)) { const p = pending.get(d.id); pending.delete(d.id); d.error ? p.reject(new Error(d.error.message)) : p.resolve(d.result); }
      else listeners.forEach((l) => l(d));
    };
    ws.onerror = rej;
    ws.onopen = () => res({
      send: (method, params = {}) => new Promise((resolve, reject) => { const i = ++id; pending.set(i, { resolve, reject }); ws.send(JSON.stringify({ id: i, method, params })); }),
      once: (name, ms = 15000) => new Promise((resolve) => {
        const l = (d) => { if (d.method === name) { listeners.delete(l); resolve(d.params); } };
        listeners.add(l); setTimeout(() => { listeners.delete(l); resolve(null); }, ms);
      }),
      on: (fn) => listeners.add(fn),
      close: () => ws.close(),
    });
  });
}

// Runs inside the page.
function audit() {
  const vw = innerWidth;
  const desc = (el) => {
    let s = el.tagName.toLowerCase();
    if (el.id) s += '#' + el.id;
    const c = typeof el.className === 'string' ? el.className.trim().split(/\s+/).filter(Boolean).slice(0, 2).join('.') : '';
    if (c) s += '.' + c;
    const t = (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 24);
    return t ? `${s} "${t}"` : s;
  };
  const visible = (el) => {
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height || el.closest('[hidden]')) return false;
    const cs = getComputedStyle(el);
    return cs.visibility !== 'hidden' && cs.display !== 'none';
  };
  const inScroller = (el) => {
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      const o = getComputedStyle(p).overflowX;
      if (o === 'auto' || o === 'scroll' || o === 'hidden') return true;
    }
    return false;
  };
  const out = {
    vw, scrollW: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight,
    coarse: matchMedia('(pointer: coarse)').matches, hoverNone: matchMedia('(hover: none)').matches,
  };
  out.overflow = [...document.querySelectorAll('body *')].filter((el) => {
    const r = el.getBoundingClientRect();
    return r.width && r.right > vw + 1 && !inScroller(el) && !el.closest('svg');
  }).slice(0, 12).map((el) => `${desc(el)} right=${Math.round(el.getBoundingClientRect().right)}`);

  // Tap targets smaller than 44 x 44 (inline links inside running text are exempt).
  const groups = {};
  document.querySelectorAll('a[href], button, input, select, [role=tab], [tabindex]:not([tabindex="-1"])').forEach((el) => {
    if (!visible(el) || el.closest('p, li, .note, .say, td, .caption, .lede')) return;
    const r = el.getBoundingClientRect();
    if (r.height >= 44 && r.width >= 44) return;
    const key = el.tagName.toLowerCase() + (typeof el.className === 'string' && el.className ? '.' + el.className.split(/\s+/)[0] : '') + (el.type === 'range' ? '[range]' : '');
    const g = groups[key] || (groups[key] = { n: 0, minW: 1e9, minH: 1e9, eg: desc(el) });
    g.n++; g.minW = Math.min(g.minW, Math.round(r.width)); g.minH = Math.min(g.minH, Math.round(r.height));
  });
  out.smallTargets = Object.entries(groups).map(([k, g]) => `${k} x${g.n} min ${g.minW}x${g.minH}  e.g. ${g.eg}`);

  // Chart text: size on screen, overlaps, and labels poking out of their card.
  out.charts = [...document.querySelectorAll('svg.chart')].filter(visible).map((s) => {
    const vb = s.viewBox.baseVal, r = s.getBoundingClientRect(), k = r.width / vb.width;
    const texts = [...s.querySelectorAll('text')].filter((t) => t.textContent.trim() && !t.closest('.ghost') && getComputedStyle(t).visibility !== 'hidden');
    const sizes = texts.map((t) => parseFloat(getComputedStyle(t).fontSize) * k);
    const boxes = texts.map((t) => t.getBoundingClientRect());
    const hits = [];
    for (let a = 0; a < boxes.length; a++) for (let b = a + 1; b < boxes.length; b++) {
      const A = boxes[a], B = boxes[b];
      const ox = Math.min(A.right, B.right) - Math.max(A.left, B.left), oy = Math.min(A.bottom, B.bottom) - Math.max(A.top, B.top);
      if (ox > 1.5 && oy > 2.5) hits.push(`"${texts[a].textContent}" x "${texts[b].textContent}"`);
    }
    const card = s.closest('.viz, .hero-card, .tab-panel, .metaphor, .persona') || s.parentElement;
    const cr = card.getBoundingClientRect();
    const outside = texts.filter((t, j) => boxes[j].left < cr.left - 1 || boxes[j].right > cr.right + 1 || boxes[j].right > vw).map((t) => t.textContent);
    const name = (s.parentElement.id || s.closest('[id]')?.id || '?') + ' ' + (s.getAttribute('aria-label') || '').slice(0, 28);
    return {
      name, vb: `${vb.width}x${vb.height}`, px: `${Math.round(r.width)}x${Math.round(r.height)}`, k: +k.toFixed(2),
      minFont: sizes.length ? +Math.min(...sizes).toFixed(1) : null, under10: sizes.filter((v) => v < 10).length, texts: texts.length,
      hits: hits.slice(0, 6), outside: outside.slice(0, 4),
    };
  });

  // HTML text below 12px.
  const small = {};
  document.querySelectorAll('body *:not(svg):not(svg *)').forEach((el) => {
    if (![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) return;
    if (!visible(el) || el.closest('.katex')) return;
    const fs = parseFloat(getComputedStyle(el).fontSize);
    if (fs < 12) { const key = desc(el).split(' ')[0]; small[key] = Math.min(small[key] || 99, fs); }
  });
  out.smallText = Object.entries(small).map(([k, v]) => `${k} ${v}px`);
  return out;
}

async function run() {
  const target = await waitPort();
  const c = await connect(target.webSocketDebuggerUrl);
  await c.send('Page.enable');
  await c.send('Runtime.enable');
  const errors = [];
  c.on((d) => {
    if (d.method === 'Runtime.exceptionThrown') errors.push(d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text);
    if (d.method === 'Runtime.consoleAPICalled' && d.params.type === 'error') errors.push(d.params.args.map((a) => a.value || a.description).join(' '));
  });
  const DESK = process.env.DESKTOP === '1';   // desktop run: plain mouse window, no phone emulation
  await c.send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: DESK ? 1 : Number(process.env.DPR || 2), mobile: !DESK });
  if (!DESK) {
    await c.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
    await c.send('Emulation.setEmulatedMedia', { features: [{ name: 'pointer', value: 'coarse' }, { name: 'hover', value: 'none' }] }).catch(() => {});
  }
  const report = {};
  for (const p of pages) {
    errors.length = 0;
    const load = c.once('Page.loadEventFired');
    await c.send('Page.navigate', { url: `file://${ROOT}/${p}` });
    await load;
    await c.send('Runtime.evaluate', { expression: 'document.fonts.ready.then(() => 1)', awaitPromise: true });
    await sleep(900);
    const r = await c.send('Runtime.evaluate', { expression: `(${audit.toString()})()`, returnByValue: true });
    const res = r.result.value || { error: r.exceptionDetails?.text };
    res.errors = errors.slice();
    report[p] = res;
    if (SHOTS) {
      const hh = res.height || 3000;
      const shot = await c.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { x: 0, y: 0, width: W, height: hh, scale: 1 } });
      writeFileSync(`${OUT}/${p.replace(/^pages\//, '').replace('.html', '')}.png`, Buffer.from(shot.data, 'base64'));
    }
  }
  writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 1));
  for (const [p, r] of Object.entries(report)) {
    console.log(`\n=== ${p}  (vw ${r.vw}, scrollW ${r.scrollW}, h ${r.height}, coarse ${r.coarse}, hoverNone ${r.hoverNone})`);
    if (r.errors?.length) console.log('  ERRORS:', r.errors);
    if (r.overflow?.length) console.log('  overflow:', r.overflow);
    if (r.smallTargets?.length) console.log('  small targets:\n    ' + r.smallTargets.join('\n    '));
    if (r.smallText?.length) console.log('  small text:', r.smallText.join(', '));
    (r.charts || []).forEach((ch) => {
      const flag = ch.minFont < 10 || ch.hits.length || ch.outside.length;
      if (flag || process.env.ALLCHARTS) console.log(`  chart ${ch.name} | vb ${ch.vb} -> ${ch.px} k=${ch.k} minFont ${ch.minFont} under10 ${ch.under10}/${ch.texts}` +
        (ch.hits.length ? `\n      overlaps: ${ch.hits.join('; ')}` : '') + (ch.outside.length ? `\n      outside card: ${ch.outside.join(' | ')}` : ''));
    });
  }
  c.close();
}

run().catch((e) => { console.error(e); }).finally(() => { clearTimeout(watchdog); chrome.kill('SIGKILL'); });
