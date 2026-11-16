// Drives the web app in headless Chrome at phone size, step by step.
// usage: node tests/e2e/run.mjs <scenario.json>
// Output (screenshots, downloads, browser profiles, shared values) goes to tests/e2e/.out (git-ignored).
//
// Steps: go, reload, goUrl, wait, offline, installable, setVar, mailLink, tap, text, type, eval, save,
// slide, file, expect, expectNot, waitFor, expectFile, shot. "{{name}}" in a step is replaced by a
// saved value (vars.json), so scenarios can hand invite links and kit words to each other.
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const out = process.env.E2E_OUT ?? join(here, '.out');
const scenarioPath = resolve(process.argv[2]);
const scenario = JSON.parse(readFileSync(scenarioPath, 'utf8'));
const base = scenario.base ?? process.env.E2E_BASE ?? 'http://localhost:8081';
try {
  await fetch(base);
} catch {
  console.log(`SERVER DOWN: ${base} is not answering. Start it first.`);
  process.exit(2);
}
const profile = join(out, 'profiles', scenario.profile ?? 'default');
if (scenario.fresh) rmSync(profile, { recursive: true, force: true });
mkdirSync(profile, { recursive: true });
mkdirSync(join(out, 'shots'), { recursive: true });
const assetPath = (p) => (isAbsolute(p) ? p : existsSync(join(here, p)) ? join(here, p) : join(out, p));

const CHROME = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const port = 9300 + Math.floor(Math.random() * 500);
const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--no-first-run', 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let target;
for (let i = 0; i < 50 && !target; i++) {
  await sleep(200);
  try { target = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find((t) => t.type === 'page'); } catch {}
}
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r, { once: true }));
let id = 0;
const pending = new Map();
const errors = [];
const choosers = [];
ws.addEventListener('message', (e) => {
  const msg = JSON.parse(e.data);
  if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
  if (msg.method === 'Page.fileChooserOpened') choosers.shift()?.(msg.params);
  if (msg.method === 'Runtime.exceptionThrown') errors.push(msg.params.exceptionDetails?.exception?.description?.split('\n')[0] ?? 'exception');
  if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') errors.push('console.error: ' + JSON.stringify(msg.params.args.map((a) => a.value ?? a.description)).slice(0, 300));
});
const send = (method, params = {}) => new Promise((res) => { const n = ++id; pending.set(n, res); ws.send(JSON.stringify({ id: n, method, params })); });
const evaluate = async (expression) => {
  const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true, userGesture: true });
  if (r.result?.exceptionDetails) return 'EVAL ERROR ' + JSON.stringify(r.result.exceptionDetails).slice(0, 200);
  return r.result?.result?.value;
};

const HELPERS = `
window.__q = (t) => document.querySelector('[data-testid="' + t + '"]');
window.__tap = (t) => { const el = __q(t); if (!el) return 'MISSING ' + t; el.click(); return 'ok'; };
window.__text = (text) => { const all = [...document.querySelectorAll('[role="button"],[role="tab"],[role="checkbox"],[role="radio"],[role="link"],a,[tabindex]')]; const el = all.reverse().find(e => e.textContent.trim() === text || e.getAttribute('aria-label') === text); if (!el) return 'MISSING text ' + text; el.click(); return 'ok'; };
window.__type = (t, v) => { let el = __q(t); if (!el) return 'MISSING ' + t; if (!/INPUT|TEXTAREA/.test(el.tagName)) el = el.querySelector('input,textarea'); if (!el) return 'MISSING input in ' + t; const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); return 'ok'; };
window.__has = (s) => document.body.innerText.toLowerCase().includes(s.toLowerCase());
`;

await send('Runtime.enable');
await send('Page.enable');
await send('DOM.enable');
await send('Page.setInterceptFileChooserDialog', { enabled: true });
const downloadDir = join(out, 'downloads', scenario.profile ?? 'default');
rmSync(downloadDir, { recursive: true, force: true });
mkdirSync(downloadDir, { recursive: true });
await send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: downloadDir });
if (scenario.noWebShare) {
  // Like a browser without the Web Share API: the app must fall back to a download.
  await send('Page.addScriptToEvaluateOnNewDocument', { source: "Object.defineProperty(Navigator.prototype,'share',{value:undefined,configurable:true});Object.defineProperty(Navigator.prototype,'canShare',{value:undefined,configurable:true});" });
}
const W = scenario.width ?? 390;
const H = scenario.height ?? 844;
await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 2, mobile: true });
const setDark = (dark) => send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: dark ? 'dark' : 'light' }] });
await setDark(!!scenario.dark);

