// Drive real finger gestures on the phone layout and check the site reacts the right way.
// Usage: node tools/touch-test.mjs      env: CHROME=/path/to/chrome
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { tmpdir } from 'node:os';

const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');   // repo root (this file lives in tools/)
const TMP = tmpdir() + '/';   // scratch space for the Chrome profile and screenshots
const PORT = 9334;
const chrome = spawn(process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', [
  '--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${TMP}bv-chrome-touch`,
  '--no-first-run', '--disable-extensions', '--hide-scrollbars', 'about:blank'], { stdio: 'ignore' });
const watchdog = setTimeout(() => { console.error('watchdog: timeout'); chrome.kill('SIGKILL'); process.exit(2); }, 180000);

async function waitPort() {
  for (let i = 0; i < 100; i++) {
    try { const j = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json(); const p = j.find((t) => t.type === 'page'); if (p) return p; } catch (e) { /* not up yet */ }
    await sleep(150);
  }
  throw new Error('chrome did not start');
}
function connect(url) {
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

let c, fails = 0;
const ev = async (expr) => (await c.send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })).result.value;
const check = (name, ok, info = '') => { if (!ok) fails++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${info ? '   (' + info + ')' : ''}`); };

async function open(p) {
  const load = c.once('Page.loadEventFired');
  await c.send('Page.navigate', { url: `file://${ROOT}/${p}` });
  await load;
  await ev('document.fonts.ready.then(() => 1)');
  await sleep(500);
}
// Put an element in the middle of the screen and return its box.
const center = (sel) => ev(`(() => { const e = document.querySelector(${JSON.stringify(sel)});
  e.scrollIntoView({ block: 'center', behavior: 'instant' }); const r = e.getBoundingClientRect();
  return { x: r.left, y: r.top, w: r.width, h: r.height }; })()`);
const box = (sel) => ev(`(() => { const r = document.querySelector(${JSON.stringify(sel)}).getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; })()`);
const text = (sel) => ev(`document.querySelector(${JSON.stringify(sel)}).textContent`);
const scrollY = () => ev('scrollY');

async function swipe(a, b, steps = 10) {
  await c.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: a[0], y: a[1] }] });
  for (let i = 1; i <= steps; i++) {
    await sleep(16);
    await c.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: a[0] + ((b[0] - a[0]) * i) / steps, y: a[1] + ((b[1] - a[1]) * i) / steps }] });
  }
  await sleep(16);
  await c.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await sleep(450);
}
async function tap(x, y) {
  await c.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
  await sleep(40);
  await c.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await sleep(300);
}
const num = (s) => Number((s.match(/-?\d+\.\d+/) || [NaN])[0]);