const varsFile = join(out, 'vars.json');
let vars = {};
try { vars = JSON.parse(readFileSync(varsFile, 'utf8')); } catch {}
const saveVars = () => writeFileSync(varsFile, JSON.stringify(vars, null, 1));
const fill = (v) => (typeof v === 'string' ? v.replace(/\{\{(\w+)\}\}/g, (_, k) => (vars[k] ?? `{{${k}}}`)) : v);
const MAILPIT = process.env.MAILPIT ?? 'http://127.0.0.1:54324';

/** The newest unseen email to an address, as the link inside it (confirm or reset). */
async function mailLink(address, timeoutMs = 30000) {
  const until = Date.now() + timeoutMs;
  vars.mailSeen ??= [];
  while (Date.now() < until) {
    const r = await (await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:"${address}"`)}`)).json();
    const fresh = (r.messages ?? []).find((m) => !vars.mailSeen.includes(m.ID));
    if (fresh) {
      vars.mailSeen.push(fresh.ID);
      saveVars();
      const msg = await (await fetch(`${MAILPIT}/api/v1/message/${fresh.ID}`)).json();
      const html = (msg.HTML || msg.Text || '').replace(/&amp;/g, '&');
      const link = html.match(/https?:\/\/[^"'\s<>]+\/auth\/v1\/verify[^"'\s<>]*/)?.[0] ?? html.match(/https?:\/\/localhost:8081[^"'\s<>]+/)?.[0];
      return { subject: fresh.Subject, link };
    }
    await sleep(1000);
  }
  return null;
}

let failures = 0;
for (const rawStep of scenario.steps) {
  const [kind, rawArg, rawArg2] = Array.isArray(rawStep) ? rawStep : [rawStep];
  const arg = fill(rawArg);
  const arg2 = fill(rawArg2);
  let result = '';
  if (kind === 'go') { await send('Page.navigate', { url: `${base}${arg}` }); await sleep(arg2 ?? 2500); }
  else if (kind === 'reload') { await send('Page.reload', { ignoreCache: false }); await sleep(arg ?? 3000); }
  else if (kind === 'goUrl') { await send('Page.navigate', { url: arg }); await sleep(arg2 ?? 3500); result = String(arg).slice(0, 80); }
  else if (kind === 'offline') { await send('Network.enable'); await send('Network.emulateNetworkConditions', { offline: !!arg, latency: 0, downloadThroughput: -1, uploadThroughput: -1 }); result = arg ? 'now offline' : 'back online'; }
  else if (kind === 'installable') {
    const m = await send('Page.getAppManifest');
    const inst = await send('Page.getInstallabilityErrors');
    const errs = (inst.result?.installabilityErrors ?? []).map((e) => e.errorId);
    result = `manifest errors: ${JSON.stringify(m.result?.errors ?? [])}; installability errors: ${JSON.stringify(errs)}`;
    if ((m.result?.errors ?? []).length || errs.length) result = 'EXPECTED installable but ' + result;
  }
  else if (kind === 'wait') await sleep(arg);
  else if (kind === 'dark') await setDark(arg);
  else if (kind === 'setVar') { vars[arg] = arg2; saveVars(); result = `${arg} = ${String(arg2).slice(0, 60)}`; }
  else if (kind === 'mailLink') {
    const mail = await mailLink(arg);
    if (!mail?.link) result = `EXPECTED an email with a link to ${arg}`;
    else { await send('Page.navigate', { url: mail.link }); await sleep(arg2 ?? 5000); result = `${mail.subject}: opened`; }
  }
  else {
    await evaluate(HELPERS);
    if (kind === 'tap') result = await evaluate(`__tap(${JSON.stringify(arg)})`);
    else if (kind === 'text') result = await evaluate(`__text(${JSON.stringify(arg)})`);
    else if (kind === 'type') result = await evaluate(`__type(${JSON.stringify(arg)}, ${JSON.stringify(arg2)})`);
    else if (kind === 'eval') result = await evaluate(arg);
    else if (kind === 'save') {
      const value = await evaluate(arg2);
      if (value === undefined || value === null || value === '' || String(value).startsWith('EVAL ERROR')) result = `EXPECTED a value for ${arg}: ${value}`;
      else { vars[arg] = value; saveVars(); result = `${arg} = ${String(value).slice(0, 70)}`; }
    }
    else if (kind === 'slide') {
      // Drags a slide-to-confirm all the way, like a finger.
      const box = await evaluate(`(() => { const el = __q(${JSON.stringify(arg)}); if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.left, y: r.top + r.height / 2, w: r.width }; })()`);
      if (!box) result = 'MISSING ' + arg;
      else {
        const startX = box.x + 28;
        const endX = box.x + box.w - 6;
        await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: startX, y: box.y });
        await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: startX, y: box.y, button: 'left', clickCount: 1 });
        for (let i = 1; i <= 20; i++) {
          await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: startX + ((endX - startX) * i) / 20, y: box.y, button: 'left', buttons: 1 });
          await sleep(25);
        }
        await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: endX, y: box.y, button: 'left', clickCount: 1 });
        result = 'ok';
      }
    }
    else if (kind === 'scroll') {
      // Scrolls an element (a wheel) by a number of pixels, like a finger or mouse wheel.
      const box = await evaluate(`(() => { const el = __q(${JSON.stringify(arg)}); if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
      if (!box) result = 'MISSING ' + arg;
      else { await send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: box.x, y: box.y, deltaX: 0, deltaY: Number(arg2) }); await sleep(900); result = 'ok'; }
    }
    else if (kind === 'file') {
      const opened = new Promise((r) => choosers.push(r));
      result = await evaluate(`__tap(${JSON.stringify(arg)})`);
      const ev = await Promise.race([opened, sleep(6000).then(() => null)]);
      if (!ev) result = 'MISSING file chooser';
      else {
        const files = String(arg2).split(',').map((f) => assetPath(f.trim()));
        const r = await send('DOM.setFileInputFiles', { files, backendNodeId: ev.backendNodeId });
        result = r.error ? 'EVAL ERROR ' + JSON.stringify(r.error) : 'ok';
      }
      await sleep(1200);
    }
    else if (kind === 'expect') result = (await evaluate(`__has(${JSON.stringify(arg)})`)) ? 'ok' : `EXPECTED TEXT NOT FOUND: ${arg}`;
    else if (kind === 'waitFor') {
      const until = Date.now() + (arg2 ?? 30000);
      result = `EXPECTED TEXT NOT FOUND (waited): ${arg}`;
      while (Date.now() < until) {
        await evaluate(HELPERS);
        if (await evaluate(`__has(${JSON.stringify(arg)})`)) { result = 'ok'; break; }
        await sleep(1000);
      }
    }
    else if (kind === 'expectFile') {
      await sleep(1500);
      const files = readdirSync(downloadDir).filter((f) => !f.endsWith('.crdownload'));
      const hit = files.find((f) => f.includes(arg));
      result = hit ? `ok ${hit} ${statSync(join(downloadDir, hit)).size} bytes` : `EXPECTED FILE NOT FOUND: ${arg} (have: ${files.join(', ')})`;
    }
    else if (kind === 'expectNot') result = (await evaluate(`__has(${JSON.stringify(arg)})`)) ? `UNEXPECTED TEXT FOUND: ${arg}` : 'ok';
    else if (kind === 'shot') {
      if (arg2 === 'full') {
        const h = await evaluate('Math.max(...[...document.querySelectorAll("div")].map(d => d.scrollHeight))');
        await send('Emulation.setDeviceMetricsOverride', { width: W, height: Math.min(5000, h || H), deviceScaleFactor: 2, mobile: true });
        await sleep(700);
      }
      const shot = await send('Page.captureScreenshot', { format: 'png' });
      writeFileSync(join(out, 'shots', `${arg}.png`), Buffer.from(shot.result.data, 'base64'));
      if (arg2 === 'full') await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 2, mobile: true });
      result = `shots/${arg}.png`;
    }
    await sleep(kind === 'shot' || kind === 'expect' || kind === 'expectNot' ? 100 : 700);
  }
  const bad = typeof result === 'string' && /MISSING|EXPECTED|UNEXPECTED|EVAL ERROR/.test(result);
  if (bad) failures++;
  console.log(`${bad ? 'FAIL' : '    '} ${kind} ${arg ?? ''} ${arg2 && kind !== 'shot' ? JSON.stringify(arg2) : ''} -> ${typeof result === 'string' ? result : JSON.stringify(result)}`);
  if (bad && kind === 'expect') console.log('      page text: ' + JSON.stringify(String(await evaluate('document.body.innerText')).slice(0, 400)));
}
if (errors.length) console.log('PAGE ERRORS:\n  ' + [...new Set(errors)].join('\n  '));
console.log(failures ? `${failures} step(s) failed` : 'all steps passed');
ws.close();
chrome.kill();