async function run() {
  c = await connect((await waitPort()).webSocketDebuggerUrl);
  await c.send('Page.enable');
  await c.send('Runtime.enable');
  const errors = [];
  c.on((d) => { if (d.method === 'Runtime.exceptionThrown') errors.push(d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text); });
  await c.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await c.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });

  // ---------- Warm-up: split finder ----------
  await open('pages/00-warmup.html');
  const SP = '#split-viz .plot svg';
  let r = await center(SP);
  let q0 = await text('#sp-q'), y0 = await scrollY();
  await swipe([r.x + r.w * 0.3, r.y + r.h * 0.75], [r.x + r.w * 0.3, r.y + r.h * 0.15]);
  let y1 = await scrollY();
  check('split: up/down swipe on the chart scrolls the page', y1 - y0 > 60, `scrolled ${y1 - y0}px`);
  check('split: ...and does not move the cut', (await text('#sp-q')) === q0, await text('#sp-q'));
  r = await center(SP);
  await tap(r.x + r.w * 0.3, r.y + r.h * 0.5);
  let v = num(await text('#sp-q'));
  check('split: a tap jumps the cut there', v > 0.1 && v < 0.35, `cut ${v}`);
  y0 = await scrollY();
  await swipe([r.x + r.w * 0.3, r.y + r.h * 0.5], [r.x + r.w * 0.85, r.y + r.h * 0.52]);
  v = num(await text('#sp-q'));
  check('split: sideways drag moves the cut', v > 0.7, `cut ${v}`);
  check('split: ...without scrolling', Math.abs((await scrollY()) - y0) < 3);
  const segB = await box('#sp-feat button[data-v="1"]');
  await tap(segB.x + segB.w / 2, segB.y + segB.h / 2);
  check('split: tap switches to feature 2', (await text('#sp-q')).includes('feature 2'), await text('#sp-q'));
  r = await center(SP);
  const hit = await box(`${SP} line[data-grip]`);
  y0 = await scrollY();
  await swipe([r.x + r.w * 0.5, hit.y + hit.h / 2], [r.x + r.w * 0.5, hit.y + hit.h / 2 - 70]);
  v = num(await text('#sp-q'));
  check('split: dragging the flat line up moves it (grip)', v > 0.62, `cut ${v}`);
  check('split: ...and the page stays still', Math.abs((await scrollY()) - y0) < 3, `moved ${(await scrollY()) - y0}`);

  // ---------- Warm-up: a mistake is a square ----------
  const LS = '#loss-viz .plot svg';
  r = await center(LS);
  let c0 = await text('#ls-c'); y0 = await scrollY();
  await swipe([r.x + r.w * 0.5, r.y + r.h * 0.4], [r.x + r.w * 0.5, r.y + r.h * 0.05]);
  check('loss: swipe away from the line scrolls the page', (await scrollY()) - y0 > 40, `scrolled ${(await scrollY()) - y0}px`);
  check('loss: ...and keeps the guess', (await text('#ls-c')) === c0);
  r = await center(LS);
  const gh = await box(`${LS} line[data-grip]`);
  y0 = await scrollY();
  await swipe([r.x + r.w * 0.6, gh.y + gh.h / 2], [r.x + r.w * 0.6, gh.y + gh.h / 2 - 80]);
  v = Number(await text('#ls-c'));
  check('loss: dragging the guess line moves it', v > Number(c0) + 1, `guess ${c0} -> ${v}`);
  check('loss: ...and the page stays still', Math.abs((await scrollY()) - y0) < 3);
  r = await center(LS);
  await tap(r.x + r.w * 0.5, r.y + r.h * 0.85);
  v = Number(await text('#ls-c'));
  check('loss: a tap jumps the guess there', v < 2, `guess ${v}`);

  // ---------- Warm-up: slider, glossary, tabs, quiz ----------
  r = await center('#dp-depth');
  await swipe([r.x + 10, r.y + r.h / 2], [r.x + r.w * 0.85, r.y + r.h / 2]);
  v = Number(await ev("document.getElementById('dp-depth').value"));
  check('depth slider: finger drag changes it', v >= 7, `depth ${v}`);
  r = await center('.term');
  await tap(r.x + r.w / 2, r.y + r.h / 2);
  const tip = await ev("(() => { const t = document.querySelector('.term-tip'); if (!t || t.hidden) return null; const b = t.getBoundingClientRect(); return { l: b.left, r: b.right, t: b.top, text: t.textContent.slice(0, 30) }; })()");
  check('glossary: tap shows the bubble on screen', !!tip && tip.l >= 0 && tip.r <= 390 && tip.t >= 0, JSON.stringify(tip));
  await tap(20, 400);
  check('glossary: tap elsewhere closes it', await ev("document.querySelector('.term-tip').hidden"));
  r = await center('.hood .tab:nth-child(2)');
  await tap(r.x + r.w / 2, r.y + r.h / 2);
  check('tabs: tap opens the second tab', (await ev("document.querySelector('.hood .tab:nth-child(2)').getAttribute('aria-selected')")) === 'true');
  r = await center('.quiz .opt');
  await tap(r.x + r.w / 2, r.y + r.h / 2);
  check('quiz: tap answers it', await ev("document.querySelector('.quiz').classList.contains('done')"));

  // ---------- Gradient boosting: the bowl ----------
  await open('pages/02-gradient-boosting.html');
  const GR = '#grad-viz .plot svg';
  r = await center(GR);
  let f0 = await text('#gr-f'); y0 = await scrollY();
  await swipe([r.x + r.w * 0.8, r.y + r.h * 0.7], [r.x + r.w * 0.8, r.y + r.h * 0.1]);
  check('bowl: up/down swipe scrolls the page', (await scrollY()) - y0 > 60);
  check('bowl: ...and keeps the guess', (await text('#gr-f')) === f0);
  r = await center(GR);
  await swipe([r.x + r.w * 0.3, r.y + r.h * 0.5], [r.x + r.w * 0.75, r.y + r.h * 0.5]);
  v = Number(await text('#gr-f'));
  check('bowl: sideways drag moves the guess', v > 5, `guess ${f0} -> ${v}`);

  // ---------- XGBoost: split scorecard ----------
  await open('pages/03-xgboost.html');
  r = await center('#sc-plot svg');
  const s0 = await text('#sc-say');
  await tap(r.x + r.w * 0.82, r.y + r.h * 0.5);
  check('scorecard: tap moves the cut', (await text('#sc-say')) !== s0);

  // ---------- CatBoost: yes/no toggles ----------
  await open('pages/05-catboost.html');
  const say0 = await text('#ob-say');
  r = await center('#ob-q1 button[data-v="1"]');
  await tap(r.x + r.w / 2, r.y + r.h / 2);
  check('catboost: tap a yes/no toggle updates the path', (await text('#ob-say')) !== say0);

  check('no script errors during the gestures', errors.length === 0, errors.join(' | '));
  console.log(fails ? `\n${fails} check(s) failed` : '\nall checks passed');
  c.close();
}

run().catch((e) => { console.error(e); fails++; }).finally(() => { clearTimeout(watchdog); chrome.kill('SIGKILL'); process.exitCode = fails ? 1 : 0; });
